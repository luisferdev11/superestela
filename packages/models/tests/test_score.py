"""Tests for ``python -m models.score``, the command around the harness. ADR 0009."""

import json

import pandas as pd

from models import score as cli
from models.tests.pitches import REFERENCE, raw_pitches


def test_the_command_writes_scores_and_their_provenance(model, tmp_path):
    model_path = tmp_path / "model.joblib"
    model.save(str(model_path))
    (tmp_path / "model.validation.json").write_text(
        json.dumps(
            {
                "model_id": "0.1.0+test",
                "stuff_plus_shown": True,
                "display_gates": ["S1"],
                "gates": [{"id": "S1", "passed": True}],
            }
        )
    )
    evidence = tmp_path / "evidence.json"
    reference = {"scoring_reference": {"reference_game_drag_k": REFERENCE}}
    evidence.write_text(json.dumps(reference))
    source, target = tmp_path / "pitches.csv", tmp_path / "scores.csv"
    raw_pitches().to_csv(source, index=False)

    code = cli.main(
        [str(source), str(target), "--model", str(model_path), "--evidence", str(evidence)]
    )

    assert code == 0
    scores = pd.read_csv(target)
    assert {"stuff_plus", "stuff_plus_se", "model_id"} <= set(scores.columns)
    meta = json.loads((tmp_path / "scores.csv.meta.json").read_text())
    assert meta["model_id"] == "0.1.0+test"
    assert meta["model_class"] == "models.stuff.v0_bridge.BridgeModel"
    assert meta["gates"]["status"] == "passed"
    assert meta["status"] == {"scored": len(scores)}


def test_the_command_says_when_the_gates_never_judged_this_model(model, tmp_path):
    model_path = tmp_path / "model.joblib"
    model.save(str(model_path))
    assert cli.read_verdict(model_path, model)["status"] == "not_gated"
