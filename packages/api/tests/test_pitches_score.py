"""POST /api/v1/pitches/score: data's final Stuff+ and Location+, each on its own inputs.

The models are FINAL_v1- and L3-shaped toys fitted to noise
(models/tests/data_runs.py), so these pin the endpoint's mechanics: what
each model needs, what comes back when something is missing, and that a
model without fold boosters returns no band rather than a made-up one.
"""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from api.main import app, location_scorer, simulator_service
from api.simulator import SimulatorService
from models.tests.data_runs import toy_location, toy_stuff

ARSENAL = [
    {
        "pitchType": "Four-Seam",
        "usage": 0.6,
        "releaseSpeed": 94.0,
        "ivb": 16.0,
        "horizontalBreak": 8.0,
        "releaseHeight": 5.9,
        "releaseSide": 1.9,
    },
    {
        "pitchType": "Slider",
        "usage": 0.4,
        "releaseSpeed": 85.0,
        "ivb": 2.0,
        "horizontalBreak": -5.0,
        "releaseHeight": 5.8,
        "releaseSide": 1.8,
    },
]


def slider(**changes: Any) -> dict[str, Any]:
    pitch = {
        "pitchId": "a",
        "pitchType": "Slider",
        "pitcherHand": "Right",
        "batterHand": "Left",
        "releaseSpeed": 85.0,
        "spinRate": 2500.0,
        "spinAxis": 90.0,
        "ivb": 2.0,
        "horizontalBreak": -5.0,
        "extension": 6.2,
        "releaseHeight": 5.8,
        "releaseSide": 1.8,
        "plateHeight": 1.9,
        "plateSide": 0.7,
        "balls": 1,
        "strikes": 2,
    }
    return {**pitch, **changes}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    stuff = toy_stuff(tmp_path / "FINAL")
    location = toy_location(tmp_path / "L3")
    app.dependency_overrides[simulator_service] = lambda: SimulatorService(stuff, None, {}, {})
    app.dependency_overrides[location_scorer] = lambda: location
    yield TestClient(app)
    app.dependency_overrides.clear()


def post(client: TestClient, **body: Any) -> Any:
    return client.post("/api/v1/pitches/score", json=body)


def test_a_complete_pitch_gets_both_scores_and_the_models_behind_them(client):
    res = post(client, pitches=[slider()], arsenal=ARSENAL)
    assert res.status_code == 200
    body = res.json()
    row = body["pitches"][0]
    assert row["stuffPlus"]["status"] == "scored" and row["locationPlus"]["status"] == "scored"
    # One booster per type: a value, and no band instead of an invented one.
    assert row["stuffPlus"]["score"]["se"] is None
    assert body["stuffModel"]["run"] == "FINAL" and body["stuffModel"]["hasBands"] is False
    assert "plateSide" in body["locationModel"]["required"]
    assert "releaseSpeed" not in body["locationModel"]["required"]
    assert row["analysis"]["locAbsSide"] == pytest.approx(0.7)


def test_a_column_no_pitch_has_is_named_for_the_model_that_needs_it(client):
    res = post(client, pitches=[slider(plateSide=None)], arsenal=ARSENAL)
    assert res.status_code == 422
    assert res.json() == {"error": "missing_columns", "model": "location", "columns": ["plateSide"]}


def test_a_pitch_missing_its_location_still_gets_its_stuff(client):
    res = post(client, pitches=[slider(), slider(pitchId="b", plateSide=None)], arsenal=ARSENAL)
    second = res.json()["pitches"][1]
    assert second["locationPlus"] == {
        "status": "missing_features",
        "score": None,
        "missing": ["plateSide"],
    }
    assert second["stuffPlus"]["status"] == "scored"


def test_without_an_arsenal_or_a_pitcher_the_stuff_model_says_what_it_lacks(client):
    row = post(client, pitches=[slider()]).json()["pitches"][0]
    assert row["stuffPlus"] == {
        "status": "missing_arsenal",
        "score": None,
        "missing": ["arsenal", "pitcherId"],
    }
    assert row["locationPlus"]["status"] == "scored"


def test_the_requests_own_pitches_are_the_arsenal_when_they_name_their_pitcher(client):
    fastball = slider(
        pitchId="ff", pitchType="Four-Seam", releaseSpeed=94.0, ivb=16.0, horizontalBreak=8.0
    )
    pitches = [fastball | {"pitcherId": "p"}, slider(pitcherId="p")]
    rows = post(client, pitches=pitches).json()["pitches"]
    assert rows[1]["stuffPlus"]["status"] == "scored"
    assert rows[0]["stuffPlus"]["status"] == "unsupported_pitch_type"  # the toy knows sliders only


def test_a_type_the_models_never_saw_is_not_scored(client):
    row = post(client, pitches=[slider(pitchType="Splitter")], arsenal=ARSENAL).json()["pitches"][0]
    assert row["stuffPlus"]["status"] == "unsupported_pitch_type"
    assert row["locationPlus"]["status"] == "unsupported_pitch_type"


def test_a_mirrored_left_hander_gets_the_right_handers_stuff(client):
    rows = post(
        client, pitches=[slider(), slider(pitchId="b", pitcherHand="Left")], arsenal=ARSENAL
    ).json()["pitches"]
    assert rows[0]["stuffPlus"]["score"] == rows[1]["stuffPlus"]["score"]


def test_asking_for_one_model_leaves_the_other_out(client):
    body = post(client, pitches=[slider(releaseSpeed=None)], models=["location"]).json()
    assert body["stuffModel"] is None and body["pitches"][0]["stuffPlus"] is None
    assert body["pitches"][0]["locationPlus"]["status"] == "scored"


def test_an_unknown_batter_side_is_said_not_guessed(client):
    row = post(client, pitches=[slider(batterHand="Switch")], arsenal=ARSENAL).json()["pitches"][0]
    assert row["locationPlus"]["status"] == "unknown_hand"
