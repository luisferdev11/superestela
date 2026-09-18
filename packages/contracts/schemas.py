"""Executable data contracts between the data team and product.

These schemas are the boundary. A delivery that does not validate against them
is rejected, and the rejection is a machine's decision rather than an argument
in a meeting. The field lists mirror docs/07-INGENIERIA-Y-EQUIPO.md section 1.

Two rules encoded here that are product decisions, not statistics:

* `stuff_plus_se` is required and strictly positive. The UI renders a band on
  every number, so a score without its standard error cannot be displayed at
  all (CONVENTIONS.md section 8 rule 2).
* Below MIN_PITCHES_FOR_SCORE the product shows "muestra insuficiente" instead
  of a number. It is better to say nothing than to show a number with a band
  wide enough to mean anything.
"""

from __future__ import annotations

from typing import ClassVar

import pandera.pandas as pa
from pandera.typing import Series

# Product rule: below this sample size we suppress the score entirely.
MIN_PITCHES_FOR_SCORE = 100  # product rule, docs/07 section 1.2

# MAJOR.MINOR.PATCH+<git-sha7>, e.g. 1.2.0+a3f9c1 (CONVENTIONS.md section 5.3)
MODEL_VERSION_PATTERN = r"^\d+\.\d+\.\d+\+[0-9a-f]{7,40}$"

# The scale is fixed by definition: 100 is league average, 10 is one standard
# deviation. Anything outside this range is a bug, not an exceptional pitcher.
STUFF_PLUS_MIN, STUFF_PLUS_MAX = 40.0, 160.0

# Measured range of the density index across the three LMB environments, with
# headroom. evidence.json -> density: 0.858 extreme, 1.000 sea level.
DENSITY_INDEX_MIN, DENSITY_INDEX_MAX = 0.70, 1.05

ENVIRONMENTS = ["sea_level", "medium_altitude", "extreme_altitude"]


class PitchScores(pa.DataFrameModel):
    """Contract A - one row per scored pitch.

    What the data team delivers and product consumes. Delivered as parquet,
    validated in CI before it can reach the application.
    """

    pitch_id: Series[str] = pa.Field(unique=True, nullable=False)
    model_version: Series[str] = pa.Field(str_matches=MODEL_VERSION_PATTERN, nullable=False)

    stuff_plus: Series[float] = pa.Field(ge=STUFF_PLUS_MIN, le=STUFF_PLUS_MAX, nullable=False)
    # Not nullable, and strictly positive: the product cannot render a value
    # without its band. This single line is the rule's enforcement.
    stuff_plus_se: Series[float] = pa.Field(gt=0.0, nullable=False)

    # Null until these models exist. Nullable is a statement about the roadmap,
    # not a licence to ship them empty forever.
    location_plus: Series[float] = pa.Field(ge=STUFF_PLUS_MIN, le=STUFF_PLUS_MAX, nullable=True)
    pitching_plus: Series[float] = pa.Field(ge=STUFF_PLUS_MIN, le=STUFF_PLUS_MAX, nullable=True)

    p_whiff: Series[float] = pa.Field(ge=0.0, le=1.0, nullable=False)
    p_chase: Series[float] = pa.Field(ge=0.0, le=1.0, nullable=False)
    p_gb: Series[float] = pa.Field(ge=0.0, le=1.0, nullable=False)
    p_hard_hit: Series[float] = pa.Field(ge=0.0, le=1.0, nullable=False)

    xrv: Series[float] = pa.Field(ge=-1.0, le=1.5, nullable=False)
    density_index: Series[float] = pa.Field(
        ge=DENSITY_INDEX_MIN, le=DENSITY_INDEX_MAX, nullable=False
    )

    scored_at: Series[pa.DateTime] = pa.Field(nullable=False)

    class Config:
        """Reject unexpected columns rather than silently carrying them."""

        strict = "filter"
        coerce = True


class PitcherAggregates(pa.DataFrameModel):
    """Contract B - one row per pitcher, season and environment.

    Drives the Radar and the Ficha. `n_pitches` is what lets the UI decide
    between showing a score and showing "muestra insuficiente".
    """

    pitcher_id: Series[str] = pa.Field(nullable=False)
    season: Series[int] = pa.Field(ge=2000, le=2100, nullable=False)
    environment: Series[str] = pa.Field(isin=ENVIRONMENTS, nullable=False)

    n_pitches: Series[int] = pa.Field(ge=0, nullable=False)

    stuff_plus_hh: Series[float] = pa.Field(ge=STUFF_PLUS_MIN, le=STUFF_PLUS_MAX, nullable=True)
    stuff_plus_hh_ci95: Series[float] = pa.Field(ge=0.0, nullable=True)
    stuff_plus_sea: Series[float] = pa.Field(ge=STUFF_PLUS_MIN, le=STUFF_PLUS_MAX, nullable=True)
    stuff_plus_sea_ci95: Series[float] = pa.Field(ge=0.0, nullable=True)

    altitude_tax_per_100: Series[float] = pa.Field(nullable=True)
    altitude_tax_se: Series[float] = pa.Field(gt=0.0, nullable=True)
    altitude_tax_significant: Series[bool] = pa.Field(nullable=False)

    # List of per-pitch-type dicts: usage, velo, ivb, hb, spin, stuff_plus, whiff.
    arsenal: Series[object] = pa.Field(nullable=True)

    class Config:
        """The composite key is (pitcher_id, season, environment)."""

        strict = "filter"
        coerce = True
        unique: ClassVar[list[str]] = ["pitcher_id", "season", "environment"]
