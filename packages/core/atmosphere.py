"""Air density from altitude and weather, by textbook physics.

This is the external check on what the ball measures (docs/09 section 3.1,
gate F3). The density index in ``core.density`` comes from the pitch's own
drag; this module says what the air should be, from nothing but the
International Standard Atmosphere and the ideal gas law. If the two disagree,
one of them is not measuring density, and docs/09 section 2.4 argues it is
the drag index, because a ball's drag coefficient moves with Reynolds number.

Pure functions only. Every constant is physical, none is from the dataset.
"""

from __future__ import annotations

import math

# International Standard Atmosphere, troposphere (ISO 2533).
SEA_LEVEL_TEMPERATURE_K = 288.15
SEA_LEVEL_PRESSURE_PA = 101_325.0
LAPSE_RATE_K_PER_M = 0.0065
GRAVITY_M_S2 = 9.80665
GAS_CONSTANT = 8.31446  # J / (mol K)
MOLAR_MASS_DRY_AIR = 0.0289652  # kg / mol
MOLAR_MASS_WATER = 0.018016  # kg / mol
KELVIN_OFFSET = 273.15

# g M / (R L): the barometric exponent of the ISA troposphere, 5.25588.
BAROMETRIC_EXPONENT = GRAVITY_M_S2 * MOLAR_MASS_DRY_AIR / (GAS_CONSTANT * LAPSE_RATE_K_PER_M)


def isa_pressure(altitude_m: float) -> float:
    """Return the standard-atmosphere pressure at an altitude, in pascals.

    The station pressure a park actually sees varies with weather by a few
    percent; this is the climatological value, which is what a comparison
    between environments should use.

    Raises:
        ValueError: If the altitude is outside the troposphere model.
    """
    if not -500.0 <= altitude_m <= 11_000.0:
        raise ValueError(f"altitude must be within the troposphere, got {altitude_m} m")
    ratio = 1.0 - LAPSE_RATE_K_PER_M * altitude_m / SEA_LEVEL_TEMPERATURE_K
    return float(SEA_LEVEL_PRESSURE_PA * ratio**BAROMETRIC_EXPONENT)


def isa_density_ratio(altitude_m: float) -> float:
    """Return standard-atmosphere density at an altitude relative to sea level.

    Under the ISA, density falls with the barometric exponent minus one,
    because temperature falls with altitude too. 2,240 m gives 0.802.
    """
    isa_pressure(altitude_m)  # validates the range
    ratio = 1.0 - LAPSE_RATE_K_PER_M * altitude_m / SEA_LEVEL_TEMPERATURE_K
    return float(ratio ** (BAROMETRIC_EXPONENT - 1.0))


def saturation_vapour_pressure(temperature_c: float) -> float:
    """Return the saturation vapour pressure of water over liquid, in pascals.

    Arden Buck (1996), accurate to about 0.05% between -40 and 50 C.
    """
    t = temperature_c
    return 611.21 * math.exp((18.678 - t / 234.5) * (t / (257.14 + t)))


def air_density(pressure_pa: float, temperature_c: float, relative_humidity: float) -> float:
    """Return the density of moist air, in kg per cubic metre.

    Water vapour is lighter than dry air, so humid air is less dense at the
    same pressure and temperature. That is why a humid sea-level park is a
    smaller step down from standard than its altitude suggests.

    Args:
        pressure_pa: Station pressure.
        temperature_c: Air temperature.
        relative_humidity: Between 0 and 1.

    Raises:
        ValueError: If pressure or absolute temperature is not positive, or
            humidity is outside [0, 1].
    """
    temperature_k = temperature_c + KELVIN_OFFSET
    if pressure_pa <= 0 or temperature_k <= 0:
        raise ValueError(
            f"need positive pressure and temperature, got {pressure_pa}, {temperature_c}"
        )
    if not 0.0 <= relative_humidity <= 1.0:
        raise ValueError(f"relative humidity must be in [0, 1], got {relative_humidity}")
    vapour = relative_humidity * saturation_vapour_pressure(temperature_c)
    dry = pressure_pa - vapour
    return (dry * MOLAR_MASS_DRY_AIR + vapour * MOLAR_MASS_WATER) / (GAS_CONSTANT * temperature_k)
