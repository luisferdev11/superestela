"""Runs allowed per nine innings, the closest thing to an ERA these data allow.

The dataset carries the runs scored on each pitch (``RunsScored``) and the
outs it recorded (``OutsOnPlay``, strikeouts included), but nothing marks a run
as earned or unearned, and an inherited runner's run is charged to whoever was
pitching. So an ERA cannot be computed; RA/9, all runs over innings, can, and
the screen calls it that.

The band treats the runs as Poisson, with one run added to the count so that
a scoreless stretch does not claim "0.00 +- 0.00" (the same honesty as
``core.rates``). Runs come in bunches (a three-run homer), so the real spread
is wider; the band is a floor, and the screen says it is.
"""

from __future__ import annotations

import math

from core.rates import Z95

# Product rule, 14 October 2026: below ten innings in an environment, a single
# bad outing decides the number. The screen shows "muestra insuficiente".
MIN_INNINGS_FOR_RA9 = 10.0


def runs_allowed_per_nine(runs: int, outs: int) -> tuple[float, float, float] | None:
    """Return RA/9, its 95% half-width and the innings, or None with too few innings.

    Args:
        runs: Runs scored while this pitcher was on the mound.
        outs: Outs recorded, strikeouts included.

    Raises:
        ValueError: On negative counts.
    """
    if runs < 0 or outs < 0:
        raise ValueError("runs and outs are counts")
    innings = outs / 3
    if innings < MIN_INNINGS_FOR_RA9:
        return None
    ra9 = 9 * runs / innings
    half = Z95 * 9 * math.sqrt(runs + 1) / innings
    return ra9, half, innings
