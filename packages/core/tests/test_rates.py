"""Tests for the rate bands: honest at the edges, binomial in the middle."""

import math

import pytest

from core.rates import difference_band, rate_band


def test_a_rate_of_zero_still_has_a_band():
    rate, half = rate_band(0, 50)
    assert rate == 0.0
    assert half > 0.03  # no walks in 50 PA is not certainty


def test_in_the_middle_it_matches_the_plain_binomial():
    rate, half = rate_band(200, 1000)
    wald = 1.959964 * math.sqrt(0.2 * 0.8 / 1000)
    assert rate == pytest.approx(0.2)
    assert half == pytest.approx(wald, rel=0.02)


def test_the_band_narrows_with_more_trials():
    assert rate_band(10, 50)[1] > rate_band(100, 500)[1]


def test_a_difference_of_two_shares_is_wider_than_either_and_signed():
    diff, half = difference_band(10, 5, 50)
    assert diff == pytest.approx(0.1)
    assert half > rate_band(10, 50)[1]
    assert difference_band(5, 10, 50)[0] == pytest.approx(-0.1)


def test_without_trials_there_is_no_rate():
    with pytest.raises(ValueError, match="trial"):
        rate_band(0, 0)
