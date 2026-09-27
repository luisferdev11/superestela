"""Endpoint tests: happy path, validation error and empty result (CONVENTIONS.md 7.4).

The evidence is the committed simulator.json and arsenals.json, which are
aggregates, not data. The model is a small bridge fitted on a seeded synthetic
frame, so these tests run in CI without the dataset.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app, simulator_service
from api.simulator import SimulatorService, load_service
from models.stuff.v0_bridge import PITCH_TYPES, BridgeModel, fit_bridge

OUTPUTS = Path(__file__).resolve().parents[3] / "analysis" / "outputs"
EVIDENCE = json.loads((OUTPUTS / "simulator.json").read_text())
ARSENALS = json.loads((OUTPUTS / "arsenals.json").read_text())

# The league-average sea-level four-seam, simulator.json -> distributions (p50).
FOUR_SEAM = {
    "pitchType": "Four-Seam",
    "pitcherHand": "Right",
    "releaseSpeed": 91.7,
    "ivb": 17.2,
    "horizontalBreak": 9.7,
    "spinRate": 2330.0,
    "spinAxis": 211.0,
    "extension": 6.0,
    "releaseHeight": 5.95,
    "releaseSide": 1.6,
}
CHANGEUP = {
    **FOUR_SEAM,
    "pitchType": "Changeup",
    "releaseSpeed": 83.7,
    "ivb": 7.4,
    "horizontalBreak": 13.8,
    "spinRate": 1800.0,
    "spinAxis": 240.0,
}
ARSENAL = [
    {
        "pitchType": "Four-Seam",
        "usage": 0.55,
        "releaseSpeed": 91.7,
        "ivb": 17.2,
        "horizontalBreak": 9.7,
        "releaseHeight": 5.95,
        "releaseSide": 1.6,
    },
    {
        "pitchType": "Changeup",
        "usage": 0.25,
        "releaseSpeed": 83.7,
        "ivb": 7.4,
        "horizontalBreak": 13.8,
        "releaseHeight": 5.9,
        "releaseSide": 1.7,
    },
]


@pytest.fixture(scope="module")
def model() -> BridgeModel:
    rng = np.random.default_rng(0)
    n = 4000
    frame = pd.DataFrame(
        {
            "pitch_type": rng.choice(PITCH_TYPES, n),
            "release_speed": rng.normal(89, 4, n),
            "spin_rate": rng.normal(2300, 200, n),
            "spin_axis": rng.normal(200, 30, n),
            "ivb": rng.normal(10, 7, n),
            "horizontal_break": rng.normal(6, 6, n),
            "extension": rng.normal(6.1, 0.4, n),
            "release_height": rng.normal(5.9, 0.4, n),
            "release_side": rng.normal(1.8, 0.5, n),
            "density_index": rng.choice([1.0, 0.858], n),
            "is_same_side": rng.integers(0, 2, n).astype(float),
            "pitcher_id": rng.integers(0, 40, n).astype(str),
        }
    )
    frame["run_value"] = (
        -0.01 * frame.ivb + 0.02 * (1 - frame.density_index) + rng.normal(0, 0.2, n)
    )
    return fit_bridge(frame, model_id="0.1.0+test", n_bags=4, seed=1)[0]


@pytest.fixture
def client(model):
    app.dependency_overrides[simulator_service] = lambda: SimulatorService(
        model, None, EVIDENCE, ARSENALS
    )
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_simulate_returns_both_environments_side_by_side(client):
    body = client.post("/api/v1/simulate", json={"pitch": FOUR_SEAM}).json()
    sea, high = body["sea"], body["harpHelu"]
    assert body["stuffPlusShown"] and body["modelId"] == "0.1.0+test"
    assert sea["stuffPlus"]["se"] > 0 and high["stuffPlus"]["se"] > 0
    # Thinner air: less ride, the band appears, and the ball arrives faster.
    assert high["shape"]["ivb"]["value"] < sea["shape"]["ivb"]["value"]
    assert sea["shape"]["ivb"]["se"] == 0 and high["shape"]["ivb"]["se"] > 0
    assert high["approach"]["plateSpeed"] > sea["approach"]["plateSpeed"]
    assert len(sea["comparables"]) == 3


def test_the_altitude_delta_is_split_into_shape_and_environment(client):
    delta = client.post("/api/v1/simulate", json={"pitch": FOUR_SEAM}).json()["altitudeDelta"]
    parts = delta["shape"]["value"] + delta["environment"]["value"]
    assert parts == pytest.approx(delta["total"]["value"])


def test_a_secondary_pitch_is_measured_against_its_fastball_in_both_airs(client):
    body = client.post("/api/v1/simulate", json={"pitch": CHANGEUP, "arsenal": ARSENAL}).json()
    assert body["primaryFastball"] == "Four-Seam"
    sea, high = body["sea"]["differentials"], body["harpHelu"]["differentials"]
    assert sea["releaseSpeed"] == pytest.approx(-8.0)
    assert abs(high["ivb"]) < abs(sea["ivb"])  # movement gaps shrink at altitude
    assert high["releaseSpeed"] == sea["releaseSpeed"]  # velocity gaps do not


def test_a_pitcher_is_not_his_own_comparable(client):
    first = next(iter(ARSENALS.values()))
    body = client.post(
        "/api/v1/simulate", json={"pitch": FOUR_SEAM, "pitcherId": first["pitcher_id"]}
    ).json()
    ids = {c["pitcherId"] for c in body["sea"]["comparables"] + body["harpHelu"]["comparables"]}
    assert first["pitcher_id"] not in ids


def test_an_empty_arsenal_gives_no_differentials(client):
    body = client.post("/api/v1/simulate", json={"pitch": CHANGEUP, "arsenal": []}).json()
    assert body["primaryFastball"] is None and body["sea"]["differentials"] is None


def test_a_shape_nobody_throws_is_flagged(client):
    pitch = {**FOUR_SEAM, "ivb": 22.0, "horizontalBreak": 9.0, "spinRate": 1500.0}
    assert not client.post("/api/v1/simulate", json={"pitch": pitch}).json()["plausibility"][
        "isPlausible"
    ]


@pytest.mark.parametrize(
    "bad",
    [
        {**FOUR_SEAM, "releaseSpeed": 150.0},
        {**FOUR_SEAM, "pitchType": "Knuckleball"},
        {**FOUR_SEAM, "spinRate": 0.0},
        {**FOUR_SEAM, "surprise": 1},
    ],
)
def test_invalid_pitches_are_rejected(client, bad):
    assert client.post("/api/v1/simulate", json={"pitch": bad}).status_code == 422


def test_without_a_model_the_physics_still_answers(model):
    app.dependency_overrides[simulator_service] = lambda: SimulatorService(
        None, "model_unavailable", EVIDENCE, ARSENALS
    )
    body = TestClient(app).post("/api/v1/simulate", json={"pitch": FOUR_SEAM}).json()
    app.dependency_overrides.clear()
    assert body["stuffPlusShown"] is False and body["stuffPlusReason"] == "model_unavailable"
    assert body["sea"]["stuffPlus"] is None and body["altitudeDelta"] is None
    assert body["harpHelu"]["shape"]["ivb"]["value"] < FOUR_SEAM["ivb"]


def _outputs(tmp_path: Path) -> None:
    for name in ("simulator.json", "arsenals.json"):
        (tmp_path / name).write_text((OUTPUTS / name).read_text())


def test_a_model_the_gates_did_not_judge_is_not_shown(model, tmp_path):
    _outputs(tmp_path)
    model_path = str(tmp_path / "bridge.joblib")
    model.save(model_path)
    (tmp_path / "bridge.validation.json").write_text(
        json.dumps({"model_id": "0.1.0+other", "stuff_plus_shown": True})
    )
    assert load_service(str(tmp_path), model_path).reason == "model_not_gated"


def test_a_model_without_a_verdict_beside_it_is_not_shown(model, tmp_path):
    _outputs(tmp_path)
    model_path = str(tmp_path / "bridge.joblib")
    model.save(model_path)
    assert load_service(str(tmp_path), model_path).reason == "model_not_gated"


def test_the_verdict_beside_the_model_decides_and_the_published_record_does_not(model, tmp_path):
    # The committed record describes another machine's fit; it must not block this one.
    _outputs(tmp_path)
    (tmp_path / "simulator_validation.json").write_text(
        json.dumps({"model_id": "0.1.0+elsewhere", "stuff_plus_shown": False})
    )
    model_path = str(tmp_path / "bridge.joblib")
    model.save(model_path)
    (tmp_path / "bridge.validation.json").write_text(
        json.dumps({"model_id": model.model_id, "stuff_plus_shown": True})
    )
    assert load_service(str(tmp_path), model_path).reason is None


def test_translate_moves_a_shape_with_its_band():
    shape = {
        "releaseSpeed": 91.7,
        "ivb": 17.2,
        "horizontalBreak": 9.7,
        "extension": 6.0,
        "releaseHeight": 5.95,
        "releaseSide": 1.6,
    }
    body = (
        TestClient(app)
        .post("/api/v1/translate", json={"shape": shape, "pitchType": "Four-Seam"})
        .json()
    )
    assert body["breakScalingFactor"] == pytest.approx(0.7543, abs=1e-4)
    assert body["shape"]["ivb"] == pytest.approx(17.2 * 0.7543, abs=0.01)
    assert body["ivbSe"] > 0


def test_translate_rejects_a_non_physical_density():
    shape = {
        "releaseSpeed": 91.7,
        "ivb": 17.2,
        "horizontalBreak": 9.7,
        "extension": 6.0,
        "releaseHeight": 5.95,
        "releaseSide": 1.6,
    }
    response = TestClient(app).post(
        "/api/v1/translate", json={"shape": shape, "originDensityIndex": 0}
    )
    assert response.status_code == 422
