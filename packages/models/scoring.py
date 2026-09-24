"""The contract every Stuff+ model answers through. ADR 0007.

The simulator asks for the Stuff+ of a pitch nobody threw. Whatever model is
current answers that question through this interface, so the screen, the API
and the acceptance gates never change when the model does: today it is the
v0 bridge, after A3 it is the data team's model, and only ``model_id`` moves.

A score is never a bare number. It travels with its standard error, which is
what CONVENTIONS.md section 8.2 requires of anything the product shows.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import numpy as np
import numpy.typing as npt

from core.arsenal import ArsenalPitch


@dataclass(frozen=True)
class PitchInput:
    """The physical features the challenge defines Stuff+ on, at release.

    Horizontal quantities are on the ARM SIDE, positive toward the pitcher's
    throwing arm, so a left-hander and his mirrored right-hander are the same
    input apart from ``pitcher_hand``.
    """

    pitch_type: str
    pitcher_hand: str  # "Right" or "Left"
    release_speed: float  # mph
    ivb: float  # inches
    horizontal_break: float  # inches, arm side positive
    spin_rate: float  # rpm
    spin_axis: float  # degrees, right-hander frame
    extension: float  # feet
    release_height: float  # feet
    release_side: float  # feet, arm side positive


@dataclass(frozen=True)
class ArsenalContext:
    """The pitcher's repertoire, so a model can grade a pitch against its fastball.

    It travels from day one even though the v0 bridge ignores it: the model
    that uses it (A1) then plugs in without touching the API or the screen.
    """

    pitches: tuple[ArsenalPitch, ...]


@dataclass(frozen=True)
class ScaleSpec:
    """How 100 and one standard deviation are defined for this model's Stuff+."""

    description: str
    mean_xrv: float
    sd_xrv: float


@dataclass(frozen=True)
class Score:
    """A Stuff+ with its uncertainty and the model that produced it."""

    value: float
    se: float
    model_id: str


class Scorer(Protocol):
    """What any Stuff+ model must provide to be shown in the product."""

    model_id: str
    uses_arsenal: bool
    scale: ScaleSpec

    def score(
        self, pitch: PitchInput, arsenal: ArsenalContext | None, density_index: float
    ) -> Score:
        """Return the Stuff+ of one pitch in an environment of this density index."""
        ...

    def draws(
        self, pitches: Sequence[PitchInput], density_indices: Sequence[float]
    ) -> npt.NDArray[np.float64]:
        """Return Stuff+ draws, one row per draw and one column per pitch.

        Joint draws are what put a band on a DIFFERENCE: the altitude delta of
        a pitch compares two scores that share every draw, so their errors are
        correlated and adding the two se's would overstate the band.
        """
        ...
