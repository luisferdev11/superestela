"""Score every pitcher of a tracking file, for the translator's many-pitcher mode (P3).

The team asked (14 October) to load a file from another league with many
pitchers and see, per pitcher: Stuff+ at sea level, Stuff+ at extreme
altitude, whiff and the altitude tax. No main pitch, no pitch-type filter.

The file comes in the dataset's format: the data team is writing the script
that converts other exports to it. Per pitch, the shape is brought to sea
level from where it was measured and moved to extreme altitude by the density
law, as ``/simulate`` does; then every pitch goes through the contract's draws
in both airs in ONE call, so a pitcher's two scores and their delta share the
draws and the delta's band is honest.

What is measured and what is not, said plainly:

- **Whiff** is measured, in the file's own league: whiffs over swings, with the
  95% band of ``core.rates``. Nobody measured it at altitude for these pitchers.
- **The projected tax** is NOT the Radar's tax. The Radar's is measured from
  outcomes in both environments; these pitchers never pitched at altitude. This
  one inverts the model's own scale: a Stuff+ drop is an expected run value
  increase of ``delta / 10 * sd_xrv`` per pitch, times 9 innings of measured
  extreme-altitude pitches per inning. The screen calls it projected.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
import pandas as pd

from api.arsenal_file import ArsenalFileError, missing_columns
from contracts.mapping import normalize_columns
from contracts.schemas import MIN_PITCHES_FOR_SCORE, MIN_SWINGS_FOR_RATE
from core.density import DENSITY_INDEX_EXTREME, DENSITY_INDEX_SEA_LEVEL
from core.rates import rate_band
from core.translate import break_scaling_factor
from models.batch import CATEGORY_DENSITY, NUMERIC, PITCHER, REQUIRED
from models.features.arsenal import frame_differentials
from models.scoring import PitchInput, Scorer, implied_xrv, to_arm_side

FloatArray = npt.NDArray[np.float64]

# A file of a league's season is a few hundred pitchers; past this the request
# is a batch job, not a screen.
MAX_PITCHERS = 400


@dataclass(frozen=True)
class Band:
    """A value and its standard error, as the API reports every score."""

    value: float
    se: float


@dataclass(frozen=True)
class PitcherScore:
    """One pitcher of the file, translated to extreme altitude."""

    pitcher_id: str
    pitcher_hand: str
    n: int
    stuff_plus_sea: Band | None
    stuff_plus_hh: Band | None
    delta: Band | None
    projected_tax: Band | None
    # Whiff in the file's league: the rate and its 95% half-width.
    whiff_per_swing: tuple[float, float] | None
    swings: int


@dataclass(frozen=True)
class FileScores:
    """Every pitcher with enough pitches, and an account of what was left out."""

    n_rows: int
    pitchers: tuple[PitcherScore, ...]
    few_pitches: int
    unsupported_rows: int
    missing_feature_rows: int
    has_swings: bool


def _band(draws: FloatArray) -> Band:
    return Band(value=float(draws.mean()), se=float(draws.std(ddof=1)))


def _inputs(
    frame: pd.DataFrame, ivb: FloatArray, hb: FloatArray, scale: float | FloatArray = 1.0
) -> list[PitchInput]:
    # The fastball loses break with the pitch, so the movement gaps scale with it.
    gaps = (
        [
            {"speed_diff": float(v), "ivb_diff": float(i), "hb_diff": float(h)}
            for v, i, h in zip(
                frame["speed_diff"],
                frame["ivb_diff"] * scale,
                frame["hb_diff"] * scale,
                strict=True,
            )
        ]
        if "speed_diff" in frame
        else [{} for _ in range(len(frame))]
    )
    return [
        PitchInput(
            pitch_type=str(pt),
            pitcher_hand=str(hand),
            release_speed=float(speed),
            ivb=float(i),
            horizontal_break=float(h),
            spin_rate=float(spin),
            spin_axis=float(axis),
            extension=float(ext),
            release_height=float(height),
            release_side=float(side),
            **gap,
        )
        for (pt, hand, speed, i, h, spin, axis, ext, height, side), gap in zip(
            zip(
                frame["pitch_type"],
                frame["pitcher_hand"],
                frame["release_speed"],
                ivb,
                hb,
                frame["spin_rate"],
                frame["spin_axis"],
                frame["extension"],
                frame["release_height"],
                frame["release_side"],
                strict=True,
            ),
            gaps,
            strict=True,
        )
    ]


def _with_differentials(df: pd.DataFrame) -> pd.DataFrame:
    """Each pitch against its pitcher's primary fastball, from every row of the file.

    A file without season or altitude category is one arsenal per pitcher.
    """
    environment = df["environment"] if "environment" in df else pd.Series("file", index=df.index)
    frame = df.assign(year=df.get("year", 0), environment=environment.fillna("file"))
    sign = np.where(frame["pitcher_hand"] == "Left", -1.0, 1.0)
    diffs = frame_differentials(
        frame.assign(horizontal_break=frame["horizontal_break"] * sign).astype(
            {"pitch_type": object, "environment": object}
        )
    )
    return df.join(diffs)


def _whiff(group: pd.DataFrame) -> tuple[tuple[float, float] | None, int]:
    if "is_swing" not in group or "is_whiff" not in group:
        return None, 0
    swings = int(group["is_swing"].fillna(0).astype(bool).sum())
    whiffs = int(
        (group["is_swing"].fillna(0).astype(bool) & group["is_whiff"].fillna(0).astype(bool)).sum()
    )
    if swings < MIN_SWINGS_FOR_RATE:
        return None, swings
    return rate_band(whiffs, swings), swings


def score_pitchers(
    csv_text: str,
    scorer: Scorer | None,
    pitches_per_inning: float,
    origin_density_index: float = DENSITY_INDEX_SEA_LEVEL,
) -> FileScores:
    """Read a file in the dataset's format and score each pitcher in both airs.

    Args:
        csv_text: The file, one row per pitch, vendor columns plus ``pitcher_anon_id``.
        scorer: The model, or ``None`` when it is not shown (no file, gates
            failed): then only counts and whiff come back.
        pitches_per_inning: Measured at extreme altitude (evidence.json ->
            run_environment), to turn a per-pitch value into runs per 9.
        origin_density_index: Where the file was measured, for rows without an
            ``altitude_category``.

    Raises:
        ArsenalFileError: When the file is unreadable, empty, lacks a required
            column or the pitcher id, or holds too many pitchers.
    """
    try:
        raw = pd.read_csv(io.StringIO(csv_text))
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        raise ArsenalFileError("unreadable") from exc
    df = normalize_columns(raw)
    if df.empty:
        raise ArsenalFileError("empty")
    missing = tuple(c for c in (*REQUIRED, PITCHER) if c not in df.columns)
    if missing:
        raise missing_columns(missing)
    if df[PITCHER].nunique() > MAX_PITCHERS:
        raise ArsenalFileError("too_many_pitchers")

    df = df.assign(**{c: pd.to_numeric(df[c], errors="coerce") for c in NUMERIC})
    needed = list(NUMERIC)
    if scorer is not None and scorer.uses_arsenal:
        df = _with_differentials(df)
        needed += ["speed_diff", "ivb_diff", "hb_diff"]
    types = scorer.pitch_types if scorer is not None else tuple(df["pitch_type"].dropna().unique())
    supported = df["pitch_type"].isin(types) & df["pitcher_hand"].isin(["Right", "Left"])
    complete = df[needed].notna().all(axis=1) & df[PITCHER].notna()
    usable = df[supported & complete].reset_index(drop=True)

    counts = usable[PITCHER].value_counts()
    kept = counts[counts >= MIN_PITCHES_FOR_SCORE].index
    few = int((counts < MIN_PITCHES_FOR_SCORE).sum())
    usable = usable[usable[PITCHER].isin(kept)].reset_index(drop=True)

    draws: FloatArray | None = None
    if scorer is not None and len(usable) > 0:
        hb, side, axis = to_arm_side(
            usable["pitcher_hand"],
            usable["horizontal_break"],
            usable["release_side"],
            usable["spin_axis"],
        )
        usable = usable.assign(horizontal_break=hb, release_side=side, spin_axis=axis)
        origin = (
            usable["environment"].map(CATEGORY_DENSITY).fillna(origin_density_index)
            if "environment" in usable
            else pd.Series(origin_density_index, index=usable.index)
        ).to_numpy(dtype=float)
        to_sea = np.array([break_scaling_factor(float(o), DENSITY_INDEX_SEA_LEVEL) for o in origin])
        to_high = break_scaling_factor(DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME)
        ivb_sea = usable["ivb"].to_numpy(dtype=float) * to_sea
        hb_sea = usable["horizontal_break"].to_numpy(dtype=float) * to_sea
        sea = _inputs(usable, ivb_sea, hb_sea, to_sea)
        high = _inputs(usable, ivb_sea * to_high, hb_sea * to_high, to_sea * to_high)
        n = len(usable)
        # One call: the two airs share every draw, so the delta's band is honest.
        draws = scorer.draws(
            [*sea, *high], [DENSITY_INDEX_SEA_LEVEL] * n + [DENSITY_INDEX_EXTREME] * n
        )

    pitchers = []
    for pitcher, group in usable.groupby(PITCHER, sort=True):
        whiff, swings = _whiff(group)
        sea_b = high_b = delta_b = tax_b = None
        if draws is not None and scorer is not None:
            idx = group.index.to_numpy()
            n = len(usable)
            at_sea = draws[:, idx].mean(axis=1)
            at_high = draws[:, idx + n].mean(axis=1)
            change = at_high - at_sea
            # A Stuff+ point is a tenth of a standard deviation of expected run
            # value, and lower Stuff+ means more runs: invert the scale.
            # With a scale per type, each pitch's point is worth its own type's sd:
            # ten points below 100 is one sd more xRV.
            sd_rows = np.array(
                [
                    float(implied_xrv(scorer.scale, str(t), 90.0))
                    - float(implied_xrv(scorer.scale, str(t), 100.0))
                    for t in group["pitch_type"]
                ]
            )
            change_rows = draws[:, idx + n] - draws[:, idx]
            runs_per_pitch = -(change_rows / 10.0 * sd_rows).mean(axis=1)
            sea_b, high_b, delta_b = _band(at_sea), _band(at_high), _band(change)
            tax_b = _band(9.0 * pitches_per_inning * runs_per_pitch)
        pitchers.append(
            PitcherScore(
                pitcher_id=str(pitcher),
                pitcher_hand=str(group["pitcher_hand"].mode().iloc[0]),
                n=len(group),
                stuff_plus_sea=sea_b,
                stuff_plus_hh=high_b,
                delta=delta_b,
                projected_tax=tax_b,
                whiff_per_swing=whiff,
                swings=swings,
            )
        )
    return FileScores(
        n_rows=len(df),
        pitchers=tuple(pitchers),
        few_pitches=few,
        unsupported_rows=int((~supported).sum()),
        missing_feature_rows=int((supported & ~complete).sum()),
        has_swings="is_swing" in df and "is_whiff" in df,
    )
