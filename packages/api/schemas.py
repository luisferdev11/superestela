"""Wire format of the simulator and translator endpoints.

camelCase on the wire, canonical snake_case in Python (CONVENTIONS.md 5.2).
Every score leaves with its band or not at all (section 8.2): a missing
Stuff+ is ``null`` with a reason, never a bare number.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from contracts.schemas import DENSITY_INDEX_MAX, DENSITY_INDEX_MIN

PitchType = Literal["Four-Seam", "Sinker", "Slider", "Changeup", "Curveball", "Cutter"]
Hand = Literal["Right", "Left"]


class Wire(BaseModel):
    """camelCase in both directions, unknown fields rejected."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class PitchIn(Wire):
    """A pitch as measured at sea level. Horizontal values on the arm side."""

    pitch_type: PitchType
    pitcher_hand: Hand
    release_speed: float = Field(ge=55, le=106)
    ivb: float = Field(ge=-30, le=30)
    horizontal_break: float = Field(ge=-30, le=30)
    spin_rate: float = Field(gt=0, le=4000)
    spin_axis: float = Field(ge=0, le=360)
    extension: float = Field(ge=3, le=9)
    release_height: float = Field(ge=3, le=8)
    release_side: float = Field(ge=-5, le=5)


class ArsenalPitchIn(Wire):
    """Another pitch of the same pitcher, so the simulated one has a fastball to face."""

    pitch_type: PitchType
    usage: float = Field(ge=0, le=1)
    release_speed: float
    ivb: float
    horizontal_break: float
    release_height: float
    release_side: float


class SimulateRequest(Wire):
    """A pitch to simulate and, optionally, the arsenal it belongs to."""

    pitch: PitchIn
    arsenal: list[ArsenalPitchIn] | None = None
    # When the pitch is a real pitcher's, he is left out of his own comparables:
    # being closest to yourself is true and says nothing.
    pitcher_id: str | None = None
    # Where the pitch and its arsenal were measured. 1.0 is sea level; the
    # translator (P3) also sends medium altitude, 0.903. The shape is first
    # brought to sea level with the same law, then simulated as usual.
    # Bounded by the measured range of the index (contracts.schemas), not by
    # physics: an origin of 0.05 would project 4,000 in of break.
    origin_density_index: float = Field(default=1.0, ge=DENSITY_INDEX_MIN, le=DENSITY_INDEX_MAX)


class Metric(Wire):
    """A value with its standard error; the product never shows one without the other."""

    value: float
    se: float


class Shape(Wire):
    """Break in one environment. At sea level it is the input, so its se is zero."""

    ivb: Metric
    horizontal_break: Metric


class Approach(Wire):
    """How the pitch arrives: plate speed in mph, VAA in degrees at mid zone."""

    plate_speed: float
    vaa: float


class Differentials(Wire):
    """The pitch minus its primary fastball, as the challenge defines them."""

    release_speed: float
    ivb: float
    horizontal_break: float
    release_distance: float


class Comparable(Wire):
    """A real pitcher-season whose version of this pitch is closest."""

    pitcher_id: str
    season: int
    n: int
    ivb: float
    horizontal_break: float
    release_speed: float
    whiff_per_swing: float | None


class EnvironmentResult(Wire):
    """Everything the simulator says about the pitch in one environment."""

    environment: Literal["sea", "harpHelu"]
    density_index: float
    shape: Shape
    approach: Approach
    stuff_plus: Metric | None
    differentials: Differentials | None
    comparables: list[Comparable]


class AltitudeDelta(Wire):
    """Harp Helu minus sea level, split into what the shape loses and the rest."""

    total: Metric
    shape: Metric
    environment: Metric


class Plausibility(Wire):
    """Whether the league has thrown this combination (core.spin)."""

    is_plausible: bool
    squared_distance: float
    threshold: float
    unusual: list[str]


class MovementPerKrpm(Wire):
    """Total break per 1,000 rpm and its percentile within the pitch type."""

    value: float
    percentile: float


class SimulateResponse(Wire):
    """Both environments side by side, and whether the Stuff+ is shown."""

    origin_density_index: float
    model_id: str | None
    uses_arsenal: bool
    stuff_plus_shown: bool
    stuff_plus_reason: str | None
    sea: EnvironmentResult
    harp_helu: EnvironmentResult
    altitude_delta: AltitudeDelta | None
    primary_fastball: PitchType | None
    plausibility: Plausibility
    movement_per_krpm: MovementPerKrpm


class TranslateShapeIn(Wire):
    """A shape as measured, in canonical units."""

    release_speed: float
    ivb: float
    horizontal_break: float
    extension: float
    release_height: float
    release_side: float


class TranslateRequest(Wire):
    """A shape and the two densities to move it between."""

    shape: TranslateShapeIn
    pitch_type: PitchType | None = None
    # Bounded by the measured range of the index (contracts.schemas), not by
    # physics: an origin of 0.05 would project 4,000 in of break.
    origin_density_index: float = Field(default=1.0, ge=DENSITY_INDEX_MIN, le=DENSITY_INDEX_MAX)
    target_density_index: float = Field(default=0.858, gt=0, le=1.2)


class TranslateResponse(Wire):
    """The projected shape with its per-axis band."""

    shape: TranslateShapeIn
    ivb_se: float
    horizontal_break_se: float
    release_speed_se: float
    break_scaling_factor: float


# A pitcher-season export is a few thousand rows of some 80 columns, about
# 3 MB; ten leaves room for a long season without accepting anything.
MAX_ARSENAL_FILE_CHARS = 10_000_000


class ArsenalFileRequest(Wire):
    """A tracking export as text, one row per pitch, with the vendor's columns."""

    csv: str = Field(min_length=1, max_length=MAX_ARSENAL_FILE_CHARS)


class ArsenalPitchOut(Wire):
    """One pitch type of the file, on the arm side, ready for the translator's table."""

    pitch_type: PitchType
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


class ArsenalFileResponse(Wire):
    """The file as an arsenal, and what was left out of it and why."""

    pitcher_hand: Hand
    origin: Literal["sea", "medium"] | None
    is_measured_at_extreme: bool
    n_rows: int
    pitches: list[ArsenalPitchOut]
    unsupported_rows: int
    missing_feature_rows: int
    unsupported_types: list[str]
    omitted_types: list[str]


class ArsenalFileProblem(Wire):
    """Why a file could not be summarized, for the screen to word it in Spanish."""

    error: Literal["unreadable", "empty", "missing_columns", "mixed_pitchers", "mixed_hands"]
    columns: list[str]
