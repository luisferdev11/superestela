"""Where every pitcher-season puts his pitches, at sea level and at extreme altitude.

The Ficha's Arsenal tab draws one map per environment (docs/11 section 5.4)
and has said "pendiente" since the start. This writes what it reads: a grid
of the share of pitches per cell, from the catcher's view, plus the mean
plate height, the share in the zone and whiff per swing. Counts of what
happened, not a model.

    uv run python analysis/pitcher_locations.py

In:   data/stuff_model_df.parquet, analysis/outputs/arsenals.json (the keys)
Out:  analysis/outputs/locations.json

Kept apart from evidence.py, like pitcher_runs.py. ``scripts/regenerate.py`` runs it.
"""

import json
import os

import numpy as np
import pandas as pd
from evidence import MAIN_PITCHES, STUFF_FEATURES

from contracts.schemas import MIN_PITCHES_FOR_SCORE

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PARQUET = os.path.join(ROOT, "data", "stuff_model_df.parquet")
ARSENALS = os.path.join(HERE, "outputs", "arsenals.json")
OUT = os.path.join(HERE, "outputs", "locations.json")

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


def panel(group: pd.DataFrame) -> dict | None:
    """One environment's map and numbers, or None below the product's minimum sample."""
    if len(group) < MIN_PITCHES_FOR_SCORE:
        return None
    side = group.PlateLocSide.to_numpy(dtype=float)
    height = group.PlateLocHeight.to_numpy(dtype=float)
    located = ~(np.isnan(side) | np.isnan(height))
    counts, _, _ = np.histogram2d(
        height[located],
        side[located],
        bins=CELLS,
        range=[HEIGHT_RANGE_FT, SIDE_RANGE_FT],
    )
    # Rows from the top down, as the screen draws them; shares of all located pitches.
    grid = counts[::-1] / max(int(located.sum()), 1)
    swings = int(group.is_swing.fillna(False).astype(bool).sum())
    whiffs = int(
        (
            group.is_swing.fillna(False).astype(bool) & group.is_whiff.fillna(False).astype(bool)
        ).sum()
    )
    if swings == 0:
        return None  # whiff per swing has no denominator; the screen says "pendiente"
    return {
        "n_pitches": int(len(group)),
        "mean_plate_height_ft": round(float(np.nanmean(height)), 3),
        # For the band on the change in height between environments (the reading).
        "plate_height_sd_ft": round(float(np.nanstd(height, ddof=1)), 3),
        "zone_share": round(float(group.in_strike_zone.fillna(0).astype(float).mean()), 4),
        "whiff_per_swing": round(whiffs / swings, 4),
        "grid": [[round(float(v), 5) for v in row] for row in grid],
        "side_range_ft": list(SIDE_RANGE_FT),
        "height_range_ft": list(HEIGHT_RANGE_FT),
    }


def pitcher_locations(df: pd.DataFrame, keys: set[str]) -> dict:
    """Both panels for every pitcher-season the Ficha can open, keyed like arsenals.json."""
    d = df[df.altitude_category.isin(ENVIRONMENTS) & df.AutoPitchType.isin(MAIN_PITCHES)]
    d = d.dropna(subset=KEPT_IF_PRESENT)
    out: dict[str, dict] = {}
    for (pitcher, year, category), group in d.groupby(
        ["pitcher_anon_id", "year", "altitude_category"], observed=True
    ):
        key = f"{pitcher}/{int(year)}"
        if key not in keys:
            continue
        out.setdefault(key, {"sea": None, "hh": None})[ENVIRONMENTS[str(category)]] = panel(group)
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
            *KEPT_IF_PRESENT[:6],
            "game_anon_id",
            *STUFF_FEATURES,
        ],
    )
    with open(ARSENALS) as fh:
        keys = set(json.load(fh))
    locations = pitcher_locations(df, keys)
    with open(OUT, "w") as fh:
        json.dump(locations, fh, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        fh.write("\n")
    shown = sum(1 for v in locations.values() if v["sea"] is not None or v["hh"] is not None)
    print(f"Wrote {os.path.relpath(OUT, ROOT)}: {shown} of {len(keys)} pitcher-seasons with a map")


if __name__ == "__main__":
    main()
