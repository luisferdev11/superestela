"""Portable model folders: no pickle, the same scores on every machine (docs/16)."""

import numpy as np
import pandas as pd
import pytest

from models import portable
from models.location.final import FinalLocationScorer
from models.scoring import Scorer, load_scorer
from models.tests.data_runs import toy_location, toy_stuff
from models.tests.test_final_models import _located, _slider


def test_a_stuff_model_round_trips_to_the_same_draws(tmp_path):
    model = toy_stuff(tmp_path / "FINAL")
    portable.save(model, tmp_path / "out")
    copy = load_scorer(str(tmp_path / "out"))
    assert isinstance(copy, Scorer) and copy.model_id == model.model_id
    pitches = [_slider(), _slider(release_speed=90.0)]
    assert np.array_equal(model.draws(pitches, [1.0, 1.0]), copy.draws(pitches, [1.0, 1.0]))
    assert copy.scale == model.scale


def test_a_location_model_round_trips_to_the_same_draws(tmp_path):
    model = toy_location(tmp_path / "L3")
    portable.save(model, tmp_path / "out")
    copy = portable.load(tmp_path / "out")
    assert isinstance(copy, FinalLocationScorer)
    frame = pd.concat([_located(), _located(balls=3, strikes=0)], ignore_index=True)
    assert np.array_equal(model.draws(frame), copy.draws(frame))


def test_the_folder_holds_no_pickle_only_json(tmp_path):
    portable.save(toy_stuff(tmp_path / "FINAL"), tmp_path / "out")
    suffixes = {p.suffix for p in (tmp_path / "out").rglob("*") if p.is_file()}
    assert suffixes == {".json"}


def test_a_folder_that_is_not_a_model_is_refused(tmp_path):
    with pytest.raises(ValueError, match="manifest"):
        portable.load(tmp_path)
