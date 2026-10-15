"""RA/9 from counts: the arithmetic, the minimum and the band."""

import math

import pytest

from core.runs import MIN_INNINGS_FOR_RA9, runs_allowed_per_nine


def test_ra9_is_nine_times_runs_over_innings():
    result = runs_allowed_per_nine(runs=20, outs=90)  # 30 innings
    assert result is not None
    ra9, _, innings = result
    assert innings == pytest.approx(30.0)
    assert ra9 == pytest.approx(6.0)


def test_too_few_innings_has_no_number():
    outs = int(3 * MIN_INNINGS_FOR_RA9) - 1
    assert runs_allowed_per_nine(runs=5, outs=outs) is None
    assert runs_allowed_per_nine(runs=5, outs=outs + 1) is not None


def test_the_band_narrows_with_more_innings():
    small = runs_allowed_per_nine(runs=10, outs=60)
    large = runs_allowed_per_nine(runs=40, outs=240)
    assert small is not None and large is not None
    assert small[0] == pytest.approx(large[0])
    assert large[1] < small[1]
    assert small[1] == pytest.approx(1.959964 * 9 * math.sqrt(11) / 20)


def test_a_scoreless_stretch_still_carries_a_band():
    result = runs_allowed_per_nine(runs=0, outs=60)
    assert result is not None
    assert result[0] == 0.0 and result[1] > 0


def test_negative_counts_are_refused():
    with pytest.raises(ValueError):
        runs_allowed_per_nine(runs=-1, outs=30)
