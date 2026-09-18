"""The Altitude Translator: a pitch's shape moved between air densities.

Contract C of docs/07 section 1.3. Given a shape measured in one environment,
predict the same pitcher's shape in another, with an error band per axis.

The scaling law is measured, not assumed. Across the full dataset the Magnus
coefficient falls to 0.7543 of its sea-level value while the density index
falls to 0.858, so break scales with density raised to

    log(0.7543) / log(0.858) = 1.841

That exponent is steeper than the linear scaling a textbook Magnus term would
predict. We use the measured value rather than the textbook one because the
measurement is what we can defend: it reproduces the observed ratio exactly by
construction, and it degrades to the identity when origin and target match.

Velocity is deliberately left untouched. Within pitcher, altitude moves release
speed by +0.10 mph with 39.9% of pitchers losing - a coin flip, which is what
"no effect" looks like in this data (evidence.json -> within_pitcher).

Pure functions only: no I/O, no dataset. See CONVENTIONS.md section 8 rule 6.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace

from core.density import DENSITY_INDEX_EXTREME

# measured, evidence.json -> translator.magnus_ratio_measured
MAGNUS_RATIO_EXTREME = 0.7543

# Implied by the two measurements above; see the module docstring.
MAGNUS_DENSITY_EXPONENT = math.log(MAGNUS_RATIO_EXTREME) / math.log(DENSITY_INDEX_EXTREME)

# Holdout RMSE of the zero-parameter physics estimator, in inches, validated on
# pitchers never seen during calibration.
# measured, evidence.json -> translator.by_pitch.<type>.<axis>.holdout_rmse_physics_in
BREAK_ERROR_IN: dict[str, tuple[float, float]] = {
    # pitch type: (ivb error, horizontal break error)
    "Four-Seam": (0.92, 0.97),
    "Sinker": (1.42, 0.99),
    "Slider": (1.07, 1.06),
    "Changeup": (1.47, 1.36),
    "Curveball": (1.52, 1.41),
}

# Used when the pitch type is unknown: the worst measured case, so that an
# unlabelled pitch is never reported with more confidence than we earned.
DEFAULT_BREAK_ERROR_IN = (1.52, 1.41)

# Within-pitcher standard deviation of the velocity delta, mph.
# measured, evidence.json -> within_pitcher."Four-Seam".velo.delta_sd
RELEASE_SPEED_ERROR_MPH = 0.57


@dataclass(frozen=True)
class PitchShape:
    """A pitch's measured shape, in the canonical units of the dataset."""

    release_speed: float  # mph
    ivb: float  # inches, induced vertical break
    horizontal_break: float  # inches, signed
    extension: float  # feet
    release_height: float  # feet
    release_side: float  # feet


@dataclass(frozen=True)
class TranslatedShape:
    """A projected shape, with the error band that goes with it.

    The band is not decoration. Product renders it on every number, so a
    translation without one cannot be displayed (CONVENTIONS.md section 8).
    """

    shape: PitchShape
    ivb_se: float
    horizontal_break_se: float
    release_speed_se: float


def break_scaling_factor(origin_density: float, target_density: float) -> float:
    """Return the factor by which Magnus-driven break changes between densities.

    Args:
        origin_density: Density index where the shape was measured.
        target_density: Density index to project to.

    Returns:
        A positive multiplier, exactly 1.0 when the densities match.

    Raises:
        ValueError: If either density is not strictly positive.
    """
    if origin_density <= 0 or target_density <= 0:
        raise ValueError(
            f"densities must be positive, got origin={origin_density}, target={target_density}"
        )
    return float((target_density / origin_density) ** MAGNUS_DENSITY_EXPONENT)


def translate(
    shape: PitchShape,
    origin_density: float,
    target_density: float = DENSITY_INDEX_EXTREME,
    pitch_type: str | None = None,
) -> TranslatedShape:
    """Project a pitch's shape from one air density to another.

    Both break axes scale by the measured density law; velocity, release height
    and release side are carried through unchanged because the data shows no
    altitude effect on them.

    Args:
        shape: The shape as measured in the origin environment.
        origin_density: Density index of the environment it was measured in.
        target_density: Density index to project to. Defaults to the extreme
            altitude tier, which is the question the product is usually asking.
        pitch_type: Vendor pitch type, used only to pick the error band. When
            unknown, the widest measured band is used.

    Returns:
        The projected shape and its per-axis standard error.
    """
    factor = break_scaling_factor(origin_density, target_density)
    projected = replace(
        shape,
        ivb=shape.ivb * factor,
        horizontal_break=shape.horizontal_break * factor,
    )
    ivb_se, hb_se = BREAK_ERROR_IN.get(pitch_type or "", DEFAULT_BREAK_ERROR_IN)
    return TranslatedShape(
        shape=projected,
        ivb_se=ivb_se,
        horizontal_break_se=hb_se,
        release_speed_se=RELEASE_SPEED_ERROR_MPH,
    )
