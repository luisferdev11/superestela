"""Score a file of pitches from the command line. ADR 0009.

    uv run python -m models.score pitches.csv scores.csv
    uv run python -m models.score pitches.parquet scores.csv --model artifacts/other.joblib

The input has the dataset's columns (``RelSpeed``, ``InducedVertBreak``, ...;
``docs/reference/stuff_plus_data_dictionary.csv``). The output has one row per
input row: ``pitch_id, stuff_plus, stuff_plus_se, status, density_index,
density_source, model_id``. Next to it, ``<output>.meta.json`` records which
model answered, whether it passed the gates, and how many rows got a score,
so a result can always be traced back to the model that produced it.

This command is the harness and never changes when the model does. The model
is whatever ``--model`` points to: a joblib file holding an object that
satisfies ``models.scoring.Scorer``. Today that is the v0 bridge fitted by
``analysis/simulator_gates.py``; the data team's final model plugs in by
saving its own ``Scorer`` the same way. Who owns what is ADR 0009.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from models.batch import MissingColumnsError, score_frame
from models.scoring import Scorer, verdict_path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = ROOT / "artifacts" / "stuff_plus_v0_bridge.joblib"
DEFAULT_EVIDENCE = ROOT / "analysis" / "outputs" / "evidence.json"


def load_scorer(path: Path) -> Scorer:
    """Read a fitted model and check that it answers the scoring contract."""
    model = joblib.load(path)
    if not isinstance(model, Scorer):
        raise TypeError(f"{path} does not hold a models.scoring.Scorer")
    return model


def read_verdict(model_path: Path, model: Scorer) -> dict[str, Any]:
    """The gates' verdict written next to the model, if it judged this very fit."""
    try:
        verdict = dict(json.loads(Path(verdict_path(str(model_path))).read_text()))
    except FileNotFoundError:
        return {"status": "not_gated", "reason": "no verdict next to the model"}
    if verdict.get("model_id") != model.model_id:
        return {"status": "not_gated", "reason": "the verdict is for a different fit"}
    return {
        "status": "passed" if verdict.get("stuff_plus_shown") else "failed",
        "display_gates": verdict.get("display_gates"),
        "gates": {g["id"]: g["passed"] for g in verdict.get("gates", [])},
    }


def read_frame(path: Path) -> pd.DataFrame:
    """Read a CSV or a parquet file, by extension."""
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path)


def main(argv: list[str] | None = None) -> int:
    """Score the input file and write the scores and their provenance."""
    parser = argparse.ArgumentParser(prog="python -m models.score", description=__doc__)
    parser.add_argument("input", type=Path, help="CSV or parquet with the dataset's columns")
    parser.add_argument("output", type=Path, help="where to write the scores (.csv or .parquet)")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL, help="a fitted Scorer")
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    if not args.model.exists():
        print(
            f"No model at {args.model}. Fit the v0 bridge with "
            "`uv run python analysis/simulator_gates.py`, or pass --model.",
            file=sys.stderr,
        )
        return 2
    model = load_scorer(args.model)
    verdict = read_verdict(args.model, model)
    evidence = json.loads(args.evidence.read_text())
    reference = float(evidence["scoring_reference"]["reference_game_drag_k"])

    raw = read_frame(args.input)
    try:
        scores = score_frame(raw, model, reference)
    except MissingColumnsError as err:
        print(f"Cannot score {args.input}: {err}.", file=sys.stderr)
        return 2

    if args.output.suffix == ".parquet":
        scores.to_parquet(args.output, index=False)
    else:
        scores.to_csv(args.output, index=False)

    status_counts = {str(k): int(v) for k, v in scores["status"].value_counts().items()}
    meta = {
        "model_file": str(args.model),
        "model_class": f"{type(model).__module__}.{type(model).__qualname__}",
        "model_id": model.model_id,
        "model_sha256": hashlib.sha256(args.model.read_bytes()).hexdigest(),
        "scale": model.scale.description,
        "uses_arsenal": model.uses_arsenal,
        "gates": verdict,
        "input_file": str(args.input),
        "input_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
        "rows": len(scores),
        "status": status_counts,
        "density_source": scores["density_source"].value_counts().to_dict(),
        "scored_at": datetime.now(UTC).isoformat(timespec="seconds"),
    }
    meta_path = args.output.with_name(args.output.name + ".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")

    scored = status_counts.get("scored", 0)
    print(f"Model: {meta['model_class']} {model.model_id} (gates: {verdict['status']})")
    print(f"Scored {scored} of {len(scores)} rows -> {args.output}")
    print(f"Provenance -> {meta_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
