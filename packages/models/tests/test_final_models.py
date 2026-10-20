"""The final Stuff+ and Location+ scorers, on tiny boosters fitted to noise.

The real boosters are fitted on the licensed data and live in artifacts/;
scripts/verify_final_models.py checks them against data's own numbers. Here a
seeded run folder in data's layout pins the mechanics: feature order, the
hand-neutral mix, run values by count, the per-type scale, and that nothing
missing is scored as a zero.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
import xgboost as xgb

from models import outcomes
from models.location import final as location
from models.runs import read_run
from models.scoring import PitchInput, ScaleSpec, Scorer, implied_xrv
from models.stuff import final as stuff

STUFF_FEATURES = [
    "RelSpeed",
    "SpinRate",
    "SpinAxis_sin",
    "SpinAxis_cos",
    "InducedVertBreak",
    "HorzBreak_m",
    "RelHeight",
    "RelSide_m",
    "Extension",
    "same_hand",
    "speed_diff_env",
    "ivb_diff_env",
    "hb_diff_env",
]
LOCATION_FEATURES = ["PlateLocHeight", "PlateLocSide", "Balls", "Strikes", "same_hand"]


def _run(path: Path, features: list[str], classes: tuple[str, ...], folds: int = 0) -> Path:
    rng = np.random.default_rng(1)
    (path / "models" / "folds").mkdir(parents=True)
    (path / "config.json").write_text(
        json.dumps({"name": path.name, "features_resolved": features})
    )
    rv = pd.Series(np.linspace(-0.2, 1.0, len(classes)), index=list(classes), name="rv_neutral")
    rv.to_csv(path / "rv_values.csv")
    for k in range(max(folds, 1)):
        x = pd.DataFrame(rng.normal(size=(300, len(features))), columns=features)
        y = rng.integers(0, len(classes), 300)
        params = {"objective": "multi:softprob", "num_class": len(classes), "max_depth": 2}
        b = xgb.train(params, xgb.DMatrix(x, label=y), num_boost_round=5)
        target = (
            path / "models" / (f"folds/stuff_Slider_f{k}.json" if folds else "stuff_Slider.json")
        )
        b.save_model(str(target))
    return path


@pytest.fixture
def stuff_model(tmp_path: Path) -> stuff.FinalStuffScorer:
    run = read_run(str(_run(tmp_path / "FINAL", STUFF_FEATURES, stuff.CLASSES)), stuff.CLASSES)
    return stuff.FinalStuffScorer(
        model_id="1.0.0+abcdef0",
        scale=ScaleSpec("toy", 0.0, 0.05, by_type={"Slider": (0.01, 0.02)}),
        pitch_types=("Slider",),
        run=run,
        p_same={"Slider": 0.6},
        clip={"Slider": {c: (-5.0, 5.0) for c in stuff.DIFF_FEATURES.values()}},
    )


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
    run = read_run(str(_run(tmp_path / "F", STUFF_FEATURES, stuff.CLASSES, folds=5)), stuff.CLASSES)
    assert run.has_folds and len(run.boosters["Slider"]) == 5


def test_a_run_whose_boosters_disagree_with_its_classes_is_refused(tmp_path):
    path = _run(tmp_path / "BAD", STUFF_FEATURES, stuff.CLASSES)
    with pytest.raises(ValueError, match="rv_values"):
        read_run(str(path), location.CLASSES)


@pytest.fixture
def location_model(tmp_path: Path) -> location.FinalLocationScorer:
    run = read_run(
        str(_run(tmp_path / "L3", LOCATION_FEATURES, location.CLASSES)), location.CLASSES
    )
    by_count = np.tile(np.asarray(run.rv_neutral)[:, None, None], (1, 4, 3))
    by_count[0, 3, :] = 0.5  # a ball at three balls is worth more
    return location.FinalLocationScorer(
        model_id="1.0.0+abcdef0",
        pitch_types=("Slider",),
        run=run,
        rv_by_count=by_count,
        scale={"Slider": (0.0, 0.05)},
        scale_description="toy",
    )


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
