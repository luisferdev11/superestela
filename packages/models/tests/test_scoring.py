"""Tests for the pieces of the scoring contract that are not a model."""

import joblib
import numpy as np
import pandas as pd
import pytest

from models.scoring import load_scorer, stuff_plus_of, to_arm_side, verdict_path
from models.tests.toy_scorer import ToyScorer


def test_a_right_hander_is_already_on_the_arm_side():
    hb, side, axis = to_arm_side(["Right"], [8.0], [1.9], [215.0])
    assert (hb[0], side[0], axis[0]) == (8.0, 1.9, 215.0)


def test_a_left_hander_is_mirrored_into_the_right_handers_frame():
    hb, side, axis = to_arm_side(["Left"], [-8.0], [-1.9], [145.0])
    assert (hb[0], side[0], axis[0]) == (8.0, 1.9, 215.0)


def test_mirroring_twice_is_the_identity_for_the_spin_axis():
    axis = np.array([0.0, 90.0, 215.0, 359.0])
    _, _, once = to_arm_side(["Left"] * 4, np.zeros(4), np.zeros(4), axis)
    _, _, twice = to_arm_side(["Left"] * 4, np.zeros(4), np.zeros(4), once)
    assert np.allclose(twice, axis)


def test_the_verdict_lives_next_to_the_model_file():
    assert verdict_path("artifacts/m.joblib") == "artifacts/m.validation.json"


def test_a_hand_that_is_neither_side_is_refused_not_mirrored():
    with pytest.raises(ValueError, match="pitcher_hand"):
        to_arm_side(["Undefined"], [8.0], [1.9], [215.0])


def test_load_scorer_accepts_any_class_that_answers_the_contract(tmp_path):
    path = tmp_path / "toy.joblib"
    joblib.dump(ToyScorer(), path)
    assert load_scorer(str(path)).model_id == ToyScorer.model_id


def test_load_scorer_rejects_what_is_not_a_scorer(tmp_path):
    path = tmp_path / "not.joblib"
    joblib.dump({"model": "nope"}, path)
    with pytest.raises(TypeError, match="Scorer"):
        load_scorer(str(path))


def test_stuff_plus_of_is_the_mean_and_spread_of_the_draws():
    frame = pd.DataFrame(
        {
            "pitch_type": ["Four-Seam", "Slider"],
            "pitcher_hand": ["Right", "Left"],
            "release_speed": [95.0, 85.0],
            "ivb": [17.0, 2.0],
            "horizontal_break": [8.0, -4.0],
            "spin_rate": [2300.0, 2400.0],
            "spin_axis": [210.0, 100.0],
            "extension": [6.2, 6.0],
            "release_height": [5.9, 5.8],
            "release_side": [2.0, 1.9],
            "density_index": [1.0, 0.858],
        }
    )
    value, se = stuff_plus_of(ToyScorer(), frame)
    assert value == pytest.approx([105.0, 95.0 - 1.42])
    assert se == pytest.approx([1.0, 1.0])


def test_stuff_plus_of_matches_the_bridge_on_its_own_frame(model):
    rng = np.random.default_rng(3)
    n = 50
    frame = pd.DataFrame(
        {
            "pitch_type": rng.choice(model.pitch_types, n),
            "pitcher_hand": rng.choice(["Right", "Left"], n),
            "release_speed": rng.normal(89, 4, n),
            "ivb": rng.normal(10, 7, n),
            "horizontal_break": rng.normal(6, 6, n),
            "spin_rate": rng.normal(2300, 200, n),
            "spin_axis": rng.normal(200, 30, n),
            "extension": rng.normal(6.1, 0.4, n),
            "release_height": rng.normal(5.9, 0.4, n),
            "release_side": rng.normal(1.8, 0.5, n),
            "density_index": rng.choice([1.0, 0.858], n),
        }
    )
    value, se = stuff_plus_of(model, frame)
    expected, expected_se = model.stuff_plus(frame)
    assert value == pytest.approx(expected)
    assert se == pytest.approx(expected_se)
