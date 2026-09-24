"""Tests for the textbook air-density model behind gate F3 (docs/09 section 3.1)."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.atmosphere import (
    SEA_LEVEL_PRESSURE_PA,
    air_density,
    isa_density_ratio,
    isa_pressure,
)

altitudes = st.floats(min_value=-400.0, max_value=4000.0)


def test_standard_atmosphere_is_one_at_sea_level():
    assert isa_density_ratio(0.0) == pytest.approx(1.0)
    assert isa_pressure(0.0) == pytest.approx(SEA_LEVEL_PRESSURE_PA)


def test_standard_density_at_mexico_city_altitude():
    # Hand-computed in docs/09 section 3.1: (1 - 0.0065 * 2240 / 288.15) ** 4.25588.
    assert isa_density_ratio(2240.0) == pytest.approx(0.802, abs=0.001)
    assert isa_pressure(2240.0) == pytest.approx(77_155, abs=50)


@given(low=altitudes, high=altitudes)
@settings(max_examples=200, deadline=None)
def test_density_never_rises_with_altitude(low, high):
    if low <= high:
        assert isa_density_ratio(high) <= isa_density_ratio(low) + 1e-12


def test_dry_standard_air_matches_the_textbook_value():
    assert air_density(SEA_LEVEL_PRESSURE_PA, 15.0, 0.0) == pytest.approx(1.225, abs=0.001)


@given(humidity=st.floats(min_value=0.05, max_value=1.0))
@settings(max_examples=100, deadline=None)
def test_humid_air_is_lighter_than_dry_air(humidity):
    # Water vapour has a lower molar mass than dry air.
    assert air_density(90_000, 25.0, humidity) < air_density(90_000, 25.0, 0.0)


def test_warmer_air_is_lighter():
    assert air_density(90_000, 30.0, 0.5) < air_density(90_000, 10.0, 0.5)


def test_mexico_city_against_a_humid_sea_level_park():
    # docs/09 section 2.4: 0.774-0.804 across 15-25 C in Mexico City against a
    # 29 C, 75% humidity sea-level park. The measured Magnus ratio, 0.754,
    # sits just below that range; the drag index, 0.858, well above it.
    sea = air_density(SEA_LEVEL_PRESSURE_PA, 29.0, 0.75)
    ratios = [air_density(isa_pressure(2240.0), t, 0.5) / sea for t in (15.0, 25.0)]
    assert ratios[0] == pytest.approx(0.804, abs=0.002)
    assert ratios[1] == pytest.approx(0.774, abs=0.002)


def test_unphysical_inputs_are_rejected():
    with pytest.raises(ValueError, match="troposphere"):
        isa_pressure(20_000.0)
    with pytest.raises(ValueError, match="humidity"):
        air_density(90_000, 20.0, 1.5)
    with pytest.raises(ValueError, match="positive"):
        air_density(0.0, 20.0, 0.5)
