"""Where every pitcher-season puts his pitches, at sea level and at extreme altitude.

The Ficha's Arsenal tab draws one map per environment (docs/11 section 5.4)
and has said "pendiente" since the start. This writes what it reads: a grid
of the share of pitches per cell, from the catcher's view, plus the mean
plate height, the share in the zone and whiff per swing. Counts of what
happened, not a model.

    uv run python analysis/pitcher_locations.py

In:   data/stuff_model_df.parquet, analysis/outputs/arsenals.json (the keys)
Out:  analysis/outputs/locations.json, pitch_locations.json (per pitch type) and
      pitch_effectiveness.json (where his most and least effective pitches land)

Kept apart from evidence.py, like pitcher_runs.py. ``scripts/regenerate.py`` runs it.
"""

import json
import os

import joblib
import numpy as np
import pandas as pd
from evidence import MAIN_PITCHES, STUFF_FEATURES

from contracts.mapping import CANONICAL_TO_VENDOR, normalize_columns
from contracts.schemas import MIN_PITCHES_FOR_SCORE
from models.location.final import REQUIRED as LOCATION_REQUIRED

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PARQUET = os.path.join(ROOT, "data", "stuff_model_df.parquet")
ARSENALS = os.path.join(HERE, "outputs", "arsenals.json")
OUT = os.path.join(HERE, "outputs", "locations.json")
# Kept in their own files so each stays under the repository's 2 MB limit.
OUT_BY_PITCH = os.path.join(HERE, "outputs", "pitch_locations.json")
OUT_EFFECTIVE = os.path.join(HERE, "outputs", "pitch_effectiveness.json")
# data's final Location+ (docs/15); without it the maps still draw, without the score.
LOCATION_MODEL = os.path.join(ROOT, "artifacts", "location_plus_l3.joblib")
HANDS = ("Right", "Left")

ENVIRONMENTS = {"No Altitude": "sea", "Extreme Altitude": "hh"}
# The rows evidence.py scores for the cards (main(): trajectory, pitcher and
# game present; stuff_plus_v0: the six types with every shape feature), so the
# map counts the same pitches as the Ficha's header.
KEPT_IF_PRESENT = [
    "vx0",
    "vy0",
    "vz0",
    "ax0",
    "ay0",
    "az0",
    "pitcher_anon_id",
    "game_anon_id",
    *STUFF_FEATURES,
]

# The frame the prototype draws (Arsenal.dc.html), in feet: 2 ft either side
# of the plate's centre and 0.5 to 4.5 ft high. Pitches outside it still count
# in every share; they just fall off the drawing.
SIDE_RANGE_FT = (-2.0, 2.0)
HEIGHT_RANGE_FT = (0.5, 4.5)
# Cells of 0.4 ft, about a ball and a half: fine enough to see a pitcher who
# works the edges, coarse enough that 100 pitches do not read as noise.
CELLS = 10

# Below this many pitches of one type in one environment its map is not drawn:
# ten pitches in a hundred cells would read as a pattern that is not there.
MIN_PITCHES_PER_TYPE = 15

# What the Simulator calls a pitcher's most and least effective pitches of a
# type (the team's feedback, 20 oct): counts of what happened, not a model.
# Most: a swing and a miss, or the pitch that made the out. Least: the pitch
# that gave up a hit or put the batter on base.
OUTS = ("Out", "Strikeout", "FieldersChoice")
ON_BASE = ("Single", "Double", "Triple", "HomeRun", "Walk", "HitByPitch")


def location_plus(df: pd.DataFrame, model_path: str) -> pd.Series:
    """Location+ of every row from data's final L3 (models.location.final), NaN where it cannot be.

    Each pitch needs its plate location, the count and both hands; a row that
    lacks one, or whose type the model was not trained on, gets no score.
    """
    model = joblib.load(model_path)
    frame = normalize_columns(df[[CANONICAL_TO_VENDOR.get(c, c) for c in LOCATION_REQUIRED]])
    for c in ("pitch_type", "pitcher_hand", "batter_hand"):
        frame[c] = frame[c].astype(object)
    ok = (
        frame.notna().all(axis=1)
        & frame["pitch_type"].isin(model.pitch_types)
        & frame["pitcher_hand"].isin(HANDS)
        & frame["batter_hand"].isin(HANDS)
    )
    value = pd.Series(np.nan, index=df.index)
    value[ok] = model.draws(frame[ok].reset_index(drop=True)).mean(axis=0)
    return value


def panel(group: pd.DataFrame, swings: int, whiffs: int) -> dict | None:
    """One environment's map and numbers, or None below the product's minimum sample.

    ``swings`` and ``whiffs`` come from every pitch type, as the Ficha's outcomes
    table counts them (evidence.outcome_counts), so the two whiffs agree.
    """
    if len(group) < MIN_PITCHES_FOR_SCORE:
        return None
    counts = _counts(group)
    # Rows from the top down, as the screen draws them; shares of all located pitches.
    grid = counts / max(int(counts.sum()), 1)
    height = group.PlateLocHeight.to_numpy(dtype=float)
    if swings == 0:
        return None  # whiff per swing has no denominator; the screen says "pendiente"
    return {
        "n_pitches": int(len(group)),
        "mean_plate_height_ft": round(float(np.nanmean(height)), 3),
        # For the band on the change in height between environments (the reading).
        "plate_height_sd_ft": round(float(np.nanstd(height, ddof=1)), 3),
        "zone_share": round(float(group.in_strike_zone.fillna(0).astype(float).mean()), 4),
        "whiff_per_swing": round(whiffs / swings, 4),
        # data's L3, averaged over the panel's pitches with its 95% band, as the
        # cards' Stuff+ is; None without the model or below the minimum sample.
        "location_plus": _mean_band(group["location_plus"]) if "location_plus" in group else None,
        "grid": [[round(float(v), 5) for v in row] for row in grid],
        "side_range_ft": list(SIDE_RANGE_FT),
        "height_range_ft": list(HEIGHT_RANGE_FT),
    }


def _counts(group: pd.DataFrame) -> np.ndarray:
    """Located pitches per cell, rows from the top down as the screen draws them."""
    side = group.PlateLocSide.to_numpy(dtype=float)
    height = group.PlateLocHeight.to_numpy(dtype=float)
    located = ~(np.isnan(side) | np.isnan(height))
    counts, _, _ = np.histogram2d(
        height[located],
        side[located],
        bins=CELLS,
        range=[HEIGHT_RANGE_FT, SIDE_RANGE_FT],
    )
    return counts[::-1]


def _count_grid(group: pd.DataFrame, with_score: bool = True) -> dict:
    """A map as [row, column, count] of its non-empty cells, which keeps the file small.

    Same frame and CELLS x CELLS grid as the panels; the screen turns counts into shares.
    """
    counts = _counts(group).astype(int)
    rows, cols = np.nonzero(counts)
    return {
        "n_pitches": int(len(group)),
        "cells": [[int(r), int(c), int(counts[r, c])] for r, c in zip(rows, cols, strict=True)],
        # The type's own Location+ in that environment, as the panel's; None below the minimum.
        "location_plus": _mean_band(group["location_plus"])
        if with_score and "location_plus" in group
        else None,
    }


def pitch_maps(group: pd.DataFrame) -> dict:
    """Per pitch type: where he puts it in each environment, and where his best and worst land.

    The best and worst pool both environments: one season of one pitch type
    rarely has enough of either in one of them.
    """
    out: dict[str, dict] = {}
    for pitch_type, typed in group.groupby("AutoPitchType", observed=True):
        if len(typed) < MIN_PITCHES_PER_TYPE:
            continue
        by_env = {
            ENVIRONMENTS[str(c)]: g for c, g in typed.groupby("altitude_category", observed=True)
        }
        most = typed[(typed.is_whiff == 1) | typed.play_result.isin(OUTS)]
        least = typed[typed.play_result.isin(ON_BASE)]
        out[str(pitch_type)] = {
            **{
                env: _count_grid(g)
                if (g := by_env.get(env)) is not None and len(g) >= MIN_PITCHES_PER_TYPE
                else None
                for env in ("sea", "hh")
            },
            "most": _count_grid(most, with_score=False),
            "least": _count_grid(least, with_score=False),
        }
    return dict(sorted(out.items()))


def _mean_band(values: pd.Series) -> dict | None:
    scored = values.dropna()
    if len(scored) < MIN_PITCHES_FOR_SCORE:
        return None
    half = 1.96 * float(scored.std()) / np.sqrt(len(scored))
    return {"value": round(float(scored.mean()), 1), "ci95": round(half, 1)}


def pitcher_locations(df: pd.DataFrame, keys: set[str]) -> dict:
    """Both panels for every pitcher-season the Ficha can open, keyed like arsenals.json."""
    keys_cols = ["pitcher_anon_id", "year", "altitude_category"]
    physics = df[df.altitude_category.isin(ENVIRONMENTS)].dropna(subset=KEPT_IF_PRESENT[:8])
    rates = (
        physics.assign(swings=physics.is_swing.astype(int), whiffs=physics.is_whiff.astype(int))
        .groupby(keys_cols, observed=True)[["swings", "whiffs"]]
        .sum()
    )
    d = physics[physics.AutoPitchType.isin(MAIN_PITCHES)].dropna(subset=KEPT_IF_PRESENT)
    out: dict[str, dict] = {}
    for (pitcher, year, category), group in d.groupby(
        ["pitcher_anon_id", "year", "altitude_category"], observed=True
    ):
        key = f"{pitcher}/{int(year)}"
        if key not in keys:
            continue
        counts = rates.loc[(pitcher, year, category)]
        out.setdefault(key, {"sea": None, "hh": None, "pitches": {}})[
            ENVIRONMENTS[str(category)]
        ] = panel(group, int(counts.swings), int(counts.whiffs))
    for (pitcher, year), group in d.groupby(["pitcher_anon_id", "year"], observed=True):
        key = f"{pitcher}/{int(year)}"
        if key in out:
            out[key]["pitches"] = pitch_maps(group)
    return dict(sorted(out.items()))


def main() -> None:
    df = pd.read_parquet(
        PARQUET,
        columns=[
            "pitcher_anon_id",
            "year",
            "altitude_category",
            "PlateLocSide",
            "PlateLocHeight",
            "in_strike_zone",
            "is_swing",
            "is_whiff",
            "AutoPitchType",
            "play_result",
            "BatterSide",
            "PitcherThrows",
            "Balls",
            "Strikes",
            *KEPT_IF_PRESENT[:6],
            "game_anon_id",
            *STUFF_FEATURES,
        ],
    )
    with open(ARSENALS) as fh:
        keys = set(json.load(fh))
    if os.path.exists(LOCATION_MODEL):
        df = df.assign(location_plus=location_plus(df, LOCATION_MODEL))
    locations = pitcher_locations(df, keys)
    pitches = {k: v.pop("pitches") for k, v in locations.items()}
    by_pitch = {
        k: {t: {e: m[e] for e in ("sea", "hh")} for t, m in v.items()} for k, v in pitches.items()
    }
    effective = {
        k: {t: {e: m[e] for e in ("most", "least")} for t, m in v.items()}
        for k, v in pitches.items()
    }
    for path, content in ((OUT, locations), (OUT_BY_PITCH, by_pitch), (OUT_EFFECTIVE, effective)):
        with open(path, "w") as fh:
            json.dump(content, fh, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
            fh.write("\n")
    shown = sum(1 for v in locations.values() if v["sea"] is not None or v["hh"] is not None)
    print(f"Wrote {os.path.relpath(OUT, ROOT)}: {shown} of {len(keys)} pitcher-seasons with a map")


if __name__ == "__main__":
    main()
