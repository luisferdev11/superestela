"""Runs allowed per nine innings for every pitcher-season, in each environment.

The Ficha asked for an ERA (14 October). The dataset cannot give one: nothing
marks a run as earned (``core.runs``). This writes RA/9 instead, by pitcher,
season and environment, and the screen names it for what it is.

    uv run python analysis/pitcher_runs.py

In:   data/stuff_model_df.parquet
Out:  analysis/outputs/pitcher_runs.json

Kept apart from evidence.py on purpose: the data team is changing that file,
and this needs nothing from it. ``scripts/regenerate.py`` runs it.
"""

import json
import os

import pandas as pd

from core.runs import MIN_INNINGS_FOR_RA9, runs_allowed_per_nine

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PARQUET = os.path.join(ROOT, "data", "stuff_model_df.parquet")
OUT = os.path.join(HERE, "outputs", "pitcher_runs.json")

ENVIRONMENTS = {"No Altitude": "sea", "Extreme Altitude": "hh"}


def pitcher_runs(df: pd.DataFrame) -> dict:
    """RA/9 with its band and innings, keyed like arsenals.json: ``pitcher_id/season``."""
    d = df[df.altitude_category.isin(ENVIRONMENTS)]
    sums = d.groupby(["pitcher_anon_id", "year", "altitude_category"])[
        ["RunsScored", "OutsOnPlay"]
    ].sum()
    out: dict[str, dict] = {}
    for (pitcher, year, category), row in sums.iterrows():
        key = f"{pitcher}/{int(year)}"
        result = runs_allowed_per_nine(int(row.RunsScored), int(row.OutsOnPlay))
        entry = out.setdefault(key, {"sea": None, "hh": None})
        entry[ENVIRONMENTS[category]] = (
            None
            if result is None
            else {
                "ra9": round(result[0], 2),
                "ra9_ci95": round(result[1], 2),
                "innings": round(result[2], 1),
                "runs": int(row.RunsScored),
            }
        )
    return dict(sorted(out.items()))


def main() -> None:
    df = pd.read_parquet(
        PARQUET,
        columns=["pitcher_anon_id", "year", "altitude_category", "RunsScored", "OutsOnPlay"],
    )
    runs = pitcher_runs(df)
    record = {
        "min_innings": MIN_INNINGS_FOR_RA9,
        "note": "RA/9: all runs over innings. Not ERA: the dataset does not mark earned runs.",
        "pitchers": runs,
    }
    with open(OUT, "w") as fh:
        json.dump(record, fh, indent=1, ensure_ascii=False, allow_nan=False)
        fh.write("\n")
    shown = sum(1 for v in runs.values() if v["sea"] is not None or v["hh"] is not None)
    print(f"Wrote {os.path.relpath(OUT, ROOT)}: {shown} pitcher-seasons with RA/9")


if __name__ == "__main__":
    main()
