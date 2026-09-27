"""Tests for plate speed and VAA. The dataset check is gate F5, in models/."""

import math

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.trajectory import (
    GRAVITY_FT_S2,
    MPH_TO_FT_S,
    PLATE_FRONT_FT,
    RUBBER_TO_PLATE_TIP_FT,
    approach,
)

# Sea-level four-seam: speed and loss from simulator.json -> speed_loss, IVB from
# pitch_profiles, extension and release height the medians in distributions.
FOUR_SEAM = dict(
    release_speed=91.59, speed_loss=7.67, ivb=17.11, extension=6.02, release_height=5.95
)


def test_plate_speed_is_release_speed_minus_the_loss():
    assert approach(**FOUR_SEAM).plate_speed == pytest.approx(91.59 - 7.67)


def test_a_pitch_whose_lift_cancels_gravity_arrives_along_a_straight_line():
    # With no speed loss and IVB equal to the gravity drop, the only vertical
    # motion left is the aim, so VAA is the angle of the straight line.
    speed, ext, height, target = 90.0, 6.0, 6.0, 2.5
    distance = RUBBER_TO_PLATE_TIP_FT - ext - PLATE_FRONT_FT
    t = distance / (speed * MPH_TO_FT_S)
    ivb = 0.5 * GRAVITY_FT_S2 * t**2 * 12.0
    out = approach(speed, 0.0, ivb, ext, height, target)
    assert out.vaa == pytest.approx(math.degrees(math.atan((target - height) / distance)))


@given(ivb=st.floats(min_value=-20, max_value=24), extra=st.floats(min_value=0.1, max_value=6))
@settings(max_examples=200, deadline=None)
def test_more_ride_always_flattens_the_approach(ivb, extra):
    flat = approach(**{**FOUR_SEAM, "ivb": ivb + extra}).vaa
    assert flat > approach(**{**FOUR_SEAM, "ivb": ivb}).vaa


def test_losing_ride_at_altitude_steepens_the_fastball():
    # The measured four-seam changes at the league means: 17.11 -> 13.07 in of
    # IVB and 7.67 -> 6.35 mph of loss. The steeper angle is the ride lost.
    sea = approach(**FOUR_SEAM)
    high = approach(**{**FOUR_SEAM, "ivb": 13.07, "speed_loss": 6.35})
    assert high.vaa < sea.vaa
    assert high.plate_speed > sea.plate_speed


def test_a_typical_fastball_arrives_near_minus_five_degrees():
    # League mean VertApprAngle for sea-level four-seams is -4.95 deg.
    assert approach(**FOUR_SEAM, plate_height=2.84).vaa == pytest.approx(-4.95, abs=0.5)


def test_unphysical_inputs_are_rejected():
    with pytest.raises(ValueError, match="speed_loss"):
        approach(90.0, 95.0, 15.0, 6.0, 6.0)
    with pytest.raises(ValueError, match="past the plate"):
        approach(90.0, 7.0, 15.0, 60.0, 6.0)
