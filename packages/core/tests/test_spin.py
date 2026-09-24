"""Tests for spin coherence (docs/09 section 3.4)."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.spin import (
    Bounds,
    Envelope,
    assess_plausibility,
    movement_per_krpm,
    percentile_rank,
)

# 1st-99th percentiles of a toy distribution: percentile k sits at value k.
LINEAR = [float(k) for k in range(1, 100)]

# A toy four-seam: independent axes with these standard deviations, so the
# squared distance is the sum of squared z-scores and easy to check by hand.
MEAN = (91.6, 17.0, 9.4, 2330.0)
SD = (2.6, 3.0, 3.6, 160.0)
ENVELOPE = Envelope(
    mean=MEAN,
    inverse_covariance=[[1 / SD[i] ** 2 if i == j else 0.0 for j in range(4)] for i in range(4)],
    threshold=25.0,
    bounds={"spin_rate": Bounds(1800.0, 2900.0), "movement_per_krpm": Bounds(3.9, 17.9)},
)


def test_movement_per_krpm_is_total_break_over_thousands_of_rpm():
    assert movement_per_krpm(ivb=16.0, horizontal_break=12.0, spin_rate=2000) == pytest.approx(10.0)


def test_same_spin_more_movement_ranks_higher():
    # The point of H4: two 2,400 rpm fastballs are not the same pitch.
    flat = movement_per_krpm(14.0, 8.0, 2400)
    riding = movement_per_krpm(20.0, 8.0, 2400)
    assert riding > flat


def test_spinless_pitch_has_no_ratio():
    with pytest.raises(ValueError, match="positive"):
        movement_per_krpm(1.0, 1.0, 0.0)


def test_percentile_rank_interpolates_and_clamps():
    assert percentile_rank(50.0, LINEAR) == pytest.approx(50.0)
    assert percentile_rank(50.5, LINEAR) == pytest.approx(50.5)
    assert percentile_rank(-10.0, LINEAR) == 1.0
    assert percentile_rank(500.0, LINEAR) == 99.0


@given(a=st.floats(min_value=-50, max_value=150), b=st.floats(min_value=-50, max_value=150))
@settings(max_examples=200, deadline=None)
def test_percentile_rank_is_monotone(a, b):
    if a <= b:
        assert percentile_rank(a, LINEAR) <= percentile_rank(b, LINEAR)


def test_percentiles_must_be_the_full_ordered_list():
    with pytest.raises(ValueError, match="ascending"):
        percentile_rank(1.0, LINEAR[::-1])
    with pytest.raises(ValueError, match="ascending"):
        percentile_rank(1.0, LINEAR[:10])


def test_a_league_average_fastball_is_plausible():
    out = assess_plausibility(*MEAN, envelope=ENVELOPE)
    assert out.is_plausible
    assert out.squared_distance == pytest.approx(0.0)
    assert out.unusual == ()


def test_huge_ride_on_little_spin_is_flagged_and_explained():
    # The example of docs/09 section 3.4: it passes a per-axis bound on movement
    # per rpm, and the spin, far from the mean, names what is unusual.
    out = assess_plausibility(91.6, 22.0, 9.0, 1500.0, envelope=ENVELOPE)
    assert not out.is_plausible
    assert "spin_rate" in out.unusual
    assert "movement_per_krpm" not in out.unusual


def test_squared_distance_is_the_sum_of_squared_z_scores_when_axes_are_independent():
    out = assess_plausibility(91.6 + 2.6, 17.0 + 3.0, 9.4, 2330.0, envelope=ENVELOPE)
    assert out.squared_distance == pytest.approx(2.0)
