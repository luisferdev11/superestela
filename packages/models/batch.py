"""Score a whole file of pitches through the scoring contract. ADR 0009.

This is the harness, not the model. It turns rows with the dataset's columns
into the input ``models.scoring.Scorer`` expects, asks the scorer, and writes
one row out per row in, with the Stuff+, its standard error and the reason
when a row gets no score. Whatever model answers the contract -- the v0
bridge today, the data team's model after A3 -- goes through it unchanged.

What belongs where, so nobody has to guess:

- **The harness (here) decides nothing about pitch quality.** It renames the
  vendor columns (``contracts.mapping``), mirrors horizontals to the arm side
  (``models.scoring.to_arm_side``), measures the air (below) and asks.
- **The model decides everything else:** features, target, scale, how it
  treats the batter's side. Those live behind ``Scorer``.

Density index. Every model is trained with the density index measured from
the ball's own trajectory, per game (``core.density``). A new file gets the
same measurement when it carries the trajectory and the game id, normalised
by the training data's sea-level drag so the number means the same thing.
Without them, the row falls back to the measured mean of its altitude
category, and ``density_source`` says which one it got.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
import pandas as pd

from contracts.mapping import CANONICAL_TO_VENDOR, normalize_columns
from core.density import (
    DENSITY_INDEX_EXTREME,
    DENSITY_INDEX_MEDIUM,
    DENSITY_INDEX_SEA_LEVEL,
    compute_density_index,
    decompose_trajectory,
)
from models.features.arsenal import ARSENAL_KEY, DIFF_COLUMNS, frame_differentials
from models.scoring import PitchInput, Scorer, to_arm_side

# What a row needs to be scored, in canonical names (CONVENTIONS.md 2.2).
REQUIRED = (
    "pitch_type",
    "pitcher_hand",
    "release_speed",
    "spin_rate",
    "spin_axis",
    "ivb",
    "horizontal_break",
    "extension",
    "release_height",
    "release_side",
)
NUMERIC = REQUIRED[2:]

# The trajectory at release and the game, as the tracking system delivers them.
TRAJECTORY = ("vx0", "vy0", "vz0", "ax0", "ay0", "az0")
GAME = "game_anon_id"
PITCHER = "pitcher_anon_id"

# A game's density is the mean of its pitches' readings, and one reading is
# noisy: sd 0.0765 around its game's mean (evidence.json ->
# scoring_reference.within_game_pitch_sd). At 50 pitches the mean's error is 0.011, a
# quarter of the spread between games (per_game_sd 0.04). Below that the row
# takes its category's density instead. Product rule, ADR 0009.
MIN_GAME_PITCHES_FOR_DENSITY = 50

# measured, evidence.json -> density.<category>.per_game_mean (via core.density)
CATEGORY_DENSITY = {
    "No Altitude": DENSITY_INDEX_SEA_LEVEL,
    "Medium Altitude": DENSITY_INDEX_MEDIUM,
    "Extreme Altitude": DENSITY_INDEX_EXTREME,
}

# Why a row has no score. "scored" is the only status with a number.
SCORED = "scored"
UNSUPPORTED_PITCH_TYPE = "unsupported_pitch_type"
MISSING_FEATURES = "missing_features"
UNKNOWN_HAND = "unknown_hand"
MISSING_DENSITY = "missing_density"

OUTPUT_COLUMNS = (
    "pitch_id",
    "stuff_plus",
    "stuff_plus_se",
    "status",
    "density_index",
    "density_source",
    "model_id",
)


class MissingColumnsError(ValueError):
    """The file lacks a column every row needs; nothing can be scored."""


def density_index(frame: pd.DataFrame, reference_game_drag_k: float) -> tuple[pd.Series, pd.Series]:
    """Return the density index of every row and where it came from.

    Args:
        frame: Canonical rows; may carry ``TRAJECTORY``, ``GAME`` and
            ``environment``.
        reference_game_drag_k: The training data's mean sea-level drag
            coefficient, evidence.json -> scoring_reference.reference_game_drag_k.

    Returns:
        ``(density_index, density_source)``. The source is ``"trajectory"``;
        ``"category"`` when the trajectory is missing or its game is too thin;
        ``"thin_game"`` when the game is too thin and there is no category to
        fall back to, so the noisy reading is all there is; or ``"missing"``.
    """
    index = pd.Series(np.nan, index=frame.index)
    source = pd.Series("missing", index=frame.index, dtype=object)

    if all(c in frame for c in (*TRAJECTORY, GAME)):
        traj = frame[list(TRAJECTORY)].astype(float)
        # The same rows training averaged (analysis/evidence.py, main): a pitch
        # with no environment or no pitcher never entered a game's mean there,
        # so it does not enter it here either, or one pitch would score
        # differently depending on what else the file holds.
        ok = traj.notna().all(axis=1) & frame[GAME].notna()
        for column in ("environment", PITCHER):
            if column in frame:
                ok &= frame[column].notna()
        if ok.any():
            parts = decompose_trajectory(*(traj.loc[ok, c].to_numpy() for c in TRAJECTORY))
            drag = pd.Series(parts.drag_k, index=traj.index[ok])
            # Averaged per game, as in training: one pitch's drag is noise.
            games = drag.groupby(frame.loc[ok, GAME])
            per_game = games.transform("mean")
            index.loc[ok] = compute_density_index(per_game.to_numpy(), reference_game_drag_k)
            thick = games.transform("size") >= MIN_GAME_PITCHES_FOR_DENSITY
            source.loc[thick[thick].index] = "trajectory"
            source.loc[thick[~thick].index] = "thin_game"

    if "environment" in frame:
        fallback = frame["environment"].map(CATEGORY_DENSITY)
        use = source.isin(["missing", "thin_game"]) & fallback.notna()
        index.loc[use] = fallback[use].astype(float)
        source.loc[use] = "category"

    return index, source


def score_frame(
    raw: pd.DataFrame,
    scorer: Scorer,
    reference_game_drag_k: float,
    chunk_size: int = 50_000,  # ~1 GB of draws at 20 bags; bounds memory, not results
) -> pd.DataFrame:
    """Score every row of a file with the dataset's columns.

    One row out per row in, in the same order. A row without a score keeps
    ``stuff_plus`` and ``stuff_plus_se`` empty and says why in ``status``:
    no number ever leaves without its band (CONVENTIONS.md 8.2).

    Args:
        raw: Rows as delivered, vendor column names (``RelSpeed``, ...).
        scorer: Any model that answers ``models.scoring.Scorer``.
        reference_game_drag_k: See ``density_index``.
        chunk_size: Rows per call to the model, to bound memory.

    Raises:
        MissingColumnsError: If a column every row needs is absent. A model
            that uses the arsenal also needs the pitcher, the season and the
            altitude category, to find each pitch's primary fastball.
    """
    frame = normalize_columns(raw.reset_index(drop=True))
    required = REQUIRED + (ARSENAL_KEY if scorer.uses_arsenal else ())
    absent = [c for c in required if c not in frame]
    if absent:
        names = ", ".join(CANONICAL_TO_VENDOR.get(c, c) for c in absent)
        raise MissingColumnsError(f"the file has no column {names}; every row needs it")
    if scorer.uses_arsenal:
        # Against the file's own arsenals, from every row, before any is set
        # aside: in training an unscored pitch still counted for its pitcher
        # (models.features.arsenal). Horizontals go to the arm side first.
        sign = np.where(frame["pitcher_hand"] == "Left", -1.0, 1.0)
        arm = frame.assign(horizontal_break=frame["horizontal_break"] * sign)
        frame = frame.join(frame_differentials(arm))

    rho, rho_source = density_index(frame, reference_game_drag_k)
    status = pd.Series(SCORED, index=frame.index, dtype=object)
    status[rho.isna()] = MISSING_DENSITY
    status[~frame["pitcher_hand"].isin(["Right", "Left"])] = UNKNOWN_HAND
    missing = frame[list(NUMERIC)].isna().any(axis=1)
    if scorer.uses_arsenal:
        # No arsenal to measure against; a NaN gap with a known arsenal is the
        # model's missing value, as in training (docs/15).
        missing |= frame[list(ARSENAL_KEY)].isna().any(axis=1)
    status[missing] = MISSING_FEATURES
    status[~frame["pitch_type"].isin(scorer.pitch_types)] = UNSUPPORTED_PITCH_TYPE

    # Several problems on one row report the first of: unsupported type,
    # missing features, unknown hand, missing density (the assignments above
    # run in reverse, so the earlier ones win).
    value = np.full(len(frame), np.nan)
    se = np.full(len(frame), np.nan)
    rows = np.flatnonzero(status.to_numpy() == SCORED)
    for start in range(0, len(rows), chunk_size):
        at = rows[start : start + chunk_size]
        draws = scorer.draws(_pitch_inputs(frame.iloc[at]), rho.iloc[at].tolist())
        if draws.shape[0] < 2:
            raise ValueError(f"{scorer.model_id} returned one draw: a score needs its spread")
        # The contract's draws are the model's uncertainty: their mean is the
        # Stuff+ and their spread its standard error, as the API reports them.
        value[at] = draws.mean(axis=0)
        se[at] = draws.std(axis=0, ddof=1)

    pitch_id = (
        frame["pitch_id"].astype(str)
        if "pitch_id" in frame
        else pd.Series([f"row_{i}" for i in range(len(frame))])
    )
    out = pd.DataFrame(
        {
            "pitch_id": pitch_id.to_numpy(),
            "stuff_plus": value,
            "stuff_plus_se": se,
            "status": status.to_numpy(),
            "density_index": rho.to_numpy(),
            "density_source": rho_source.to_numpy(),
            "model_id": scorer.model_id,
        }
    )
    return out[list(OUTPUT_COLUMNS)]


def _pitch_inputs(frame: pd.DataFrame) -> Sequence[PitchInput]:
    """Build the contract's input rows, horizontals mirrored to the arm side."""
    hb, side, axis = to_arm_side(
        frame["pitcher_hand"], frame["horizontal_break"], frame["release_side"], frame["spin_axis"]
    )
    shapes = zip(
        frame["pitch_type"],
        frame["pitcher_hand"],
        frame["release_speed"],
        frame["ivb"],
        hb,
        frame["spin_rate"],
        axis,
        frame["extension"],
        frame["release_height"],
        side,
        strict=True,
    )
    return [
        PitchInput(
            pitch_type=str(pt),
            pitcher_hand=str(hand),
            release_speed=float(speed),
            ivb=float(ivb),
            horizontal_break=float(h),
            spin_rate=float(spin),
            spin_axis=float(a),
            extension=float(ext),
            release_height=float(height),
            release_side=float(s),
            **diffs,
        )
        for (pt, hand, speed, ivb, h, spin, a, ext, height, s), diffs in zip(
            shapes, _diffs(frame), strict=True
        )
    ]


def _diffs(frame: pd.DataFrame) -> list[dict[str, float]]:
    """The arsenal fields of each row, or nothing for a model that does not read them."""
    if not set(DIFF_COLUMNS) <= set(frame.columns):
        return [{} for _ in range(len(frame))]
    return [
        {str(k): float(v) for k, v in r.items()}
        for r in frame[list(DIFF_COLUMNS)].to_dict("records")
    ]
