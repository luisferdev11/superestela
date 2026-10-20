"""Tests for the scoring harness, on seeded synthetic data.

The real-data check is that the harness reproduces the bridge's own scores on
the training frame exactly; it needs the dataset and is run by hand (ADR 0009).
These pin the mechanics: one row out per row in, a band on every score, and a
reason on every row without one.
"""

import numpy as np
import pandas as pd
import pytest

from models.batch import (
    MISSING_DENSITY,
    MISSING_FEATURES,
    SCORED,
    UNKNOWN_HAND,
    UNSUPPORTED_PITCH_TYPE,
    MissingColumnsError,
    score_frame,
)
from models.scoring import PitchInput, Scorer
from models.stuff.v0_bridge import PITCH_TYPES
from models.tests.pitches import REFERENCE, raw_pitches
from models.tests.toy_scorer import ToyArsenalScorer


def test_the_bridge_answers_the_runtime_contract(model):
    assert isinstance(model, Scorer)
    assert model.pitch_types == PITCH_TYPES


def test_one_row_out_per_row_in_with_a_band_on_every_score(model):
    raw = raw_pitches()
    out = score_frame(raw, model, REFERENCE)
    assert len(out) == len(raw)
    assert list(out.pitch_id) == list(raw.PitchUID)
    assert (out.status == SCORED).all()
    assert (out.stuff_plus_se > 0).all()
    assert (out.model_id == "0.1.0+test").all()
    assert (out.density_source == "trajectory").all()


def test_the_harness_scores_what_the_contract_scores_one_by_one(model):
    raw = raw_pitches(n=4)
    out = score_frame(raw, model, REFERENCE)
    for i, row in enumerate(raw.to_dict("records")):
        sign = 1.0 if row["PitcherThrows"] == "Right" else -1.0
        axis = row["SpinAxis"] if sign > 0 else (360.0 - row["SpinAxis"]) % 360.0
        pitch = PitchInput(
            pitch_type=row["AutoPitchType"],
            pitcher_hand=row["PitcherThrows"],
            release_speed=row["RelSpeed"],
            ivb=row["InducedVertBreak"],
            horizontal_break=row["HorzBreak"] * sign,
            spin_rate=row["SpinRate"],
            spin_axis=axis,
            extension=row["Extension"],
            release_height=row["RelHeight"],
            release_side=row["RelSide"] * sign,
        )
        expected = model.score(pitch, None, float(out.density_index[i]))
        assert out.stuff_plus[i] == pytest.approx(expected.value)
        assert out.stuff_plus_se[i] == pytest.approx(expected.se)


def test_a_mirrored_left_hander_scores_like_the_right_hander(model):
    raw = raw_pitches(n=1).assign(PitcherThrows="Right")
    lefty = raw.assign(
        PitcherThrows="Left",
        HorzBreak=-raw.HorzBreak,
        RelSide=-raw.RelSide,
        SpinAxis=(360.0 - raw.SpinAxis) % 360.0,
    )
    both = score_frame(pd.concat([raw, lefty], ignore_index=True), model, REFERENCE)
    assert both.stuff_plus[0] == pytest.approx(both.stuff_plus[1])


def test_a_row_without_a_score_says_why_and_carries_no_number(model):
    raw = raw_pitches(n=4)
    raw.loc[0, "AutoPitchType"] = "Splitter"
    raw.loc[1, "SpinRate"] = np.nan
    raw.loc[2, "PitcherThrows"] = "Undefined"
    out = score_frame(raw, model, REFERENCE)
    assert list(out.status) == [UNSUPPORTED_PITCH_TYPE, MISSING_FEATURES, UNKNOWN_HAND, SCORED]
    assert out.stuff_plus[:3].isna().all()
    assert out.stuff_plus_se[:3].isna().all()


def test_a_game_too_thin_to_measure_takes_its_category_density(model):
    raw = raw_pitches(n=10).assign(altitude_category="Extreme Altitude")
    out = score_frame(raw, model, REFERENCE)
    assert (out.density_source == "category").all()
    assert out.density_index.to_numpy() == pytest.approx(0.858)


def test_a_thin_game_with_no_category_keeps_its_reading_and_says_so(model):
    raw = raw_pitches(n=10).drop(columns=["altitude_category"])
    out = score_frame(raw, model, REFERENCE)
    assert (out.density_source == "thin_game").all()
    assert (out.status == SCORED).all()


def test_without_trajectory_the_density_falls_back_to_the_category_and_says_so(model):
    raw = raw_pitches(n=3).drop(columns=["vx0"])
    raw.loc[0, "altitude_category"] = "Extreme Altitude"
    raw.loc[1, "altitude_category"] = "No Altitude"
    raw.loc[2, "altitude_category"] = None
    out = score_frame(raw, model, REFERENCE)
    assert list(out.density_source) == ["category", "category", "missing"]
    assert out.density_index[0] == pytest.approx(0.858)
    assert out.density_index[1] == pytest.approx(1.0)
    assert out.status[2] == MISSING_DENSITY


def test_a_file_missing_a_required_column_is_refused_by_its_vendor_name(model):
    with pytest.raises(MissingColumnsError, match="InducedVertBreak"):
        score_frame(raw_pitches().drop(columns=["InducedVertBreak"]), model, REFERENCE)


def _with_arsenals(raw: pd.DataFrame) -> pd.DataFrame:
    return raw.assign(pitcher_anon_id=[f"p{i % 3}" for i in range(len(raw))], year=2025)


def test_a_model_that_needs_the_arsenal_names_the_columns_that_find_it():
    with pytest.raises(MissingColumnsError, match="pitcher_anon_id, year"):
        score_frame(raw_pitches(), ToyArsenalScorer(), REFERENCE)


def test_a_model_that_needs_the_arsenal_gets_each_pitch_against_its_fastball():
    raw = _with_arsenals(raw_pitches())
    out = score_frame(raw, ToyArsenalScorer(), REFERENCE)
    scored = out[out.status == SCORED]
    ref = raw.assign(diff=np.nan)
    for _, g in raw.groupby(["pitcher_anon_id", "altitude_category"]):
        fastballs = g[g.AutoPitchType.isin(["Four-Seam", "Sinker"])]
        top = fastballs.AutoPitchType.value_counts().index[0]
        ref.loc[g.index, "diff"] = g.RelSpeed - g[g.AutoPitchType == top].RelSpeed.mean()
    assert len(scored) > 0
    assert np.allclose(scored.stuff_plus, 100 - ref.loc[scored.index, "diff"])


def test_a_pitch_whose_arsenal_is_unknown_is_not_scored_as_a_zero_gap():
    raw = _with_arsenals(raw_pitches())
    raw.loc[0, "pitcher_anon_id"] = None
    out = score_frame(raw, ToyArsenalScorer(), REFERENCE)
    assert out.loc[0, "status"] in (MISSING_FEATURES, UNSUPPORTED_PITCH_TYPE)
    assert pd.isna(out.loc[0, "stuff_plus"])


def test_scoring_in_chunks_gives_the_same_scores(model):
    raw = raw_pitches()
    whole = score_frame(raw, model, REFERENCE)
    chunked = score_frame(raw, model, REFERENCE, chunk_size=7)
    assert np.allclose(whole.stuff_plus, chunked.stuff_plus)
    assert np.allclose(whole.stuff_plus_se, chunked.stuff_plus_se)


def test_a_pitch_without_environment_does_not_move_its_games_density(model):
    raw = raw_pitches()
    with_gap = raw.copy()
    with_gap.loc[0, "altitude_category"] = None
    base = score_frame(raw, model, REFERENCE).density_index
    gap = score_frame(with_gap, model, REFERENCE).density_index
    # Row 0 left the mean of its game (g0, the even rows), as in training;
    # the other game (g1, the odd rows) is untouched.
    assert gap[2] != base[2]
    assert gap[1] == base[1]


def test_a_row_with_several_problems_reports_the_first_in_order(model):
    raw = raw_pitches(n=1)
    raw.loc[0, "AutoPitchType"] = "Splitter"
    raw.loc[0, "SpinRate"] = np.nan
    assert score_frame(raw, model, REFERENCE).status[0] == UNSUPPORTED_PITCH_TYPE
