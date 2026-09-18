"""The delivery-level checks that a schema alone cannot express."""

import json

import pytest

from contracts import fixtures
from contracts.validate import main, validate_delivery


@pytest.fixture
def scores_parquet(tmp_path):
    path = tmp_path / "scores.parquet"
    fixtures.valid_pitch_scores().to_parquet(path)
    return path


def test_a_complete_delivery_is_accepted(scores_parquet):
    report = validate_delivery(scores_parquet, expected_pitches=500, mlflow_run="a3f9c1e")
    assert report.accepted
    assert report.n_rows == 500


def test_a_delivery_without_a_run_behind_it_is_rejected(scores_parquet):
    # CONVENTIONS.md section 8 rule 1: no number without a run.
    report = validate_delivery(scores_parquet, mlflow_run=None)
    assert not report.accepted
    assert any("MLflow" in c.name and not c.passed for c in report.checks)


def test_insufficient_coverage_is_rejected(scores_parquet):
    report = validate_delivery(scores_parquet, expected_pitches=10_000, mlflow_run="a3f9c1e")
    assert not report.accepted


def test_an_unverifiable_check_is_reported_as_skipped_not_as_passed(scores_parquet):
    # A check nobody could run must never look like a check that passed.
    report = validate_delivery(scores_parquet, expected_pitches=None, mlflow_run="a3f9c1e")
    coverage = next(c for c in report.checks if c.name == "Cobertura")
    assert coverage.skipped
    assert "omitido" in report.summary


def test_a_bad_delivery_fails_the_schema_check(tmp_path):
    path = tmp_path / "bad.parquet"
    fixtures.duplicate_pitch_ids().to_parquet(path)
    report = validate_delivery(path, mlflow_run="a3f9c1e")
    assert not report.accepted
    assert not report.checks[0].passed


def test_cli_exits_non_zero_and_writes_a_report(scores_parquet, tmp_path, capsys):
    out = tmp_path / "contract_report.json"
    code = main([str(scores_parquet), "--out", str(out)])  # no --mlflow-run
    assert code == 1
    payload = json.loads(out.read_text())
    assert payload["accepted"] is False
    assert "RECHAZADA" in payload["summary"]


def test_cli_exits_zero_for_a_complete_delivery(scores_parquet, tmp_path):
    out = tmp_path / "contract_report.json"
    code = main(
        [
            str(scores_parquet),
            "--expected-pitches",
            "500",
            "--mlflow-run",
            "a3f9c1e",
            "--out",
            str(out),
        ]
    )
    assert code == 0
    assert json.loads(out.read_text())["accepted"] is True
