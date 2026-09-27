"""Tests for arsenal differentials (docs/09 section 3.7)."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.arsenal import ArsenalPitch, differentials, primary_fastball
from core.density import DENSITY_INDEX_EXTREME, DENSITY_INDEX_SEA_LEVEL
from core.translate import break_scaling_factor


def _pitch(pitch_type: str, usage: float, **overrides: float) -> ArsenalPitch:
    base = dict(
        release_speed=92.0, ivb=17.0, horizontal_break=9.0, release_height=6.0, release_side=1.6
    )
    return ArsenalPitch(pitch_type=pitch_type, usage=usage, **{**base, **overrides})


def test_the_most_used_fastball_is_primary():
    arsenal = [_pitch("Sinker", 0.25), _pitch("Four-Seam", 0.45), _pitch("Slider", 0.30)]
    primary = primary_fastball(arsenal)
    assert primary is not None and primary.pitch_type == "Four-Seam"


def test_a_heavier_used_breaking_ball_never_becomes_the_anchor():
    arsenal = [_pitch("Slider", 0.60), _pitch("Cutter", 0.20)]
    primary = primary_fastball(arsenal)
    assert primary is not None and primary.pitch_type == "Cutter"


def test_an_arsenal_without_a_fastball_has_no_anchor():
    assert primary_fastball([_pitch("Slider", 0.5), _pitch("Curveball", 0.5)]) is None


def test_differentials_are_pitch_minus_fastball():
    fb = _pitch("Four-Seam", 0.5)
    ch = _pitch("Changeup", 0.2, release_speed=84.0, ivb=7.0, horizontal_break=15.0)
    out = differentials(ch, fb)
    assert (out.release_speed, out.ivb, out.horizontal_break) == (-8.0, -10.0, 6.0)
    assert out.release_distance == 0.0


def test_release_distance_is_euclidean():
    fb = _pitch("Four-Seam", 0.5)
    sl = _pitch("Slider", 0.3, release_height=6.3, release_side=2.0)
    assert differentials(sl, fb).release_distance == pytest.approx(0.5)


@given(ivb=st.floats(min_value=-20, max_value=24), hb=st.floats(min_value=-20, max_value=24))
@settings(max_examples=200, deadline=None)
def test_movement_differentials_shrink_at_altitude_and_velocity_ones_do_not(ivb, hb):
    # Both pitches lose break by the same factor, so their gap loses it too.
    k = break_scaling_factor(DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME)
    fb, other = _pitch("Four-Seam", 0.5), _pitch("Changeup", 0.2, ivb=ivb, horizontal_break=hb)
    sea = differentials(other, fb)
    high = differentials(
        _pitch("Changeup", 0.2, ivb=ivb * k, horizontal_break=hb * k),
        _pitch("Four-Seam", 0.5, ivb=17.0 * k, horizontal_break=9.0 * k),
    )
    assert abs(high.ivb) <= abs(sea.ivb) + 1e-9
    assert abs(high.horizontal_break) <= abs(sea.horizontal_break) + 1e-9
    assert high.release_speed == sea.release_speed
