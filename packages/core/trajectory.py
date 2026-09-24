"""How a pitch arrives: plate speed and vertical approach angle (VAA).

A shape change at altitude is only half of what the hitter sees. Thinner air
also slows the ball less, so it reaches the plate faster, and a fastball that
lost ride comes in steeper. Both follow from the simulator's own inputs plus
the velocity lost on the way, which is measured per pitch type and
environment and passed in (docs/09 section 3.5).

Kinematics with uniform deceleration along the path and a constant vertical
acceleration: gravity plus the Magnus lift that induced vertical break
measures. Against the dataset's own VertApprAngle this reproduces the angle
to 0.079 degrees RMSE (probe of 2026-09-23; gate F5 formalises it).

Pure functions only: no I/O, no dataset.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

GRAVITY_FT_S2 = 32.174
MPH_TO_FT_S = 5280.0 / 3600.0
RUBBER_TO_PLATE_TIP_FT = 60.5
# The dataset measures arrival at the front of the plate, 17 inches from the tip.
PLATE_FRONT_FT = 17.0 / 12.0
# Mid strike zone, the height the simulator aims every pitch at so that two
# shapes are compared at the same target. The rulebook zone spans roughly
# 1.5 to 3.5 ft for an average hitter.
MID_ZONE_HEIGHT_FT = 2.5


@dataclass(frozen=True)
class Approach:
    """How the pitch arrives at the front of the plate."""

    plate_speed: float  # mph
    flight_time: float  # seconds
    vaa: float  # degrees, negative when descending


def approach(
    release_speed: float,
    speed_loss: float,
    ivb: float,
    extension: float,
    release_height: float,
    plate_height: float = MID_ZONE_HEIGHT_FT,
) -> Approach:
    """Return plate speed, flight time and VAA for a pitch.

    Args:
        release_speed: Velocity at release, mph.
        speed_loss: Velocity lost between release and plate, mph. It depends on
            the air, so the caller passes the value measured for the
            environment being simulated.
        ivb: Induced vertical break, inches.
        extension: Release distance in front of the rubber, feet.
        release_height: Feet.
        plate_height: Where the pitch crosses the front of the plate, feet.

    Raises:
        ValueError: If the speeds are not physical or the release is behind
            the plate.
    """
    if release_speed <= 0 or not 0 <= speed_loss < release_speed:
        raise ValueError(f"need 0 <= speed_loss < release_speed, got {speed_loss}, {release_speed}")
    distance = RUBBER_TO_PLATE_TIP_FT - extension - PLATE_FRONT_FT
    if distance <= 0:
        raise ValueError(f"extension {extension} ft puts the release past the plate")

    plate_speed = release_speed - speed_loss
    mean_speed = 0.5 * (release_speed + plate_speed) * MPH_TO_FT_S
    t = distance / mean_speed
    # IVB is the lift displacement over the flight: ivb = a_lift t^2 / 2.
    vertical_accel = -GRAVITY_FT_S2 + 2.0 * (ivb / 12.0) / t**2
    initial_vz = ((plate_height - release_height) - 0.5 * vertical_accel * t**2) / t
    final_vz = initial_vz + vertical_accel * t
    vaa = math.degrees(math.atan(final_vz / (plate_speed * MPH_TO_FT_S)))
    return Approach(plate_speed=plate_speed, flight_time=t, vaa=vaa)
