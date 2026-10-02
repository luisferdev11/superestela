"""The contract every Stuff+ model answers through. ADR 0007.

The simulator asks for the Stuff+ of a pitch nobody threw. Whatever model is
current answers that question through this interface, so the screen, the API
and the acceptance gates never change when the model does: today it is the
v0 bridge, after A3 it is the data team's model, and only ``model_id`` moves.

A score is never a bare number. It travels with its standard error, which is
what CONVENTIONS.md section 8.2 requires of anything the product shows.
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import joblib
import numpy as np
import numpy.typing as npt
import pandas as pd

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
    # Where 100 sits: "league" (the whole league, v0) or "per_environment" (100
    # in each altitude category, as Diablos asked; docs/11). The web words the
    # delta from it. Optional: a model pickled before the field reads "league".
    kind: str = "league"


@dataclass(frozen=True)
class Score:
    """A Stuff+ with its uncertainty and the model that produced it."""

    value: float
    se: float
    model_id: str


@runtime_checkable
class Scorer(Protocol):
    """What any Stuff+ model must provide to be shown in the product.

    ``pitch_types`` lists the ``pitch_type`` values the model was trained on.
    Anything else gets no score: a tree model fed a type it never saw returns
    a number, and that number means nothing.
    """

    model_id: str
    uses_arsenal: bool
    scale: ScaleSpec
    pitch_types: tuple[str, ...]

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

        The draws ARE the score: the API and ``models.score`` report their mean
        as the Stuff+ and their standard deviation (ddof=1) as its se, so a model
        must return at least two draws, and their mean must be what ``score``
        returns. A model with a point estimate and a separate posterior has to
        honour this, or the API and the file scorer would disagree.
        """
        ...


FloatArray = npt.NDArray[np.float64]


def to_arm_side(
    pitcher_hand: npt.ArrayLike,
    horizontal_break: npt.ArrayLike,
    release_side: npt.ArrayLike,
    spin_axis: npt.ArrayLike,
) -> tuple[FloatArray, FloatArray, FloatArray]:
    """Mirror the tracking system's horizontals to the arm side, as PitchInput expects.

    The vendor reports horizontal break and release side from the catcher's
    view and spin axis in the right-hander's frame, so a left-hander's numbers
    are a right-hander's flipped. Mirroring them makes a left-hander and his
    mirrored right-hander the same input apart from the hand. The gates and
    ``models.score`` go through here; the API receives pitches already on the
    arm side, as ``PitchInput`` defines them.

    Returns:
        ``(horizontal_break, release_side, spin_axis)`` on the arm side.

    Raises:
        ValueError: On a hand other than "Right" or "Left": mirroring an
            "Undefined" as a left-hander would invent a pitch.
    """
    hands = np.asarray(pitcher_hand)
    if not np.isin(hands, ["Right", "Left"]).all():
        raise ValueError("pitcher_hand must be 'Right' or 'Left' on every row")
    sign = np.where(hands == "Right", 1.0, -1.0)
    axis = np.asarray(spin_axis, dtype=float)
    return (
        np.asarray(horizontal_break, dtype=float) * sign,
        np.asarray(release_side, dtype=float) * sign,
        np.where(sign > 0, axis, (360.0 - axis) % 360.0),
    )


def verdict_path(model_path: str) -> str:
    """Where analysis/simulator_gates.py leaves the gates' verdict for a model file."""
    return os.path.splitext(model_path)[0] + ".validation.json"


def load_scorer(path: str) -> Scorer:
    """Read a fitted model from ``artifacts/`` and check that it answers the contract.

    This is the one loader every consumer uses -- the API, the gates, the
    evidence that feeds the screens and ``models.score`` -- so a model that
    loads here is a model the whole product can show. Any class works, as
    long as it satisfies ``Scorer``.

    Raises:
        TypeError: If the file holds something that is not a ``Scorer``.
    """
    model = joblib.load(path)
    if not isinstance(model, Scorer):
        raise TypeError(f"{path} does not hold a models.scoring.Scorer")
    return model


# Pitches per call to the model: bounds the memory of the draws, not the result.
CHUNK_SIZE = 50_000


def stuff_plus_of(scorer: Scorer, frame: pd.DataFrame) -> tuple[FloatArray, FloatArray]:
    """Stuff+ and its se for every row of a canonical frame, through the contract.

    ``frame`` is already on the arm side, with the ``PitchInput`` columns and
    ``density_index``. Like the API and ``models.score``, the Stuff+ is the mean
    of the draws and the se their standard deviation, so a pitch is worth the
    same in every screen.
    """
    value = np.full(len(frame), np.nan)
    se = np.full(len(frame), np.nan)
    for start in range(0, len(frame), CHUNK_SIZE):
        part = frame.iloc[start : start + CHUNK_SIZE]
        pitches = [
            PitchInput(
                pitch_type=str(r["pitch_type"]),
                pitcher_hand=str(r["pitcher_hand"]),
                release_speed=float(r["release_speed"]),
                ivb=float(r["ivb"]),
                horizontal_break=float(r["horizontal_break"]),
                spin_rate=float(r["spin_rate"]),
                spin_axis=float(r["spin_axis"]),
                extension=float(r["extension"]),
                release_height=float(r["release_height"]),
                release_side=float(r["release_side"]),
            )
            for r in part.to_dict("records")
        ]
        draws = scorer.draws(pitches, part["density_index"].astype(float).tolist())
        if draws.shape[0] < 2:
            raise ValueError(f"{scorer.model_id} returned one draw: a score needs its spread")
        value[start : start + len(part)] = draws.mean(axis=0)
        se[start : start + len(part)] = draws.std(axis=0, ddof=1)
    return value, se
