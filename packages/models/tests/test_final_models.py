"""The final Stuff+ and Location+ scorers, on tiny boosters fitted to noise.

The real boosters are fitted on the licensed data and live in artifacts/;
scripts/verify_final_models.py checks them against data's own numbers. Here a
seeded run folder in data's layout pins the mechanics: feature order, the
hand-neutral mix, run values by count, the per-type scale, and that nothing
missing is scored as a zero.
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
import xgboost as xgb

from models import outcomes
from models.location import final as location
from models.runs import read_run
from models.scoring import PitchInput, Scorer, implied_xrv
from models.stuff import final as stuff
from models.tests.data_runs import (
    LOCATION_FEATURES,
    STUFF_FEATURES,
    toy_location,
    toy_stuff,
    write_run,
)


@pytest.fixture
def stuff_model(tmp_path: Path) -> stuff.FinalStuffScorer:
    return toy_stuff(tmp_path / "FINAL")


def _slider(**changes: object) -> PitchInput:
    base = dict(
        pitch_type="Slider",
        pitcher_hand="Right",
        release_speed=85.0,
        ivb=2.0,
        horizontal_break=-5.0,
        spin_rate=2500.0,
        spin_axis=90.0,
        extension=6.2,
        release_height=5.8,
        release_side=1.8,
        speed_diff=-9.0,
        ivb_diff=-14.0,
        hb_diff=-13.0,
    )
    return PitchInput(**{**base, **changes})  # type: ignore[arg-type]


def test_the_final_stuff_model_answers_the_contract_and_survives_joblib(stuff_model, tmp_path):
    joblib.dump(stuff_model, tmp_path / "m.joblib")
    assert isinstance(joblib.load(tmp_path / "m.joblib"), Scorer)
    assert stuff_model.uses_arsenal


def test_the_boosters_see_the_columns_in_trainings_order(stuff_model):
    frame = pd.DataFrame([_slider().__dict__])
    assert list(stuff_model.features(frame).columns) == STUFF_FEATURES


def test_stuff_plus_is_the_hand_neutral_xrv_on_its_types_scale(stuff_model):
    frame = pd.DataFrame([_slider().__dict__])
    x = stuff_model.features(frame)
    booster = stuff_model.run.boosters["Slider"][0]
    p0 = booster.predict(xgb.DMatrix(x.astype("float32")))
    p1 = booster.predict(xgb.DMatrix(x.assign(same_hand=1.0).astype("float32")))
    xrv = (0.4 * p0 + 0.6 * p1) @ np.asarray(stuff_model.run.rv_neutral)
    expected = 100 - 10 * (xrv[0] - 0.01) / 0.02
    assert stuff_model.draws([_slider()], [1.0])[0, 0] == pytest.approx(expected, rel=1e-5)
    assert float(implied_xrv(stuff_model.scale, "Slider", expected)) == pytest.approx(xrv[0])


def test_the_pitchers_hand_and_the_air_do_not_move_the_score(stuff_model):
    right = stuff_model.draws([_slider()], [1.0])
    assert np.allclose(right, stuff_model.draws([_slider(pitcher_hand="Left")], [0.8]))


def test_a_pitch_without_its_fastball_differentials_is_refused(stuff_model):
    with pytest.raises(ValueError, match="differentials"):
        stuff_model.draws([_slider(speed_diff=None)], [1.0])


def test_one_booster_is_one_draw_and_no_band(stuff_model):
    assert stuff_model.draws([_slider()], [1.0]).shape == (1, 1)
    assert not stuff_model.has_bands
    assert np.isnan(stuff_model.score(_slider(), None, 1.0).se)


def test_fold_boosters_are_the_draws(tmp_path):
    run = read_run(
        str(write_run(tmp_path / "F", STUFF_FEATURES, stuff.CLASSES, folds=5)), stuff.CLASSES
    )
    assert run.has_folds and len(run.boosters["Slider"]) == 5


def test_a_run_whose_boosters_disagree_with_its_classes_is_refused(tmp_path):
    path = write_run(tmp_path / "BAD", STUFF_FEATURES, stuff.CLASSES)
    with pytest.raises(ValueError, match="rv_values"):
        read_run(str(path), location.CLASSES)


@pytest.fixture
def location_model(tmp_path: Path) -> location.FinalLocationScorer:
    return toy_location(tmp_path / "L3")


def _located(**changes: object) -> pd.DataFrame:
    row = dict(
        pitch_type="Slider",
        pitcher_hand="Right",
        batter_hand="Left",
        plate_height=1.8,
        plate_side=0.9,
        balls=1,
        strikes=2,
    )
    return pd.DataFrame([{**row, **changes}])


def test_location_reads_the_count_from_its_table_and_falls_back_out_of_range(location_model):
    rv = location_model.run_values(pd.Series([3, 9]), pd.Series([0, 0]))
    assert rv[0, 0] == 0.5
    assert np.allclose(rv[1], location_model.run.rv_neutral)


def test_location_knows_the_matchup_from_both_hands(location_model):
    opposite = location_model.draws(_located())
    same = location_model.draws(_located(batter_hand="Right"))
    booster = location_model.run.boosters["Slider"][0]
    x = pd.DataFrame([[1.8, 0.9, 1.0, 2.0, 1.0]], columns=LOCATION_FEATURES)
    xrv = (
        booster.predict(xgb.DMatrix(x))
        @ location_model.run_values(pd.Series([1]), pd.Series([2]))[0]
    )
    assert same[0, 0] == pytest.approx(100 - 10 * xrv[0] / 0.05, rel=1e-5)
    assert opposite.shape == (1, 1)


def test_location_refuses_a_type_it_was_not_trained_on(location_model):
    with pytest.raises(ValueError, match="Sweeper"):
        location_model.draws(_located(pitch_type="Sweeper"))


def test_the_outcome_port_classifies_as_data_did():
    raw = pd.DataFrame(
        {
            "PitchCall": [
                "InPlay",
                "FoulBallNotFieldable",
                "StrikeSwinging",
                "BallCalled",
                "InPlay",
            ],
            "play_result": ["Out", "NeutralPlay", "Strikeout", None, "Double"],
            "ExitSpeed": [65.0, np.nan, np.nan, np.nan, 99.0],
            "Balls": [0, 1, 2, 3, 0],
            "Strikes": [0, 1, 2, 1, 0],
        }
    )
    events = outcomes.event_type(raw)
    assert events.tolist() == ["Out", "FoulBall", "StrikeSwinging", "BallCalled", "Double"]
    assert outcomes.swing_quality_class(raw, events).tolist()[:3] == ["Weak", "Foul", "Whiff"]
    assert outcomes.every_pitch_class(events).tolist()[3:] == ["Ball", "XBH"]
    table = pd.DataFrame(
        {"event": ["Walk", "Out"], "balls": [3, 0], "strikes": [1, 0], "delta_run_exp": [0.3, -0.2]}
    )
    rv = outcomes.delta_run_exp(raw, events, table)
    assert rv.iloc[3] == 0.3  # a ball at three balls is a walk
    assert rv.iloc[0] == -0.2


def test_the_analysis_features_follow_datas_formulas_and_stay_empty_without_inputs():
    from models.features.analysis import analysis_features

    frame = pd.DataFrame(
        {
            "release_speed": [94.0, None],
            "ivb": [16.0, 2.0],
            "horizontal_break": [8.0, -5.0],
            "spin_rate": [2400.0, 2500.0],
            "extension": [6.3, 6.0],
            "release_height": [5.9, 5.8],
            "plate_side": [0.3, None],
            "plate_height": [2.9, 1.9],
            "environment": ["Extreme Altitude", None],
        }
    )
    a = analysis_features(frame)
    assert a.loc[0, "total_break"] == pytest.approx((16**2 + 8**2) ** 0.5)
    assert a.loc[0, "loc_dist_center"] == pytest.approx((0.3**2 + 0.4**2) ** 0.5)
    assert a.loc[0, "alt_ord"] == 2
    assert -7 < float(a["vaa_est"].iloc[0]) < -3  # a riding four-seam arrives flat-ish
    assert a.loc[1, ["vaa_est", "loc_abs_side", "alt_ord"]].isna().all()


def test_the_distilled_model_never_lowers_stuff_plus_when_the_pitch_gets_faster(stuff_model):
    from dataclasses import replace

    from models.stuff.monotone import MonotoneStuffScorer

    rng = np.random.default_rng(3)
    features = [f for f in STUFF_FEATURES if f != "same_hand"]
    x = pd.DataFrame(rng.normal(size=(2000, len(features))), columns=features)
    # A target where speed helps on average but not everywhere: the constraint must win.
    y = -0.01 * x["RelSpeed"] + 0.02 * np.sin(3 * x["RelSpeed"]) + 0.01 * x["SpinRate"]
    params = {
        "objective": "reg:squarederror",
        "max_depth": 3,
        "monotone_constraints": str(tuple(-1 if f == "RelSpeed" else 0 for f in features)),
    }
    boosters = tuple(
        xgb.train(dict(params, seed=k), xgb.DMatrix(x, label=y), num_boost_round=30)
        for k in range(3)
    )
    run = replace(stuff_model.run, features=tuple(features), boosters={"Slider": boosters})
    model = MonotoneStuffScorer(
        model_id="1.1.0+abcdef0",
        scale=stuff_model.scale,
        pitch_types=("Slider",),
        run=run,
        p_same=stuff_model.p_same,
        clip=stuff_model.clip,
    )
    speeds = np.arange(-2.5, 2.5, 0.05)  # the synthetic speeds' own range, where it bends
    draws = model.draws([_slider(release_speed=float(v)) for v in speeds], [1.0] * len(speeds))
    assert draws.shape == (3, len(speeds))
    assert (np.diff(draws, axis=1) >= -1e-9).all()
    assert draws[:, -1].mean() > draws[:, 0].mean()  # and it does move
