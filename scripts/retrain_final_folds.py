r"""Re-run data's FINAL_v1 and L3 with their own code, keeping the fold boosters. docs/15.

    uv run python scripts/retrain_final_folds.py \
        --notebook ../superestela-datos/notebooks/experimentos_stuff.py \
        --tracking-db ../superestela-datos/mlFlow/mlflow.db

The product needs one booster per cross-validation fold to give every score
its band (CONVENTIONS.md 8.2) and to pass the smoothness gates S1 and S3.
Data's ``run_experiment`` trains those five boosters and keeps them only in
memory (``_MODEL_CACHE``). This calls it with each run's own configuration
from ``artifacts/data-runs/<run>/config.json``, logs the run to the same
MLflow database data uses, under its own experiment so data's runs are left
as they are, and saves:

- ``artifacts/data-runs/<run>/models/folds/stuff_<type>_f<k>.json``: each fold's
  booster, cut at the trees data's code predicts with (early stopping);
- ``artifacts/data-runs/<run>/xrv_media_desviacion_por_pitch.csv``: the mean
  and sd of the out-of-fold xRV per type, the scale (for L3, data never
  handed it over);
- ``artifacts/data-runs/<run>/fold_summary.retrained.csv``: to compare with
  data's ``fold_summary.csv``, the check that this is their training.

Nothing here is a modelling decision: the configuration, the code and the
seed are data's. Only the data preparation of their notebook (cells 6-26) is
ported, from ``models.outcomes`` (checked against their run values to 1e-16).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
from types import ModuleType

import numpy as np
import pandas as pd

from models import outcomes

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "stuff_model_df.parquet"
RUNS = ROOT / "artifacts" / "data-runs"
# What the notebook leaves in its own outputs and is computed again here.
CONFIG_ONLY = ("features_resolved", "controls")
# Each run's experiment in MLflow, next to data's (their artifact paths point at
# a Windows disk, so a new experiment keeps these runs' artifacts readable here).
EXPERIMENTS = {
    "FINAL_v1": "superestela/A-target/final-folds",
    "L3_loc_count_hand": "superestela/B-location/final-folds",
}


def load_notebook(path: Path) -> ModuleType:
    """Import data's experiment module by path; nothing in packages/ ever does."""
    spec = importlib.util.spec_from_file_location("experimentos_stuff", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare(raw: pd.DataFrame, run_values: pd.DataFrame, nb: ModuleType) -> pd.DataFrame:
    """The frame the notebook hands to run_experiment (cells 6, 8, 11 and 26)."""
    df = raw.copy()
    for c in ("year", "Balls", "Strikes", "PlateLocHeight", "PlateLocSide"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    events = outcomes.event_type(df)
    df["event_type"] = events
    df["delta_run_exp"] = outcomes.delta_run_exp(df, events, run_values)
    df["has_rv"] = df["delta_run_exp"].notna()
    df["valid_hand"] = df["PitcherThrows"].isin(["Left", "Right"]) & df["BatterSide"].isin(
        ["Left", "Right"]
    )
    df["is_lhp"] = (df["PitcherThrows"] == "Left").astype(int)
    df["is_lhb"] = (df["BatterSide"] == "Left").astype(int)
    df["same_hand"] = (df["is_lhp"] == df["is_lhb"]).astype(int)
    sign = np.where(df["is_lhp"] == 1, -1.0, 1.0)
    df["HorzBreak_m"] = df["HorzBreak"] * sign
    df["RelSide_m"] = df["RelSide"] * sign
    df["HorzRelAngle_m"] = df["HorzRelAngle"] * sign
    axis = np.where(df["is_lhp"] == 1, (360 - df["SpinAxis"]) % 360, df["SpinAxis"])
    df["SpinAxis_sin"] = np.sin(np.deg2rad(axis))
    df["SpinAxis_cos"] = np.cos(np.deg2rad(axis))
    return nb.prepare_extra_features(df)


def retrain(name: str, df: pd.DataFrame, nb: ModuleType, tracking_uri: str) -> dict[str, object]:
    """Run one of data's runs again and keep what it trains."""
    folder = RUNS / name
    cfg = json.loads((folder / "config.json").read_text())
    cfg = {k: v for k, v in cfg.items() if k not in CONFIG_ONLY}
    cfg["name"] = f"{name}_folds"
    nb._MODEL_CACHE.clear()
    out_dir = folder / "retrained"
    metrics, parts = nb.run_experiment(
        df,
        cfg,
        experiment_name=EXPERIMENTS[name],
        tracking_uri=tracking_uri,
        out_dir=str(out_dir),
        dataset_path=str(DATA),
        use_mlflow=True,
    )

    folds_dir = folder / "models" / "folds"
    folds_dir.mkdir(parents=True, exist_ok=True)
    saved = 0
    for key, (bst, n_used, _, _) in nb._MODEL_CACHE.items():
        pitch_type, fold = key[-3], key[-2]
        bst[:n_used].save_model(str(folds_dir / f"stuff_{pitch_type}_f{fold}.json"))
        saved += 1

    res = parts["res"]
    stats = res.groupby(nb.PT)["xrv_use"].agg(["size", "mean", "std", "min", "max"]).reset_index()
    stats.columns = [
        "AutoPitchType",
        "n",
        "media_xRV",
        "desviacion_xRV",
        "minimo_xRV",
        "maximo_xRV",
    ]
    stats_path = folder / "xrv_media_desviacion_por_pitch.csv"
    if stats_path.exists():  # data's own numbers win; ours go next to them to compare
        stats_path = folder / "xrv_media_desviacion_por_pitch.retrained.csv"
    stats.to_csv(stats_path, index=False)
    parts["folds"].to_csv(folder / "fold_summary.retrained.csv", index=False)
    return {"run": name, "boosters_saved": saved, "metrics": metrics, "stats": str(stats_path)}


def main() -> None:
    """Retrain both runs and print what was saved."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--notebook", type=Path, required=True)
    parser.add_argument("--tracking-db", type=Path, required=True)
    parser.add_argument("--runs", nargs="+", default=list(EXPERIMENTS))
    args = parser.parse_args()

    nb = load_notebook(args.notebook.resolve())
    tracking_uri = f"sqlite:///{args.tracking_db.resolve()}"
    df = prepare(pd.read_parquet(DATA), pd.read_csv(RUNS / "runValues.csv"), nb)
    # MLflow writes run artifacts under ./mlruns: next to the database.
    os.chdir(args.tracking_db.resolve().parent)
    for name in args.runs:
        record = retrain(name, df, nb, tracking_uri)
        print(json.dumps({k: v for k, v in record.items() if k != "metrics"}))


if __name__ == "__main__":
    main()
