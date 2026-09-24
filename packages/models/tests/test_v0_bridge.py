"""Tests for the v0 bridge on a seeded synthetic frame; no competition data.

The real-data checks are the gates in analysis/simulator_gates.py. These pin
the mechanics: the contract, the band, the scale and the round trip.
"""

import numpy as np
import pandas as pd
import pytest

from models.scoring import PitchInput, Scorer
from models.stuff.v0_bridge import PITCH_TYPES, BridgeModel, fit_bridge


@pytest.fixture(scope="module")
def fitted() -> tuple[BridgeModel, np.ndarray, pd.DataFrame]:
    rng = np.random.default_rng(0)
    n = 6000
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
            "pitcher_id": rng.integers(0, 60, n).astype(str),
        }
    )
    # Faster pitches allow fewer runs, so Stuff+ must rise with velocity.
    frame["run_value"] = -0.02 * (frame.release_speed - 89) + rng.normal(0, 0.2, n)
    model, oob = fit_bridge(frame, model_id="0.1.0+test", n_bags=4, seed=1)
    return model, oob, frame


def _pitch(**overrides: float | str) -> PitchInput:
    base = dict(
        pitch_type="Four-Seam",
        pitcher_hand="Right",
        release_speed=92.0,
        ivb=17.0,
        horizontal_break=9.0,
        spin_rate=2330.0,
        spin_axis=211.0,
        extension=6.0,
        release_height=6.0,
        release_side=1.6,
    )
    return PitchInput(**{**base, **overrides})  # type: ignore[arg-type]


def test_the_bridge_satisfies_the_scoring_contract(fitted):
    model, _, _ = fitted
    scorer: Scorer = model
    out = scorer.score(_pitch(), arsenal=None, density_index=1.0)
    assert out.model_id == "0.1.0+test"
    assert out.se > 0
    assert not scorer.uses_arsenal


def test_scale_centres_the_league_on_one_hundred(fitted):
    model, oob, _ = fitted
    stuff = 100 - 10 * (oob[~np.isnan(oob)] - model.scale.mean_xrv) / model.scale.sd_xrv
    assert stuff.mean() == pytest.approx(100.0, abs=1e-6)
    assert stuff.std() == pytest.approx(10.0, abs=1e-6)


def test_out_of_bag_is_missing_only_where_every_bag_saw_the_pitcher(fitted):
    _, oob, frame = fitted
    # With 4 bags and 60 pitchers, most pitchers sit out at least one bag.
    assert 0.5 < np.isfinite(oob).mean() <= 1.0
    per_pitcher = pd.Series(np.isfinite(oob)).groupby(frame.pitcher_id.to_numpy()).nunique()
    assert (per_pitcher == 1).all()  # a pitcher is in or out of a bag as a whole


def test_the_hand_does_not_change_an_arm_side_pitch(fitted):
    model, _, _ = fitted
    right = model.score(_pitch(pitcher_hand="Right"), None, 1.0)
    left = model.score(_pitch(pitcher_hand="Left"), None, 1.0)
    assert right.value == left.value


def test_velocity_that_the_data_rewards_scores_higher(fitted):
    model, _, _ = fitted
    slow = model.score(_pitch(release_speed=84.0), None, 1.0)
    fast = model.score(_pitch(release_speed=96.0), None, 1.0)
    assert fast.value > slow.value


def test_the_model_survives_a_round_trip(fitted, tmp_path):
    model, _, _ = fitted
    path = str(tmp_path / "bridge.joblib")
    model.save(path)
    again = BridgeModel.load(path)
    assert again.score(_pitch(), None, 0.858) == model.score(_pitch(), None, 0.858)
