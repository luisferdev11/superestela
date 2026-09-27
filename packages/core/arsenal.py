"""A pitch against its pitcher's primary fastball.

The challenge makes arsenal features part of the Stuff+ definition
(velo_diff_vs_fb, ivb_diff_vs_fb, hb_diff_vs_fb, tunnel_similarity), and
every public model grades secondary pitches by how they differ from the
fastball rather than on their own (docs/09 sections 2.2 and 3.7).

At altitude both pitches lose break by the same factor, so their movement
differentials shrink with them: a changeup 10 inches off its fastball at sea
level is about 7.5 inches off in Mexico City. Velocity differentials survive.
That asymmetry is hypothesis H2 seen from the arsenal, and it is why the
simulator shows the differentials in both environments.

Horizontal quantities are on the ARM SIDE, as in analysis/simulator_evidence.py.
Pure functions only: no I/O, no dataset.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

# The pitches that can anchor an arsenal. Driveline and FanGraphs both take the
# most-used of these as the primary fastball.
FASTBALL_TYPES = ("Four-Seam", "Sinker", "Cutter")


@dataclass(frozen=True)
class ArsenalPitch:
    """One pitch of a pitcher's repertoire, averaged over a season."""

    pitch_type: str
    usage: float  # share of the pitcher's pitches, 0 to 1
    release_speed: float  # mph
    ivb: float  # inches
    horizontal_break: float  # inches, arm side positive
    release_height: float  # feet
    release_side: float  # feet, arm side positive


@dataclass(frozen=True)
class Differentials:
    """How a pitch differs from the primary fastball, as the challenge defines it."""

    release_speed: float  # mph, negative when slower than the fastball
    ivb: float  # inches
    horizontal_break: float  # inches
    release_distance: float  # feet between release points; small tunnels well


def primary_fastball(arsenal: Sequence[ArsenalPitch]) -> ArsenalPitch | None:
    """Return the most-used fastball of an arsenal, or None if it has none.

    A pitcher without a four-seam, sinker or cutter has no anchor, and his
    secondary pitches cannot be graded against one. Returning None makes the
    caller say so instead of inventing a reference.
    """
    fastballs = [p for p in arsenal if p.pitch_type in FASTBALL_TYPES]
    if not fastballs:
        return None
    return max(fastballs, key=lambda p: p.usage)


def differentials(pitch: ArsenalPitch, fastball: ArsenalPitch) -> Differentials:
    """Return the pitch minus its fastball on each axis the challenge names."""
    return Differentials(
        release_speed=pitch.release_speed - fastball.release_speed,
        ivb=pitch.ivb - fastball.ivb,
        horizontal_break=pitch.horizontal_break - fastball.horizontal_break,
        release_distance=math.hypot(
            pitch.release_height - fastball.release_height,
            pitch.release_side - fastball.release_side,
        ),
    )
