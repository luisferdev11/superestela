"""Property tests for the Altitude Translator. See CONVENTIONS.md section 7.3."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.density import DENSITY_INDEX_EXTREME, DENSITY_INDEX_SEA_LEVEL
from core.translate import (
    BREAK_ERROR_IN,
    MAGNUS_RATIO_EXTREME,
    PitchShape,
    break_scaling_factor,
    translate,
)

densities = st.floats(min_value=0.70, max_value=1.05)


def _shape(ivb: float = 16.95, hb: float = 9.81) -> PitchShape:
    # Sea-level four-seam averages, evidence.json -> within_pitcher.
    return PitchShape(
        release_speed=91.84,
        ivb=ivb,
        horizontal_break=hb,
        extension=6.2,
        release_height=5.9,
        release_side=-1.8,
    )


@given(density=densities)
@settings(max_examples=200, deadline=None)
def test_translating_to_the_same_density_is_the_identity(density):
    out = translate(_shape(), origin_density=density, target_density=density)
    assert out.shape == _shape()


@given(origin=densities, target=densities)
@settings(max_examples=300, deadline=None)
def test_break_never_grows_when_density_drops(origin, target):
    # The core physical invariant: thinner air cannot produce more break.
    out = translate(_shape(), origin_density=origin, target_density=target)
    if target <= origin:
        assert abs(out.shape.ivb) <= abs(_shape().ivb) + 1e-9
        assert abs(out.shape.horizontal_break) <= abs(_shape().horizontal_break) + 1e-9
    else:
        assert abs(out.shape.ivb) >= abs(_shape().ivb) - 1e-9


def test_sea_level_to_extreme_reproduces_the_measured_magnus_ratio():
    # The law is calibrated so this identity holds by construction; if it ever
    # breaks, the constants and the law have drifted apart.
    factor = break_scaling_factor(DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME)
    assert factor == pytest.approx(MAGNUS_RATIO_EXTREME, rel=1e-6)


def test_four_seam_loses_the_measured_amount_of_ivb():
    # Observed within pitcher: 16.95 in at sea level, 13.19 at altitude.
    out = translate(
        _shape(), DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME, pitch_type="Four-Seam"
    )
    assert out.shape.ivb == pytest.approx(12.79, abs=0.45)


@given(origin=densities, target=densities)
@settings(max_examples=100, deadline=None)
def test_velocity_is_never_altered(origin, target):
    out = translate(_shape(), origin, target)
    assert out.shape.release_speed == _shape().release_speed


def test_every_translation_carries_an_error_band():
    out = translate(_shape(), DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME)
    assert out.ivb_se > 0
    assert out.horizontal_break_se > 0
    assert out.release_speed_se > 0


def test_unknown_pitch_type_gets_the_widest_measured_band():
    unknown = translate(_shape(), 1.0, 0.858, pitch_type=None)
    worst_ivb = max(e[0] for e in BREAK_ERROR_IN.values())
    assert unknown.ivb_se == pytest.approx(worst_ivb)


def test_non_positive_density_is_rejected():
    with pytest.raises(ValueError, match="must be positive"):
        translate(_shape(), origin_density=0.0)
