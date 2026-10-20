"""Check the packaged final models against what data computed. docs/15.

    uv run python scripts/verify_final_models.py \
        --notebook ../superestela-datos/notebooks/experimentos_stuff.py

Three checks, written to ``artifacts/final_models.verify.json``:

1. **Feature parity.** The fastball differentials from
   ``models.features.arsenal`` against data's own ``_fb_diffs``, imported from
   their module by path (verification only: nothing in ``packages/`` imports
   a notebook, CONVENTIONS.md 8.5).
2. **Stuff+ against data's.** Mean Stuff+ per pitcher, season and type,
   against ``FINAL_v1/pitcher_table.csv``. Data's numbers are out of fold and
   ours come from the final booster, so they cannot be identical; how close
   they are is the check that the inference path is the training path.
3. **Location+ against data's**, the same way, against ``L3/pitcher_table.csv``.
   Our scale is not data's (they did not hand it over), so this compares the
   ordering (r) and reports the level as it comes out.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from build_final_models import DATA, RUNS, prepare

ROOT = Path(__file__).resolve().parents[1]
# The agreement the plan accepts between out-of-fold and final-booster scores.
MIN_R = 0.95
MAX_MEAN_ABS_GAP = 2.0


def feature_parity(notebook: Path, raw: pd.DataFrame, frame: pd.DataFrame) -> dict[str, float]:
    """Return the largest gap between our differentials and data's ``_fb_diffs``."""
    spec = importlib.util.spec_from_file_location("experimentos_stuff", notebook)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    theirs = raw.copy()
    for c in ("AutoPitchType", "PitcherThrows", "altitude_category"):
        theirs[c] = theirs[c].astype(object)
    theirs["HorzBreak_m"] = theirs["HorzBreak"] * np.where(
        theirs["PitcherThrows"] == "Left", -1.0, 1.0
    )
    module._fb_diffs(theirs, [module.GROUP_COL, module.YEAR, module.ALT], "_env")
    gaps = {}
    for ours, col in (
        ("speed_diff", "speed_diff_env"),
        ("ivb_diff", "ivb_diff_env"),
        ("hb_diff", "hb_diff_env"),
    ):
        a, b = frame[ours].to_numpy(), theirs[col].to_numpy()
        both_nan = np.isnan(a) & np.isnan(b)
        gaps[ours] = float(np.nanmax(np.abs(a - b))) if not both_nan.all() else 0.0
        gaps[f"{ours}_nan_mismatch"] = int((np.isnan(a) != np.isnan(b)).sum())
    return gaps


def against_table(scores: pd.Series, rows: pd.DataFrame, table: Path) -> dict[str, float]:
    """Compare mean scores per pitcher, season and type with data's pitcher table."""
    ours = (
        pd.DataFrame(
            {
                "pitcher_anon_id": rows["pitcher_anon_id"].to_numpy(),
                "year": rows["year"].to_numpy(),
                "AutoPitchType": rows["pitch_type"].to_numpy(),
                "ours": scores.to_numpy(),
            }
        )
        .groupby(["pitcher_anon_id", "year", "AutoPitchType"])["ours"]
        .agg(["mean", "size"])
        .reset_index()
    )
    theirs = pd.read_csv(table)
    m = theirs.merge(ours, on=["pitcher_anon_id", "year", "AutoPitchType"], how="inner")
    big = m[m["n"] >= 100]
    gap = (m["mean"] - m["stuff"]).abs()
    return {
        "groups_theirs": len(theirs),
        "groups_matched": len(m),
        "same_n_share": float((m["n"] == m["size"]).mean()),
        "r": float(np.corrcoef(m["mean"], m["stuff"])[0, 1]),
        "r_n100": float(np.corrcoef(big["mean"], big["stuff"])[0, 1]),
        "mean_abs_gap": float(gap.mean()),
        "mean_abs_gap_n100": float((big["mean"] - big["stuff"]).abs().mean()),
        "mean_ours": float(m["mean"].mean()),
        "mean_theirs": float(m["stuff"].mean()),
    }


def main() -> None:
    """Run the three checks and write them next to the models."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--notebook", type=Path, required=True)
    args = parser.parse_args()

    raw = pd.read_parquet(DATA)
    frame = prepare(raw, pd.read_csv(RUNS / "runValues.csv"))
    report: dict[str, object] = {"parity": feature_parity(args.notebook, raw, frame)}

    stuff = joblib.load(ROOT / "artifacts" / "stuff_plus_final_v1.joblib")
    rows = frame[frame["base_ok"] & frame["pitch_type"].isin(stuff.pitch_types)]
    rows = rows[rows[["speed_diff", "ivb_diff", "hb_diff"]].notna().all(axis=1)]
    value = pd.Series(stuff.stuff_plus(rows).mean(axis=0), index=rows.index)
    report["stuff"] = against_table(value, rows, RUNS / "FINAL_v1" / "pitcher_table.csv")
    report["stuff"]["rows_scored"] = len(rows)

    loc = joblib.load(ROOT / "artifacts" / "location_plus_l3.joblib")
    rows = frame[frame["base_ok"] & frame["pitch_type"].isin(loc.pitch_types)]
    value = pd.Series(loc.draws(rows).mean(axis=0), index=rows.index)
    report["location"] = against_table(
        value, rows, RUNS / "L3_loc_count_hand" / "pitcher_table.csv"
    )
    report["location"]["rows_scored"] = len(rows)

    s = report["stuff"]
    report["passed"] = {
        "parity": all(v < 1e-9 for k, v in report["parity"].items() if not k.endswith("mismatch"))
        and all(v == 0 for k, v in report["parity"].items() if k.endswith("mismatch")),
        "stuff_r": s["r_n100"] >= MIN_R,
        "stuff_gap": s["mean_abs_gap_n100"] <= MAX_MEAN_ABS_GAP,
        "location_r": report["location"]["r_n100"] >= MIN_R,
    }
    (ROOT / "artifacts" / "final_models.verify.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
