"""Air density recovered from the ball's own trajectory.

The dataset ships a coarse three-level `altitude_category` label. That label is
not a measurement: it cannot tell a cold night in Monterrey from a warm one,
and it collapses every park at a given tier into one number. So we do not use
it. We measure air density from the pitch itself.

The measured acceleration of a pitch decomposes into three parts:

    a_measured = g + a_drag + a_magnus

with drag antiparallel to the velocity vector and Magnus perpendicular to it.
Projecting the gravity-corrected acceleration onto the unit velocity vector
separates the two cleanly. The drag coefficient

    drag_k = |a_drag| / v^2  ~  rho * Cd * A / (2m)

is proportional to air density for a ball of fixed mass and cross-section, so
the RATIO of drag_k between two environments is a relative density measurement
with no free parameters.

Everything here is a pure function of arrays. No I/O, no file paths, no
competition data: this is the IP boundary described in docs/04 section 5.1.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float64]

GRAVITY_FT_S2 = 32.174  # standard gravity in the dataset's units (ft/s^2)

# Density index of the extreme-altitude environment, sea level being 1.000.
# measured, evidence.json -> density."Extreme Altitude".per_game_mean
DENSITY_INDEX_EXTREME = 0.858

# Same quantity for the medium-altitude tier.
# measured, evidence.json -> density."Medium Altitude".per_game_mean
DENSITY_INDEX_MEDIUM = 0.903

DENSITY_INDEX_SEA_LEVEL = 1.0


@dataclass(frozen=True)
class TrajectoryDecomposition:
    """Drag and Magnus components recovered from a measured trajectory.

    Attributes are arrays parallel to the inputs, one entry per pitch.
    """

    speed: FloatArray
    drag_accel: FloatArray
    magnus_accel: FloatArray
    drag_k: FloatArray
    magnus_k: FloatArray


def decompose_trajectory(
    vx: FloatArray,
    vy: FloatArray,
    vz: FloatArray,
    ax: FloatArray,
    ay: FloatArray,
    az: FloatArray,
) -> TrajectoryDecomposition:
    """Split measured acceleration into its drag and Magnus components.

    Gravity is removed first, then the remainder is projected onto the unit
    velocity vector: the parallel part is drag, the perpendicular part is
    Magnus. Both are normalised by v^2 so that the result is a coefficient
    rather than an acceleration, which is what makes it comparable across
    pitches thrown at different speeds.

    Args:
        vx: Velocity component across the plate, ft/s.
        vy: Velocity component toward the plate, ft/s.
        vz: Vertical velocity component, ft/s.
        ax: Measured acceleration across the plate, ft/s^2.
        ay: Measured acceleration toward the plate, ft/s^2.
        az: Measured vertical acceleration, ft/s^2, still containing gravity
            as the tracking system reports it.

    Returns:
        The decomposition, with one entry per input pitch.
    """
    speed = np.sqrt(vx**2 + vy**2 + vz**2)

    # Remove gravity so that what is left is aerodynamic.
    axg, ayg, azg = ax, ay, az + GRAVITY_FT_S2

    ux, uy, uz = vx / speed, vy / speed, vz / speed
    parallel = axg * ux + ayg * uy + azg * uz
    drag_accel = -parallel  # positive: drag decelerates the ball

    mx = axg - parallel * ux
    my = ayg - parallel * uy
    mz = azg - parallel * uz
    magnus_accel = np.sqrt(mx**2 + my**2 + mz**2)

    return TrajectoryDecomposition(
        speed=speed,
        drag_accel=drag_accel,
        magnus_accel=magnus_accel,
        drag_k=drag_accel / speed**2,
        magnus_k=magnus_accel / speed**2,
    )


def compute_density_index(drag_k: FloatArray, reference_drag_k: float) -> FloatArray:
    """Convert drag coefficients into a density index normalised to sea level.

    The index is a ratio, so the unknown constants of the drag law (Cd, the
    cross-section, the ball's mass) cancel. A value of 1.000 means sea-level
    density; 0.858 is what the extreme-altitude parks actually measure.

    Args:
        drag_k: Drag coefficients, typically averaged per game to suppress
            per-pitch measurement noise.
        reference_drag_k: Mean drag coefficient of the sea-level environment.

    Returns:
        The density index, one entry per input.

    Raises:
        ValueError: If the reference is not strictly positive, which would
            make the ratio meaningless rather than merely wrong.
    """
    if reference_drag_k <= 0:
        raise ValueError(f"reference_drag_k must be positive, got {reference_drag_k}")
    return drag_k / reference_drag_k
