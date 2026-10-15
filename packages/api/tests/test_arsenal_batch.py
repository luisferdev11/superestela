"""The translator's many-pitcher mode: grouping, both airs, whiff and the projected tax.

Files are generated here from a seed, in the dataset's format, so no row of
the dataset is ever committed (ADR 0002). The model is the toy scorer:
Stuff+ = 100 + (mph - 90) - 10 * (1 - density), with three draws one point apart.
"""

import io

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.arsenal_batch import MAX_PITCHERS, score_pitchers
from api.arsenal_file import ArsenalFileError
from api.main import app, extreme_pitches_per_inning, simulator_service, tax_validation
from api.simulator import SimulatorService
from contracts.schemas import MIN_PITCHES_FOR_SCORE
from core.density import DENSITY_INDEX_EXTREME
from models.tests.toy_scorer import ToyScorer

PPI = 18.0
TOY_DROP = 10 * (1 - DENSITY_INDEX_EXTREME)  # what the toy loses at altitude, any pitch


def league(pitchers: dict[str, tuple[int, float]], seed: int = 3, swings: bool = True) -> str:
    """A file with these pitchers: id -> (pitches, mph). Half the pitches are swings."""
    rng = np.random.default_rng(seed)
    frames = []
    for pitcher, (n, mph) in pitchers.items():
        frame = pd.DataFrame(
            {
                "pitcher_anon_id": pitcher,
                "AutoPitchType": "Four-Seam",
                "PitcherThrows": "Right",
                "RelSpeed": mph,
                "InducedVertBreak": 17 + rng.normal(0, 1, n),
                "HorzBreak": 8 + rng.normal(0, 1, n),
                "SpinRate": 2300.0,
                "SpinAxis": 210.0,
                "Extension": 6.2,
                "RelHeight": 5.9,
                "RelSide": 2.0,
            }
        )
        if swings:
            frame["is_swing"] = np.arange(n) % 2 == 0
            frame["is_whiff"] = np.arange(n) % 8 == 0
        frames.append(frame)
    return pd.concat(frames, ignore_index=True).to_csv(index=False)


def test_each_pitcher_gets_both_airs_and_the_delta():
    result = score_pitchers(league({"a": (150, 95.0), "b": (120, 88.0)}), ToyScorer(), PPI)
    by_id = {p.pitcher_id: p for p in result.pitchers}
    a = by_id["a"]
    assert a.n == 150
    assert a.stuff_plus_sea is not None and a.stuff_plus_hh is not None and a.delta is not None
    assert a.stuff_plus_sea.value == pytest.approx(105.0)
    assert a.stuff_plus_hh.value == pytest.approx(105.0 - TOY_DROP)
    assert a.delta.value == pytest.approx(-TOY_DROP)
    # The two airs share every draw: the toy's offsets cancel in the delta.
    assert a.delta.se == pytest.approx(0.0, abs=1e-9)
    assert by_id["b"].stuff_plus_sea is not None
    assert by_id["b"].stuff_plus_sea.value == pytest.approx(98.0)


def test_the_projected_tax_inverts_the_scale_into_runs_per_nine():
    result = score_pitchers(league({"a": (150, 95.0)}), ToyScorer(), PPI)
    tax = result.pitchers[0].projected_tax
    assert tax is not None
    # A drop of TOY_DROP points is TOY_DROP/10 sd of run value (sd 1 for the toy).
    assert tax.value == pytest.approx(TOY_DROP / 10 * 1.0 * 9 * PPI)
    assert tax.value > 0


def test_pitchers_below_the_minimum_are_counted_not_scored():
    few = MIN_PITCHES_FOR_SCORE - 1
    result = score_pitchers(league({"a": (150, 95.0), "b": (few, 90.0)}), ToyScorer(), PPI)
    assert [p.pitcher_id for p in result.pitchers] == ["a"]
    assert result.few_pitches == 1


def test_whiff_is_measured_in_the_file_and_needs_swings():
    result = score_pitchers(league({"a": (160, 95.0)}), ToyScorer(), PPI)
    whiff = result.pitchers[0].whiff_per_swing
    assert whiff is not None
    assert whiff[0] == pytest.approx(20 / 80)  # every 8th pitch over every 2nd
    without = score_pitchers(league({"a": (160, 95.0)}, swings=False), ToyScorer(), PPI)
    assert without.pitchers[0].whiff_per_swing is None
    assert without.has_swings is False


def test_without_a_shown_model_only_counts_and_whiff_come_back():
    result = score_pitchers(league({"a": (150, 95.0)}), None, PPI)
    p = result.pitchers[0]
    assert p.stuff_plus_sea is None and p.projected_tax is None
    assert p.whiff_per_swing is not None


def test_a_file_without_the_pitcher_id_is_refused_by_name():
    csv = pd.read_csv(io.StringIO(league({"a": (150, 95.0)}))).drop(columns=["pitcher_anon_id"])
    with pytest.raises(ArsenalFileError) as caught:
        score_pitchers(csv.to_csv(index=False), ToyScorer(), PPI)
    assert caught.value.code == "missing_columns"
    assert caught.value.columns == ("pitcher_anon_id",)


def test_too_many_pitchers_is_a_batch_job_not_a_screen():
    ids = {f"p{i}": (1, 90.0) for i in range(MAX_PITCHERS + 1)}
    with pytest.raises(ArsenalFileError) as caught:
        score_pitchers(league(ids), ToyScorer(), PPI)
    assert caught.value.code == "too_many_pitchers"


def test_endpoint_returns_one_row_per_pitcher_in_camel_case():
    service = SimulatorService(ToyScorer(), None, {}, {})
    app.dependency_overrides[simulator_service] = lambda: service
    app.dependency_overrides[extreme_pitches_per_inning] = lambda: PPI
    app.dependency_overrides[tax_validation] = lambda: None
    try:
        res = TestClient(app).post(
            "/api/v1/arsenals/score", json={"csv": league({"a": (150, 95.0)})}
        )
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200
    body = res.json()
    assert body["stuffPlusShown"] and body["modelId"] == ToyScorer.model_id
    row = body["pitchers"][0]
    assert set(row) >= {"pitcherId", "stuffPlusSea", "stuffPlusHh", "projectedTax", "whiffPerSwing"}
    assert body["minPitches"] == MIN_PITCHES_FOR_SCORE


def test_endpoint_hides_scores_when_the_model_is_not_shown():
    service = SimulatorService(ToyScorer(), "gates_failed", {}, {})
    app.dependency_overrides[simulator_service] = lambda: service
    app.dependency_overrides[extreme_pitches_per_inning] = lambda: PPI
    app.dependency_overrides[tax_validation] = lambda: None
    try:
        body = (
            TestClient(app)
            .post("/api/v1/arsenals/score", json={"csv": league({"a": (150, 95.0)})})
            .json()
        )
    finally:
        app.dependency_overrides.clear()
    assert body["stuffPlusShown"] is False and body["stuffPlusReason"] == "gates_failed"
    assert body["pitchers"][0]["stuffPlusSea"] is None
