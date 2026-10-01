"""Tests for the pieces of the scoring contract that are not a model."""

import numpy as np
import pytest

from models.scoring import to_arm_side, verdict_path


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
