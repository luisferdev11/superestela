"""Package data's final runs as models the product can load. docs/15.

    uv run python scripts/build_final_models.py                  # artifacts/data-runs -> artifacts/

Reads the run folders data handed over (``FINAL_v1`` for Stuff+,
``L3_loc_count_hand`` for Location+; copy them into ``artifacts/data-runs/``)
and the dataset, and writes:

- ``artifacts/stuff_plus_final_v1.joblib``: a ``models.scoring.Scorer``.
- ``artifacts/location_plus_l3.joblib``: a ``models.location.final.FinalLocationScorer``.
- ``artifacts/final_models.build.json``: what was computed here and the checks.

Nothing is trained here. What the runs lack, and the product must rebuild
from the data exactly as data's notebook did, is:

- the training 0.1% / 99.9% quantiles that clip the fastball differentials;
- the share of same-side batters per type, the hand-neutral weights;
- for Location+, the run value of each class by count and the mean and sd
  of the xRV per type (data handed over only Stuff+'s).

The run values are rebuilt from scratch and compared with the ``rv_values.csv``
of both runs: if the port of data's outcome classes were wrong, they would
not match, and the build stops.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import replace
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

from contracts.mapping import normalize_columns
from models import outcomes
from models.features.arsenal import frame_differentials
from models.location import final as location
from models.runs import DataRun, read_run
from models.scoring import ScaleSpec
from models.stuff import final as stuff
from models.stuff.monotone import MonotoneStuffScorer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "stuff_model_df.parquet"
RUNS = ROOT / "artifacts" / "data-runs"

# The tails data clipped the arsenal features to (experimentos_stuff.py line 239).
CLIP_QUANTILES = (0.001, 0.999)
# How close the rebuilt run values must be to data's rv_values.csv.
RV_TOLERANCE = 1e-6
HANDS = ("Right", "Left")

# The metrics the API shows to compare runs, higher is better for every one
# but next_rv_r_stuff, where more negative is better: delta_run_exp is the
# batter's, so a better Stuff+ predicts fewer runs (docs/15).
COMPARED = {
    "calib_slope": "higher",
    "splithalf_r_mean": "higher",
    "next_whiff_r_stuff": "higher",
    "next_rv_r_stuff": "lower",
    "xrv_next_season_rv_r": "higher",
    "s6_r_dstuff_dwhiff": "higher",
    "auc_whiff": "higher",
}
STUFF_CANDIDATES = ("FINAL_v1", "FIN_B_all8", "FIN_C_allcq")
SEEDS_NOTE = (
    " La validación cruzada se repitió con {n} semillas (5 folds cada una): su promedio es el "
    "Stuff+, como las 20 bolsas del puente v0."
)
FOLDS_NOTE = (
    " La banda es la dispersión entre los boosters de la validación cruzada, re-entrenados con "
    "el código y la configuración de datos (scripts/retrain_final_folds.py, registrado en MLflow)."
)


def candidates(runs: Path, names: tuple[str, ...]) -> list[dict[str, object]]:
    """Each run's configuration and the metrics that compare runs with different targets."""
    out = []
    for name in names:
        if not (runs / name).exists():
            continue
        config = json.loads((runs / name / "config.json").read_text())
        metrics = json.loads((runs / name / "metrics.json").read_text())
        out.append(
            {
                "run": name,
                "target": config["target"],
                "features": config["features"],
                "status": config["status"],
                "metrics": {k: round(float(metrics[k]), 4) for k in COMPARED if k in metrics},
            }
        )
    return out


def leads(chosen: str, rivals: list[dict[str, object]]) -> list[str]:
    """The comparison metrics on which the chosen run is the best of the candidates."""
    best = []
    for k, better in COMPARED.items():
        values = {str(c["run"]): c["metrics"].get(k) for c in rivals}  # type: ignore[union-attr]
        if any(v is None for v in values.values()):
            continue
        pick = (max if better == "higher" else min)(values, key=lambda r: values[r])
        if pick == chosen:
            best.append(k)
    return best


def prepare(raw: pd.DataFrame, run_values: pd.DataFrame) -> pd.DataFrame:
    """Return the canonical training frame with outcomes, run values and arm-side shapes."""
    events = outcomes.event_type(raw)
    frame = normalize_columns(raw).assign(
        delta_run_exp=outcomes.delta_run_exp(raw, events, run_values),
        swing_class=outcomes.swing_quality_class(raw, events),
        pitch_class=outcomes.every_pitch_class(events),
    )
    for c in ("pitch_type", "pitcher_hand", "batter_hand", "environment"):
        frame[c] = frame[c].astype(object)
    # data mirrors anything that is not "Left" as a right-hander; those rows
    # fail the hand check below and are never scored, but count for the arsenal.
    sign = np.where(frame["pitcher_hand"] == "Left", -1.0, 1.0)
    axis = frame["spin_axis"].to_numpy(dtype=float)
    frame = frame.assign(
        horizontal_break=frame["horizontal_break"] * sign,
        release_side=frame["release_side"] * sign,
        spin_axis=np.where(sign < 0, (360.0 - axis) % 360.0, axis),
        same_hand=(frame["pitcher_hand"] == frame["batter_hand"]).astype(float),
    )
    frame = frame.join(frame_differentials(frame))
    hands = frame["pitcher_hand"].isin(HANDS) & frame["batter_hand"].isin(HANDS)
    core = frame[["release_speed", "ivb", "horizontal_break"]].notna().all(axis=1)
    return frame.assign(base_ok=hands & core)


def check_run_values(name: str, ours: np.ndarray, path: Path) -> float:
    """Compare a rebuilt neutral run value with data's; stop the build if they differ."""
    theirs = pd.read_csv(path, index_col=0).iloc[:, 0].to_numpy(dtype=float)
    gap = float(np.abs(ours - theirs).max())
    if gap > RV_TOLERANCE:
        raise SystemExit(f"{name}: rebuilt run values differ from data's by {gap:.2e}")
    return gap


def build_stuff(
    frame: pd.DataFrame, path: Path, sha: str, seeds: tuple[int, ...] = ()
) -> tuple[stuff.FinalStuffScorer, dict[str, object]]:
    """Package FINAL_v1 with the clip quantiles and hand-neutral weights it needs.

    ``seeds`` adds the fold boosters of the same run repeated with other seeds
    (``<run>_seed<n>``, scripts/retrain_final_folds.py): more draws, the same
    model, a smoother average (gate S1, docs/15).
    """
    run = read_run(str(path), stuff.CLASSES)
    for seed in seeds:
        extra = read_run(str(path.parent / f"{path.name}_seed{seed}"), stuff.CLASSES)
        run = replace(
            run,
            boosters={t: run.boosters[t] + extra.boosters[t] for t in run.boosters},
        )
    neutral, _ = outcomes.run_value_table(
        frame["swing_class"],
        frame["delta_run_exp"],
        frame["balls"],
        frame["strikes"],
        stuff.CLASSES,
    )
    rv_gap = check_run_values(run.name, neutral, path / "rv_values.csv")

    types = tuple(sorted(run.boosters))
    clip: dict[str, dict[str, tuple[float, float]]] = {}
    for ours, theirs in stuff.DIFF_FEATURES.items():
        q = frame.groupby("pitch_type")[ours].quantile(list(CLIP_QUANTILES)).unstack()  # noqa: PD010
        for t in types:
            clip.setdefault(t, {})[theirs] = (
                float(q.loc[t, CLIP_QUANTILES[0]]),
                float(q.loc[t, CLIP_QUANTILES[1]]),
            )
    trained = frame["base_ok"] & frame["swing_class"].notna() & frame["delta_run_exp"].notna()
    p_same = {
        t: float(frame.loc[trained & (frame["pitch_type"] == t), "same_hand"].mean()) for t in types
    }

    oof = pd.read_csv(path / "xrv_media_desviacion_por_pitch.csv").set_index("AutoPitchType")
    by_type = {
        t: (float(oof.loc[t, "media_xRV"]), float(oof.loc[t, "desviacion_xRV"])) for t in types
    }
    w = oof.loc[list(types), "n"].to_numpy(dtype=float)
    scale = ScaleSpec(
        description=(
            "100 = el pitch promedio de su tipo en la liga (xRV fuera de fold de FINAL_v1); "
            "10 puntos = una desviación estándar del xRV del tipo"
        ),
        mean_xrv=float(np.average(oof.loc[list(types), "media_xRV"], weights=w)),
        sd_xrv=float(np.average(oof.loc[list(types), "desviacion_xRV"], weights=w)),
        kind="league",
        by_type=by_type,
    )
    rivals = candidates(path.parent, STUFF_CANDIDATES)
    provenance = {
        "run": run.name,
        "data_commit": sha,
        "selection": (
            "Elegido por el equipo de datos el 19 de octubre como modelo principal. Entre los "
            f"candidatos es el mejor en: {', '.join(leads(run.name, rivals))}."
            + (FOLDS_NOTE if run.has_folds else "")
            + (SEEDS_NOTE.format(n=1 + len(seeds)) if seeds else "")
        ),
        "candidates": rivals,
    }
    model = stuff.FinalStuffScorer(
        model_id=f"1.0.0+{sha}",
        scale=scale,
        pitch_types=types,
        run=run,
        p_same=p_same,
        clip=clip,
        provenance=provenance,
    )
    return model, {
        "run": run.name,
        "has_folds": run.has_folds,
        "rv_gap": rv_gap,
        "p_same": p_same,
        "clip": clip,
    }


def build_location(
    frame: pd.DataFrame, path: Path, sha: str
) -> tuple[location.FinalLocationScorer, dict[str, object]]:
    """Package L3 with the run values by count and the scale data did not hand over."""
    run = read_run(str(path), location.CLASSES)
    neutral, by_count = outcomes.run_value_table(
        frame["pitch_class"],
        frame["delta_run_exp"],
        frame["balls"],
        frame["strikes"],
        location.CLASSES,
    )
    rv_gap = check_run_values(run.name, neutral, path / "rv_values.csv")
    types = tuple(sorted(run.boosters))
    model = location.FinalLocationScorer(
        model_id=f"1.0.0+{sha}",
        pitch_types=types,
        run=run,
        rv_by_count=by_count,
        scale={t: (0.0, 1.0) for t in types},
        scale_description=(
            "100 = la ubicación promedio de su tipo en la liga (xRV del modelo final L3 sobre "
            "los lanzamientos de entrenamiento); 10 puntos = una desviación estándar"
        ),
        provenance={
            "run": run.name,
            "data_commit": sha,
            "selection": (
                "Elegido por el equipo de datos el 19 de octubre (el único Location+ con modelos "
                "guardados). Describe cómo ubicó un lanzador; no proyecta: split-half 0.53 y "
                "sin correlación con las carreras de la temporada siguiente."
                + (FOLDS_NOTE if run.has_folds else "")
            ),
            "candidates": candidates(path.parent, (run.name,)),
        },
    )
    oof = path / "xrv_media_desviacion_por_pitch.csv"
    if oof.exists():
        # Out of fold, from the run itself (scripts/retrain_final_folds.py), as FINAL_v1's.
        table = pd.read_csv(oof).set_index("AutoPitchType")
        stats = table.rename(columns={"media_xRV": "mean", "desviacion_xRV": "std", "n": "size"})
        source = "out of fold"
    else:
        # Fallback: the final booster on its own training rows (optimistic, docs/15).
        rows = frame[frame["base_ok"] & frame["pitch_type"].isin(types)]
        xrv = pd.Series(model.xrv(rows).mean(axis=0), index=rows.index)
        stats = xrv.groupby(rows["pitch_type"]).agg(["mean", "std", "size"])
        source = "final booster, in sample"
    model.scale = {t: (float(stats.loc[t, "mean"]), float(stats.loc[t, "std"])) for t in types}
    if source == "out of fold":
        model.scale_description = model.scale_description.replace(
            "xRV del modelo final L3 sobre los lanzamientos de entrenamiento",
            "xRV fuera de fold de L3",
        )
    return model, {
        "run": run.name,
        "has_folds": run.has_folds,
        "rv_gap": rv_gap,
        "rv_by_count": by_count.round(6).tolist(),
        "scale_source": source,
        "scale": {
            t: {"mean": m, "sd": s, "n": int(stats.loc[t, "size"])}
            for t, (m, s) in model.scale.items()
        },
    }


def build_monotone(
    teacher: stuff.FinalStuffScorer, path: Path
) -> tuple[MonotoneStuffScorer, dict[str, object]]:
    """Package the distilled FINAL_v1 (scripts/distill_monotone.py) on the teacher's features.

    The clip quantiles and the arsenal rule are the teacher's; the boosters
    are the five fold regressors and the scale their out-of-fold xRV.
    """
    config = json.loads((path / "config.json").read_text())
    boosters: dict[str, tuple[xgb.Booster, ...]] = {}
    for t in teacher.pitch_types:
        loaded = []
        for k in range(int(config["folds"])):
            b = xgb.Booster()
            b.load_model(str(path / "models" / "folds" / f"stuff_{t}_f{k}.json"))
            loaded.append(b)
        boosters[t] = tuple(loaded)
    run = DataRun(
        name=str(config["name"]),
        features=tuple(config["features_resolved"]),
        classes=(),
        boosters=boosters,
        rv_neutral=(),
        has_folds=True,
    )
    oof = pd.read_csv(path / "xrv_media_desviacion_por_pitch.csv").set_index("AutoPitchType")
    by_type = {
        t: (float(oof.loc[t, "media_xRV"]), float(oof.loc[t, "desviacion_xRV"]))
        for t in teacher.pitch_types
    }
    w = oof.loc[list(teacher.pitch_types), "n"].to_numpy(dtype=float)
    metrics = json.loads((path / "metrics.json").read_text())
    scale = ScaleSpec(
        description=(
            "100 = el pitch promedio de su tipo en la liga (xRV fuera de fold del modelo final "
            "con la regla de velocidad); 10 puntos = una desviación estándar del xRV del tipo"
        ),
        mean_xrv=float(np.average(oof.loc[list(teacher.pitch_types), "media_xRV"], weights=w)),
        sd_xrv=float(np.average(oof.loc[list(teacher.pitch_types), "desviacion_xRV"], weights=w)),
        kind="league",
        by_type=by_type,
    )
    provenance = {
        **dict(teacher.provenance),
        "run": run.name,
        "selection": (
            "FINAL_v1 (elegido por datos) destilado con una regla: más velocidad nunca resta "
            "Stuff+ (restricción monótona de XGBoost sobre RelSpeed). Sin la regla, en 14.7% "
            "de las rectas reales +1 mph bajaba su Stuff+ (compuerta S1). Con ella, en la "
            "evaluación de datos empata o mejora a FINAL_v1; coincide con él en r "
            f"{metrics['agreement_pitcher_season_r_n100']:.2f} por lanzador, temporada y tipo. "
            "La banda es la dispersión entre los 5 regresores por fold (docs/15 §6)."
        ),
    }
    major, minor, _ = teacher.model_id.split("+")[0].split(".")
    model = MonotoneStuffScorer(
        model_id=f"{major}.{int(minor) + 1}.0+{teacher.model_id.split('+')[1]}",
        scale=scale,
        pitch_types=teacher.pitch_types,
        run=run,
        p_same=teacher.p_same,
        clip=teacher.clip,
        provenance=provenance,
    )
    return model, {"run": run.name, "has_folds": True, "metrics": metrics}


def main() -> None:
    """Build both models and write them with the record of what was computed."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--runs", type=Path, default=RUNS)
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--seeds", type=int, nargs="*", default=[], help="extra FINAL_v1 seeds")
    args = parser.parse_args()

    sha = (args.runs / "SOURCE_COMMIT").read_text().strip()
    frame = prepare(pd.read_parquet(DATA), pd.read_csv(args.runs / "runValues.csv"))
    stuff_model, stuff_record = build_stuff(frame, args.runs / "FINAL_v1", sha, tuple(args.seeds))
    location_model, location_record = build_location(frame, args.runs / "L3_loc_count_hand", sha)

    joblib.dump(stuff_model, args.out / "stuff_plus_final_v1.joblib")
    joblib.dump(location_model, args.out / "location_plus_l3.joblib")
    monotone_record = None
    if (args.runs / "FINAL_v1_monotone" / "config.json").exists():
        monotone_model, monotone_record = build_monotone(
            stuff_model, args.runs / "FINAL_v1_monotone"
        )
        joblib.dump(monotone_model, args.out / "stuff_plus_final_v1_monotone.joblib")
    record = {
        "source_commit": sha,
        "rows": len(frame),
        "stuff": stuff_record,
        "location": location_record,
        "monotone": monotone_record,
    }
    (args.out / "final_models.build.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({k: v for k, v in record.items() if k != "location"}, indent=2)[:2000])
    print(json.dumps(location_record["scale"], indent=2))


if __name__ == "__main__":
    main()
