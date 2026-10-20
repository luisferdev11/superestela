"""Summarize a tracking export into the arsenal the translator asks about (P3).

The translator's real case is the pitcher who is not in our data: a free
agent, someone from MLB or Japan (deliverable 3c). The club has his tracking
export, one row per pitch, with the vendor's columns. This module turns that
file into one row per pitch type -- the shape the translator's table holds --
and says what it could not use.

It decides nothing about pitch quality. It renames the vendor columns
(``contracts.mapping``), mirrors horizontals to the arm side
(``models.scoring.to_arm_side``) like the scoring harness does, and
aggregates. Every score still comes from ``POST /simulate``.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Literal, get_args

import numpy as np
import pandas as pd

from api.schemas import Hand, PitchType
from contracts.mapping import CANONICAL_TO_VENDOR, normalize_columns
from models.batch import NUMERIC, PITCHER, REQUIRED
from models.scoring import to_arm_side

SUPPORTED_PITCH_TYPES: tuple[str, ...] = get_args(PitchType)

# One row per pitch type, as in arsenals.json; the translator's MAX_ROWS.
MAX_PITCH_TYPES = 6

Origin = Literal["sea", "medium"]

# The dataset's altitude categories, as the translator names its origins.
ORIGIN_BY_ENVIRONMENT: dict[str, Origin] = {
    "No Altitude": "sea",
    "Medium Altitude": "medium",
}
EXTREME = "Extreme Altitude"

ProblemCode = Literal[
    "unreadable", "empty", "missing_columns", "mixed_pitchers", "mixed_hands", "too_many_pitchers"
]


class ArsenalFileError(ValueError):
    """The file cannot be summarized; ``code`` says why, for the screen to word it."""

    def __init__(self, code: ProblemCode, columns: tuple[str, ...] = ()) -> None:
        """Keep the reason and, when columns are missing, which ones."""
        super().__init__(code if not columns else f"{code}: {', '.join(columns)}")
        self.code: ProblemCode = code
        self.columns = columns


def missing_columns(canonical: tuple[str, ...]) -> ArsenalFileError:
    """The refusal for missing columns, naming them as the file should carry them.

    The person fixing the file reads TrackMan's names (``InducedVertBreak``),
    not ours (``ivb``); a column with no vendor name (``pitcher_anon_id``)
    keeps its own.
    """
    return ArsenalFileError(
        "missing_columns", tuple(CANONICAL_TO_VENDOR.get(c, c) for c in canonical)
    )


@dataclass(frozen=True)
class PitchSummary:
    """One pitch type of the file, on the arm side, with its share of the pitches used."""

    pitch_type: str
    n: int
    usage: float
    release_speed: float
    ivb: float
    horizontal_break: float
    spin_rate: float
    spin_axis: float
    extension: float
    release_height: float
    release_side: float


@dataclass(frozen=True)
class ArsenalSummary:
    """The file as an arsenal, and an account of every row that did not make it."""

    pitcher_hand: Hand
    origin: Origin | None
    is_measured_at_extreme: bool
    n_rows: int
    pitches: tuple[PitchSummary, ...]
    unsupported_rows: int
    missing_feature_rows: int
    unsupported_types: tuple[str, ...] = field(default=())
    omitted_types: tuple[str, ...] = field(default=())


def _circular_mean_deg(angles: pd.Series) -> float:
    """Mean of an angle in degrees: a median of 359 and 1 would say 180."""
    rad = np.deg2rad(angles.to_numpy(dtype=float))
    mean = np.rad2deg(np.arctan2(np.sin(rad).mean(), np.cos(rad).mean()))
    return float(mean % 360)


def _origin_of(df: pd.DataFrame) -> tuple[Origin | None, bool]:
    """Where the file was measured, if it says so with a single category."""
    if "environment" not in df.columns:
        return None, False
    values = df["environment"].dropna().unique()
    if len(values) != 1:
        return None, False
    only = str(values[0])
    return ORIGIN_BY_ENVIRONMENT.get(only), only == EXTREME


def summarize_arsenal(csv_text: str) -> ArsenalSummary:
    """Read a tracking export and aggregate it by pitch type.

    Shape is the median of each control, and spin axis its circular mean, so
    a handful of misread pitches does not move the arsenal. Usage is each
    type's share of the pitches that could be used. At most six types are
    kept, the most thrown; the rest are named in ``omitted_types``.

    Raises:
        ArsenalFileError: When the file is not a table, has no rows, lacks a
            required column, mixes pitchers, or mixes or lacks the hand.
    """
    try:
        raw = pd.read_csv(io.StringIO(csv_text))
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        code: ProblemCode = "empty" if isinstance(exc, pd.errors.EmptyDataError) else "unreadable"
        raise ArsenalFileError(code) from exc
    df = normalize_columns(raw)
    if df.empty:
        raise ArsenalFileError("empty")
    missing = tuple(c for c in REQUIRED if c not in df.columns)
    if missing:
        raise missing_columns(missing)
    if PITCHER in df.columns and len(df[PITCHER].dropna().unique()) > 1:
        raise ArsenalFileError("mixed_pitchers")
    hands = df["pitcher_hand"].dropna().unique()
    if len(hands) != 1 or hands[0] not in ("Right", "Left"):
        raise ArsenalFileError("mixed_hands")
    hand: Hand = "Right" if hands[0] == "Right" else "Left"

    origin, is_extreme = _origin_of(df)
    numeric = df.assign(**{c: pd.to_numeric(df[c], errors="coerce") for c in NUMERIC})
    is_supported = numeric["pitch_type"].isin(SUPPORTED_PITCH_TYPES)
    is_complete = numeric[list(NUMERIC)].notna().all(axis=1)
    usable = numeric[is_supported & is_complete]
    hb, side, axis = to_arm_side(
        usable["pitcher_hand"],
        usable["horizontal_break"],
        usable["release_side"],
        usable["spin_axis"],
    )
    usable = usable.assign(horizontal_break=hb, release_side=side, spin_axis=axis)

    counts = usable["pitch_type"].value_counts()
    kept = counts.index[:MAX_PITCH_TYPES]
    total = int(counts.loc[kept].sum())
    pitches = tuple(
        PitchSummary(
            pitch_type=str(t),
            n=int(counts[t]),
            usage=float(counts[t] / total),
            release_speed=float(g["release_speed"].median()),
            ivb=float(g["ivb"].median()),
            horizontal_break=float(g["horizontal_break"].median()),
            spin_rate=float(g["spin_rate"].median()),
            spin_axis=_circular_mean_deg(g["spin_axis"]),
            extension=float(g["extension"].median()),
            release_height=float(g["release_height"].median()),
            release_side=float(g["release_side"].median()),
        )
        for t in kept
        for g in [usable[usable["pitch_type"] == t]]
    )
    unsupported = numeric.loc[~is_supported, "pitch_type"].dropna().astype(str)
    return ArsenalSummary(
        pitcher_hand=hand,
        origin=origin,
        is_measured_at_extreme=is_extreme,
        n_rows=len(df),
        pitches=pitches,
        unsupported_rows=int((~is_supported).sum()),
        missing_feature_rows=int((is_supported & ~is_complete).sum()),
        unsupported_types=tuple(sorted(unsupported.unique())),
        omitted_types=tuple(str(t) for t in counts.index[MAX_PITCH_TYPES:]),
    )
