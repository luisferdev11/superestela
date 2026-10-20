"""Package data's final runs as models the product can load. docs/14.

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
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from contracts.mapping import normalize_columns
from models import outcomes
from models.features.arsenal import frame_differentials
from models.location import final as location
from models.runs import read_run
from models.scoring import ScaleSpec
from models.stuff import final as stuff

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "stuff_model_df.parquet"
RUNS = ROOT / "artifacts" / "data-runs"

# The tails data clipped the arsenal features to (experimentos_stuff.py line 239).
CLIP_QUANTILES = (0.001, 0.999)
# How close the rebuilt run values must be to data's rv_values.csv.
RV_TOLERANCE = 1e-6
HANDS = ("Right", "Left")


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
    frame: pd.DataFrame, path: Path, sha: str
) -> tuple[stuff.FinalStuffScorer, dict[str, object]]:
    """Package FINAL_v1 with the clip quantiles and hand-neutral weights it needs."""
    run = read_run(str(path), stuff.CLASSES)
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
    model = stuff.FinalStuffScorer(
        model_id=f"1.0.0+{sha}", scale=scale, pitch_types=types, run=run, p_same=p_same, clip=clip
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
    )
    rows = frame[frame["base_ok"] & frame["pitch_type"].isin(types)]
    xrv = pd.Series(model.xrv(rows).mean(axis=0), index=rows.index)
    stats = xrv.groupby(rows["pitch_type"]).agg(["mean", "std", "size"])
    model.scale = {t: (float(stats.loc[t, "mean"]), float(stats.loc[t, "std"])) for t in types}
    return model, {
        "run": run.name,
        "has_folds": run.has_folds,
        "rv_gap": rv_gap,
        "rv_by_count": by_count.round(6).tolist(),
        "scale": {
            t: {"mean": m, "sd": s, "n": int(stats.loc[t, "size"])}
            for t, (m, s) in model.scale.items()
        },
    }


def main() -> None:
    """Build both models and write them with the record of what was computed."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--runs", type=Path, default=RUNS)
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()

    sha = (args.runs / "SOURCE_COMMIT").read_text().strip()
    frame = prepare(pd.read_parquet(DATA), pd.read_csv(args.runs / "runValues.csv"))
    stuff_model, stuff_record = build_stuff(frame, args.runs / "FINAL_v1", sha)
    location_model, location_record = build_location(frame, args.runs / "L3_loc_count_hand", sha)

    joblib.dump(stuff_model, args.out / "stuff_plus_final_v1.joblib")
    joblib.dump(location_model, args.out / "location_plus_l3.joblib")
    record = {
        "source_commit": sha,
        "rows": len(frame),
        "stuff": stuff_record,
        "location": location_record,
    }
    (args.out / "final_models.build.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({k: v for k, v in record.items() if k != "location"}, indent=2)[:2000])
    print(json.dumps(location_record["scale"], indent=2))


if __name__ == "__main__":
    main()
