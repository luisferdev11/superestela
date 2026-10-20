"""Distil FINAL_v1 into a Stuff+ that never loses value when the pitch gets faster. docs/15.

    uv run python scripts/distill_monotone.py \
        --notebook ../superestela-datos/notebooks/experimentos_stuff.py \
        --tracking-db ../superestela-datos/mlFlow/mlflow.db

Why. FINAL_v1 fails gate S1: on 14.7% of real four-seams, +1 mph lowers its
Stuff+ (mostly below 89 and above 94 mph, where trees cut speed into steps
with little data). Neither data's smoother parameter sets nor 20 boosters fix
it, so it is not noise. A multiclass booster cannot be told "speed never
hurts": the rule is about the expected run value, a softmax mix of seven
classes, not about any one class.

How. The rule is put on the quantity it is about:

- **Teacher:** FINAL_v1 as data trained it, its five fold boosters (seed 42,
  scripts/retrain_final_folds.py). Its hand-neutral xRV is the target.
- **Student:** one XGBoost regressor per pitch type on the same features
  (minus ``same_hand``: the teacher is already hand neutral), with data's
  ``base`` parameters and ``monotone_constraints = -1`` on ``RelSpeed``:
  more speed never adds expected runs, holding the rest of the shape and
  the arsenal gaps fixed.
- **No leakage.** The student for fold k learns only from the teacher booster
  that never saw fold k, on the other folds' pitches, so its predictions on
  fold k are out of fold twice over. (A first try that learned from the
  teacher's out-of-fold predictions beat the teacher on every metric: those
  predictions came from boosters that had seen fold k. Discarded.)
- **The five students are the draws**, as the teacher's folds were, so every
  score keeps its band. 100 and one sd per type come from the students'
  out-of-fold xRV.

Out: ``artifacts/data-runs/FINAL_v1_monotone/`` (fold boosters, config,
scale, out-of-fold metrics against the teacher's) and one MLflow run in
``superestela/A-target/final-monotone``, with data's six required tags and
data's own evaluation (``evaluate_scored``) for teacher and student.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
from types import ModuleType

import joblib
import mlflow
import numpy as np
import pandas as pd
import xgboost as xgb
from build_final_models import DATA, RUNS, prepare

ROOT = Path(__file__).resolve().parents[1]
TEACHER_RUN = RUNS / "FINAL_v1"
OUT = RUNS / "FINAL_v1_monotone"
EXPERIMENT = "superestela/A-target/final-monotone"
FOLDS = 5
SEED = 42
# The feature the rule is about, and its direction on xRV (lower is better).
MONOTONE = {"RelSpeed": -1}
MAX_ROUNDS = 600
EARLY_STOPPING = 30
VAL_FRAC = 0.1  # data's val_frac: pitchers held out for early stopping
COMPARED = (
    "calib_slope",
    "calib_slope_extreme",
    "calib_slope_sea",
    "splithalf_r_mean",
    "next_whiff_r_stuff",
    "next_rv_r_stuff",
    "xrv_vs_observed_r",
    "xrv_next_season_rv_r",
    "s6_r_dstuff_dwhiff",
    "s6_mean_dstuff",
)


def load_notebook(path: Path) -> ModuleType:
    """Import data's experiment module by path, for its parameters and its evaluation."""
    spec = importlib.util.spec_from_file_location("experimentos_stuff", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scored(oof: pd.DataFrame, xrv: np.ndarray) -> pd.DataFrame:
    """Data's ``res`` frame with another xRV, Stuff+ on the per-type scale."""
    res = oof.assign(xrv_sw=xrv, xrv_use=xrv, stuff_ref=np.nan)
    g = res.groupby("AutoPitchType")["xrv_use"]
    return res.assign(stuff=100 - 10 * (res["xrv_use"] - g.transform("mean")) / g.transform("std"))


def main() -> None:
    """Distil, evaluate against the teacher and log both to MLflow."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--notebook", type=Path, required=True)
    parser.add_argument("--tracking-db", type=Path, required=True)
    args = parser.parse_args()
    nb = load_notebook(args.notebook.resolve())

    teacher = joblib.load(ROOT / "artifacts" / "stuff_plus_final_v1.joblib")
    oof = pd.read_parquet(TEACHER_RUN / "retrained" / "FINAL_v1_folds" / "oof.parquet")
    frame = prepare(pd.read_parquet(DATA), pd.read_csv(RUNS / "runValues.csv"))
    rows = frame.drop_duplicates("pitch_id").set_index("pitch_id").loc[oof["PitchUID"]]
    # A NaN gap is a known arsenal whose reference lacks a measure: the teacher
    # reads it as missing, and the student learns to do the same.
    valid = rows[["pitcher_anon_id", "year", "environment"]].notna().all(axis=1).to_numpy()
    features = [f for f in teacher.run.features if f != "same_hand"]
    params = dict(
        nb.PARAM_SETS["base"],
        objective="reg:squarederror",
        tree_method="hist",
        eval_metric="rmse",
        monotone_constraints=str(tuple(MONOTONE.get(f, 0) for f in features)),
    )

    folds_dir = OUT / "models" / "folds"
    folds_dir.mkdir(parents=True, exist_ok=True)
    student = np.full(len(oof), np.nan)
    agreement = {}
    for pitch_type in teacher.pitch_types:
        m = (oof["AutoPitchType"] == pitch_type).to_numpy() & valid
        part = rows[m].reset_index(drop=True)
        x = teacher.features(part)[features]
        # The teacher's first five boosters are its seed-42 folds, in fold order.
        targets = teacher.xrv(part)[:FOLDS]
        fold = oof["fold"].to_numpy()[m]
        pitcher = oof["pitcher_anon_id"].to_numpy()[m]
        pred = np.full(int(m.sum()), np.nan)
        for k in range(FOLDS):
            test, train = fold == k, fold != k
            rng = np.random.default_rng(SEED + k)
            names = pd.unique(pitcher[train])
            held = set(rng.choice(names, max(1, int(len(names) * VAL_FRAC)), replace=False))
            is_val = pd.Series(pitcher[train]).isin(held).to_numpy()
            fit = xgb.DMatrix(x[train][~is_val], label=targets[k][train][~is_val])
            val = xgb.DMatrix(x[train][is_val], label=targets[k][train][is_val])
            booster = xgb.train(
                dict(params, seed=SEED + k),
                fit,
                MAX_ROUNDS,
                evals=[(val, "val")],
                early_stopping_rounds=EARLY_STOPPING,
                verbose_eval=False,
            )
            booster = booster[: booster.best_iteration + 1]
            booster.save_model(str(folds_dir / f"stuff_{pitch_type}_f{k}.json"))
            pred[test] = booster.predict(xgb.DMatrix(x[test]))
        student[m] = pred
        y = oof["xrv_use"].to_numpy()[m]
        ok = np.isfinite(y)
        agreement[pitch_type] = float(np.corrcoef(pred[ok], y[ok])[0, 1])
        print(
            f"{pitch_type}: r with the teacher's out-of-fold xRV {agreement[pitch_type]:.4f}",
            flush=True,
        )

    res_teacher = scored(oof, oof["xrv_use"].to_numpy())
    res_student = scored(oof, student)
    m_teacher, _ = nb.evaluate_scored(res_teacher, pd.DataFrame(), pd.DataFrame())
    m_student, _ = nb.evaluate_scored(res_student, pd.DataFrame(), pd.DataFrame())
    keys = ["pitcher_anon_id", "year", "AutoPitchType"]
    by_t = res_teacher.groupby(keys)["stuff"].agg(["mean", "size"])
    by_s = res_student.groupby(keys)["stuff"].mean()
    big = by_t[by_t["size"] >= 100]
    season_r = float(np.corrcoef(big["mean"], by_s.loc[big.index])[0, 1])

    stats = (
        pd.DataFrame({"AutoPitchType": oof["AutoPitchType"], "x": student})
        .groupby("AutoPitchType")["x"]
        .agg(["size", "mean", "std", "min", "max"])
        .reset_index()
    )
    stats.columns = [
        "AutoPitchType",
        "n",
        "media_xRV",
        "desviacion_xRV",
        "minimo_xRV",
        "maximo_xRV",
    ]
    stats.to_csv(OUT / "xrv_media_desviacion_por_pitch.csv", index=False)
    config = {
        "name": "FINAL_v1_monotone",
        "teacher": "FINAL_v1",
        "features_resolved": features,
        "monotone_constraints": MONOTONE,
        "params": "base",
        "objective": "reg:squarederror",
        "folds": FOLDS,
        "seed": SEED,
    }
    (OUT / "config.json").write_text(json.dumps(config, indent=2) + "\n")
    comparison = {
        "teacher": {k: m_teacher.get(k) for k in COMPARED},
        "student": {k: m_student.get(k) for k in COMPARED},
        "agreement_per_pitch_r": agreement,
        "agreement_pitcher_season_r_n100": season_r,
    }
    (OUT / "metrics.json").write_text(json.dumps(comparison, indent=2, default=float) + "\n")

    h = hashlib.sha1(DATA.read_bytes()).hexdigest()[:12]
    os.chdir(args.tracking_db.resolve().parent)  # run artifacts under ./mlruns
    mlflow.set_tracking_uri(f"sqlite:///{args.tracking_db.resolve()}")
    mlflow.set_experiment(EXPERIMENT)
    with mlflow.start_run(run_name="FINAL_v1_monotone"):
        mlflow.set_tags(
            {
                "question": "C1",
                "hypothesis": "propia: la velocidad nunca resta xRV, sin perder precision",
                "report_section": "4-modelado",
                "product_claim": "stuff-plus-significa-algo",
                "status": "candidate",
                "dataset_hash": h,
                "teacher_run": "FINAL_v1",
            }
        )
        mlflow.log_params({**{k: str(v) for k, v in config.items()}, "xgb": json.dumps(params)})
        flat = {f"student_{k}": v for k, v in comparison["student"].items() if v is not None}
        flat |= {f"teacher_{k}": v for k, v in comparison["teacher"].items() if v is not None}
        flat |= {f"agreement_r__{k}": v for k, v in agreement.items()}
        flat["agreement_pitcher_season_r_n100"] = season_r
        mlflow.log_metrics({k: float(v) for k, v in flat.items() if np.isfinite(v)})
        mlflow.log_artifacts(str(OUT), artifact_path="run")
    print(json.dumps(comparison, indent=1, default=float))


if __name__ == "__main__":
    main()
