"""Whether a shape is coherent with its spin: hypothesis H4 made usable.

The challenge asks the model to capture spin efficiency, not raw rpm. The
absolute efficiency is not identifiable from this data: the four-seam median
moves from 0.651 to 0.894 with the assumed air density and lift fit
(simulator.json -> spin_efficiency_check; docs/09 section 2.5). A number
that soft is not shown.

What is shown is empirical and assumption-free. Movement per 1,000 rpm, as a
percentile within the pitch type, says whether two pitches with the same spin
are the same pitch. And a Mahalanobis distance over velocity, IVB, HB and spin
flags a combination nobody has thrown. Bounds checked one quantity at a time
let 22 in of ride on 1,500 rpm through: the spin tail holds tracking errors
that drag its low bound to 1,178 rpm. A covariance fitted on the central 95%
does not inflate that way, and it also catches shapes where every value is
within its own bound but the combination is not (97 mph, 24 in, 0 in, 1,900).
The means, covariance and threshold are data, so the caller passes them in;
this module only does the arithmetic.

Pure functions only: no I/O, no dataset.
"""

from __future__ import annotations

import bisect
import itertools
import math
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Bounds:
    """The central range of one quantity, as the league throws it."""

    low: float
    high: float

    def contains(self, value: float) -> bool:
        """Whether the value falls inside the range, bounds included."""
        return self.low <= value <= self.high


def movement_per_krpm(ivb: float, horizontal_break: float, spin_rate: float) -> float:
    """Return total break in inches per 1,000 rpm of spin.

    Raises:
        ValueError: If spin is not positive; a spinless pitch has no ratio.
    """
    if spin_rate <= 0:
        raise ValueError(f"spin rate must be positive, got {spin_rate}")
    return math.hypot(ivb, horizontal_break) / (spin_rate / 1000.0)


def percentile_rank(value: float, percentiles: Sequence[float]) -> float:
    """Return where a value falls in a distribution given by its 1st-99th percentiles.

    Linear between the listed percentiles and clamped to [1, 99] outside them,
    because the tails beyond the 1st and 99th are not measured well enough to
    rank.

    Raises:
        ValueError: If the list is not the 99 percentiles, in order.
    """
    if len(percentiles) != 99 or any(b < a for a, b in itertools.pairwise(percentiles)):
        raise ValueError("expected the 1st to 99th percentiles in ascending order")
    if value <= percentiles[0]:
        return 1.0
    if value >= percentiles[-1]:
        return 99.0
    i = bisect.bisect_right(percentiles, value)
    lo, hi = percentiles[i - 1], percentiles[i]
    fraction = 0.0 if hi == lo else (value - lo) / (hi - lo)
    return float(i + fraction)


@dataclass(frozen=True)
class Envelope:
    """What the league throws for one pitch type, from simulator.json -> plausibility."""

    mean: Sequence[float]  # release speed, ivb, horizontal break, spin rate
    inverse_covariance: Sequence[Sequence[float]]
    threshold: float  # squared distance above which a shape is flagged
    bounds: dict[str, Bounds]  # per quantity, to say which one is unusual


@dataclass(frozen=True)
class Plausibility:
    """Whether a shape has been thrown, and if not, what stands out."""

    is_plausible: bool
    squared_distance: float
    threshold: float
    unusual: tuple[str, ...]


def assess_plausibility(
    release_speed: float,
    ivb: float,
    horizontal_break: float,
    spin_rate: float,
    envelope: Envelope,
) -> Plausibility:
    """Return whether this combination sits inside what the league throws.

    Args:
        release_speed: mph.
        ivb: Inches.
        horizontal_break: Inches, arm side positive.
        spin_rate: rpm.
        envelope: The pitch type's envelope.
    """
    x = [release_speed, ivb, horizontal_break, spin_rate]
    centred = [v - m for v, m in zip(x, envelope.mean, strict=True)]
    distance = sum(
        centred[i] * envelope.inverse_covariance[i][j] * centred[j]
        for i in range(len(x))
        for j in range(len(x))
    )
    values = {
        "release_speed": release_speed,
        "ivb": ivb,
        "horizontal_break": horizontal_break,
        "spin_rate": spin_rate,
        "movement_per_krpm": movement_per_krpm(ivb, horizontal_break, spin_rate),
    }
    unusual = tuple(
        name
        for name, value in values.items()
        if name in envelope.bounds and not envelope.bounds[name].contains(value)
    )
    return Plausibility(
        is_plausible=distance <= envelope.threshold,
        squared_distance=float(distance),
        threshold=envelope.threshold,
        unusual=unusual,
    )
