"""Tests for report/build.py: the matrix refuses a claim without a run."""

import pytest

from report.build import build, load_artifacts
from report.matrix import (
    BrokenClaimError,
    Claim,
    load_claims,
    matches,
    resolve,
    verify,
)

ARTIFACTS = {
    "evidence.json": {"density": {"Extreme Altitude": {"per_game_mean": 0.8577}}},
    "simulator_validation.json": {"gates": [{"id": "S7", "passed": False}]},
}


def claim(**fields):
    base = dict(id="c", text="t", section="§3", source="evidence.json")
    return Claim(**{**base, **fields})


def test_a_claim_that_matches_its_artifact_to_the_quoted_digits_passes():
    ok = claim(
        path=("density", "Extreme Altitude", "per_game_mean"), value="0.858", text="densidad 0.858"
    )
    [(_, state, shown)] = verify([ok], ARTIFACTS)
    assert state == "ok"
    assert shown == "0.8577"


def test_a_claim_whose_number_moved_fails_the_build():
    stale = claim(
        path=("density", "Extreme Altitude", "per_game_mean"), value="0.85", text="densidad 0.85"
    )
    with pytest.raises(BrokenClaimError, match=r"the document says 0\.85"):
        verify([stale], ARTIFACTS)


def test_a_claim_without_a_source_in_the_artifact_fails_the_build():
    orphan = claim(path=("density", "Low Altitude", "per_game_mean"), value="0.9", text="0.9")
    with pytest.raises(BrokenClaimError, match="Low Altitude"):
        verify([orphan], ARTIFACTS)


def test_a_claim_that_declares_what_it_awaits_is_listed_not_failed():
    pending = claim(source=None, awaits="A3")
    [(_, state, shown)] = verify([pending], ARTIFACTS)
    assert state == "pending"
    assert "A3" in shown


def test_a_list_step_picks_the_element_by_its_key():
    assert resolve(ARTIFACTS["simulator_validation.json"], ["gates", "id=S7", "passed"]) is False


def test_matches_compares_at_the_precision_the_document_quotes():
    assert matches("0.003", 0.00283)
    assert not matches("0.0028", 0.00291)
    assert matches("56", 56.06)  # "56%" is still true of 56.06
    assert matches("2.68", 2.675)  # half up, not binary rounding
    assert matches("268", 268)
    assert matches("REFUTED", "REFUTED")


def test_a_bool_only_matches_a_bool():
    # In Python True == 1: a gate that failed must not pass as 0.
    assert matches(False, False)
    assert not matches(False, 0)
    assert not matches(True, 1.0)


def test_a_claim_whose_text_does_not_quote_its_number_fails():
    lying = claim(path=("density", "Extreme Altitude", "per_game_mean"), value="0.858", text="t")
    with pytest.raises(BrokenClaimError, match="does not quote"):
        verify([lying], ARTIFACTS)


def test_a_list_step_that_matches_two_elements_is_refused():
    twice = {"gates": [{"id": "S7"}, {"id": "S7"}]}
    with pytest.raises(KeyError):
        resolve(twice, ["gates", "id=S7"])


def test_every_claim_of_the_document_holds_against_the_committed_artifacts():
    # The real check CI runs: the claims file against analysis/outputs.
    files = build(load_artifacts(), load_claims())
    assert "trazabilidad.md" in files
    assert all(text.startswith("# ") for text in files.values())
