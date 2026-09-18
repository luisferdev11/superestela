"""Property tests for the density recovery. See CONVENTIONS.md section 7.3."""

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.density import (
    DENSITY_INDEX_EXTREME,
    GRAVITY_FT_S2,
    compute_density_index,
    decompose_trajectory,
)

# Realistic release conditions: ~70-105 mph is 103-154 ft/s, thrown toward the
# plate along -y in this coordinate system.
speeds = st.floats(min_value=100.0, max_value=160.0)
accels = st.floats(min_value=-40.0, max_value=40.0)


def _arr(*values: float) -> np.ndarray:
    return np.array(values, dtype=np.float64)


@given(vy=speeds, ax=accels, az=accels)
@settings(max_examples=200, deadline=None)
def test_drag_is_never_negative_for_a_decelerating_pitch(vy, ax, az):
    # A ball moving through air loses speed along its direction of travel.
    # Construct the acceleration so the parallel component opposes motion.
    d = decompose_trajectory(
        _arr(0.0), _arr(-vy), _arr(0.0), _arr(ax), _arr(abs(ax) + 1.0), _arr(az)
    )
    assert d.drag_accel[0] > 0


@given(vy=speeds)
@settings(max_examples=100, deadline=None)
def test_pure_gravity_leaves_no_aerodynamic_signal(vy):
    # A pitch accelerating under gravity alone has no drag and no Magnus.
    d = decompose_trajectory(
        _arr(0.0), _arr(-vy), _arr(0.0), _arr(0.0), _arr(0.0), _arr(-GRAVITY_FT_S2)
    )
    assert d.drag_accel[0] == pytest.approx(0.0, abs=1e-9)
    assert d.magnus_accel[0] == pytest.approx(0.0, abs=1e-9)


@given(vy=speeds, magnus=st.floats(min_value=1.0, max_value=30.0))
@settings(max_examples=100, deadline=None)
def test_magnus_is_perpendicular_to_velocity(vy, magnus):
    # Acceleration purely across the direction of travel is all Magnus.
    d = decompose_trajectory(
        _arr(0.0), _arr(-vy), _arr(0.0), _arr(magnus), _arr(0.0), _arr(-GRAVITY_FT_S2)
    )
    assert d.drag_accel[0] == pytest.approx(0.0, abs=1e-9)
    assert d.magnus_accel[0] == pytest.approx(magnus, rel=1e-9)


def test_density_index_is_one_at_the_reference():
    idx = compute_density_index(_arr(0.0042), reference_drag_k=0.0042)
    assert idx[0] == pytest.approx(1.0)


def test_density_index_falls_below_one_in_thinner_air():
    # Extreme altitude measures 0.858 of sea-level density.
    idx = compute_density_index(_arr(0.0042 * DENSITY_INDEX_EXTREME), reference_drag_k=0.0042)
    assert idx[0] == pytest.approx(DENSITY_INDEX_EXTREME, rel=1e-9)


@given(
    drag_k=st.floats(min_value=1e-4, max_value=1e-2),
    reference=st.floats(min_value=1e-4, max_value=1e-2),
)
@settings(max_examples=200, deadline=None)
def test_density_index_is_always_a_positive_ratio(drag_k, reference):
    # The invariant from CONVENTIONS.md section 7.3: strictly positive.
    idx = compute_density_index(_arr(drag_k), reference_drag_k=reference)
    assert idx[0] > 0


def test_density_index_rejects_a_non_positive_reference():
    with pytest.raises(ValueError, match="must be positive"):
        compute_density_index(_arr(0.004), reference_drag_k=0.0)
