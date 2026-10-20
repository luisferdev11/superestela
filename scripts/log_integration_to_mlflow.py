"""Log what the product checked about the final models to MLflow. docs/15.

    uv run python scripts/log_integration_to_mlflow.py \
        --tracking-db ../superestela-datos/mlFlow/mlflow.db

The report cites MLflow (CONVENTIONS.md 5.4 and 8.1), so the integration's
numbers go there too, one run per model in ``superestela/product/integration``:

- the build: run values rebuilt against data's, hand-neutral weights, scale;
- the verification against data's own numbers (scripts/verify_final_models.py);
- the gates S1-S7 the product shows Stuff+ by (analysis/simulator_gates.py),
  read from the verdict next to the model.

Run it after build_final_models.py, verify_final_models.py and
``regenerate.py --model``. It reads files; it computes nothing new.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

import joblib
import mlflow

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
DATA = ROOT / "data" / "stuff_model_df.parquet"
EXPERIMENT = "superestela/product/integration"


def dataset_hash(path: Path) -> str:
    """The first 12 hex of the dataset's sha1, as data's runs tag it."""
    h = hashlib.sha1()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 22), b""):
            h.update(chunk)
    return h.hexdigest()[:12]


def gate_metrics(verdict: dict[str, object]) -> dict[str, float]:
    """Each gate as pass/fail and its headline numbers, flattened for MLflow."""
    out: dict[str, float] = {}
    for g in verdict["gates"]:  # type: ignore[union-attr]
        gid = g["id"]
        out[f"gate_{gid}_passed"] = float(g["passed"])
        value = g["value"]
        if isinstance(value, (int, float)):
            out[f"gate_{gid}_value"] = float(value)
        elif isinstance(value, dict):
            for k, v in value.items():
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    out[f"gate_{gid}_{k}"] = float(v)
    out["stuff_plus_shown"] = float(bool(verdict["stuff_plus_shown"]))
    return out


def main() -> None:
    """Log one run for Stuff+ and one for Location+."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--tracking-db", type=Path, required=True)
    args = parser.parse_args()

    os.chdir(args.tracking_db.resolve().parent)  # run artifacts under ./mlruns
    mlflow.set_tracking_uri(f"sqlite:///{args.tracking_db.resolve()}")
    mlflow.set_experiment(EXPERIMENT)
    build = json.loads((ARTIFACTS / "final_models.build.json").read_text())
    verify = json.loads((ARTIFACTS / "final_models.verify.json").read_text())
    data_hash = dataset_hash(DATA)

    for kind, file, claim in (
        ("stuff", "stuff_plus_final_v1", "stuff-plus-significa-algo"),
        ("location", "location_plus_l3", "location-plus-significa-algo"),
    ):
        model = joblib.load(ARTIFACTS / f"{file}.joblib")
        record = build[kind]
        with mlflow.start_run(run_name=f"product-{file}"):
            mlflow.set_tags(
                {
                    "question": "integracion",
                    "hypothesis": "el modelo servido reproduce el entrenado por datos",
                    "report_section": "4-modelado",
                    "product_claim": claim,
                    "status": "candidate",
                    "dataset_hash": data_hash,
                    "data_run": record["run"],
                    "data_commit": build["source_commit"],
                }
            )
            mlflow.log_params(
                {
                    "model_id": model.model_id,
                    "pitch_types": ",".join(model.pitch_types),
                    "has_bands": model.has_bands,
                    "boosters_per_type": len(next(iter(model.run.boosters.values()))),
                }
            )
            checks = verify[kind]
            mlflow.log_metrics(
                {
                    "rv_gap_vs_data": float(record["rv_gap"]),
                    "pitcher_table_r": float(checks["r"]),
                    "pitcher_table_r_n100": float(checks["r_n100"]),
                    "pitcher_table_mean_abs_gap_n100": float(checks["mean_abs_gap_n100"]),
                    "rows_scored": float(checks["rows_scored"]),
                    **{
                        f"parity_{k}": float(v)
                        for k, v in verify["parity"].items()
                        if kind == "stuff"
                    },
                }
            )
            if kind == "stuff":
                verdict_path = ARTIFACTS / f"{file}.validation.json"
                if verdict_path.exists():
                    verdict = json.loads(verdict_path.read_text())
                    mlflow.log_metrics(gate_metrics(verdict))
                    mlflow.log_artifact(str(verdict_path))
                for extra in (f"{file}.tax_check.json",):
                    if (ARTIFACTS / extra).exists():
                        mlflow.log_artifact(str(ARTIFACTS / extra))
            mlflow.log_artifact(str(ARTIFACTS / "final_models.build.json"))
            mlflow.log_artifact(str(ARTIFACTS / "final_models.verify.json"))
        print(f"logged {kind}: {model.model_id}")


if __name__ == "__main__":
    main()
