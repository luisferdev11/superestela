"""Rates with their band: strikeouts, walks and whiffs counted out of chances.

Pure arithmetic on counts, no data. The plain binomial (Wald) band collapses
to zero at a rate of 0 or 1: a reliever with no walks in 50 plate appearances
would show "BB% 0.0 +- 0.0", which claims a certainty nobody has. The band
here is Agresti-Coull's: the same formula on the counts plus two successes and
two failures, which stays honest at the edges and matches Wald in the middle.
The point estimate stays the observed rate.
"""

from __future__ import annotations

import math

Z95 = 1.959964  # two-sided 95%


def rate_band(successes: int, trials: int) -> tuple[float, float]:
    """Return a rate and its 95% half-width, both as fractions.

    Raises:
        ValueError: With no trials, there is no rate.
    """
    if trials <= 0:
        raise ValueError("a rate needs at least one trial")
    adjusted = (successes + 2) / (trials + 4)
    half = Z95 * math.sqrt(adjusted * (1 - adjusted) / (trials + 4))
    return successes / trials, half


def difference_band(first: int, second: int, trials: int) -> tuple[float, float]:
    """Return the difference of two shares of the same trials, and its 95% half-width.

    K-BB%: strikeouts and walks are two outcomes of the same plate
    appearances, so they covary. The variance of the difference of two
    multinomial shares is (p1 + p2 - (p1 - p2)^2) / n, on the same Agresti-Coull
    adjusted counts as ``rate_band``.
    """
    if trials <= 0:
        raise ValueError("a rate needs at least one trial")
    n = trials + 4
    p1, p2 = (first + 1) / n, (second + 1) / n
    half = Z95 * math.sqrt((p1 + p2 - (p1 - p2) ** 2) / n)
    return (first - second) / trials, half
