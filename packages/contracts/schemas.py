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
# docs/07 section 1.2 set 100; lowered to 50 on 20 oct at the team's request,
# so more pitcher-seasons get a card. The 95% band widens to say so.
MIN_PITCHES_FOR_SCORE = 50

# Product rules for the descriptive rates Diablos reads (Q&A, 30 sep): K%, BB%
# and K-BB% need this many plate appearances, whiff per swing this many swings.
# At 50 a K% of 20 still carries a 95% band of +-11 points. Since 20 oct a rate
# below the minimum is still computed and shown, marked as a small sample.
MIN_PLATE_APPEARANCES_FOR_RATE = 50
MIN_SWINGS_FOR_RATE = 50

# MAJOR.MINOR.PATCH+<git-sha7>, e.g. 1.2.0+a3f9c1 (CONVENTIONS.md section 5.3)
MODEL_VERSION_PATTERN = r"^\d+\.\d+\.\d+\+[0-9a-f]{7,40}$"

# The scale is fixed by definition: 100 is league average, 10 is one standard
# deviation. Anything outside this range is a bug, not an exceptional pitcher.
STUFF_PLUS_MIN, STUFF_PLUS_MAX = 40.0, 160.0

# Measured range of the density index across the three LMB environments, with
# headroom. evidence.json -> density: 0.858 extreme, 1.000 sea level.
DENSITY_INDEX_MIN, DENSITY_INDEX_MAX = 0.70, 1.05

# Two, because two is what the data separates. Whether a pitcher opens the
# game is bimodal: 469 pitchers open under 10% of their appearances, 119 over
# 90%, and the valley sits at 40-50%. Anything finer is not a classification,
# it is a cut through one population - see docs/adr/0004.
#
# In particular there is no "closer" and no "late inning" tier: a closer is
# defined by entering a save situation and the dataset carries no score, and
# the relievers' entry inning is unimodal with its mode at exactly the 7th.
ROLES = ["starter", "reliever"]

# Minimum appearances before a role is assigned at all. Below this the entry
# inning is one or two games of noise.
MIN_APPEARANCES_FOR_ROLE = 5


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
    # Season is part of the key, not a label. A pitcher who left in 2025 and
    # came back in 2026 is two different measurements, and 28 pitchers in the
    # dataset are exactly that. Shape correlates 0.78-0.83 between consecutive
    # seasons but only 0.674 across a gap year.
    season: Series[int] = pa.Field(ge=2000, le=2100, nullable=False)

    # Counted per environment because the sample rule applies to each one
    # separately: a delivery with 900 pitches at sea level and 40 at altitude
    # has no comparison in it, and a single `n_pitches` would hide that.
    n_pitches_hh: Series[int] = pa.Field(ge=0, nullable=False)
    n_pitches_sea: Series[int] = pa.Field(ge=0, nullable=False)

    # Null below MIN_APPEARANCES_FOR_ROLE. Comparing a starter to a reliever on
    # average Stuff+ compares two different jobs, so the deployment board needs
    # this to group before it ranks. 43 of 347 pitchers change role between
    # seasons, which is why it lives on the pitcher-season row.
    role: Series[str] = pa.Field(isin=ROLES, nullable=True)
    # Not rendered. It is what the role rule is built from, and what question
    # E5 of the backlog needs to ask whether altitude bites differently by role.
    median_entry_inning: Series[float] = pa.Field(ge=1.0, le=20.0, nullable=True)

    stuff_plus_hh: Series[float] = pa.Field(ge=STUFF_PLUS_MIN, le=STUFF_PLUS_MAX, nullable=True)
    stuff_plus_hh_ci95: Series[float] = pa.Field(ge=0.0, nullable=True)
    stuff_plus_sea: Series[float] = pa.Field(ge=STUFF_PLUS_MIN, le=STUFF_PLUS_MAX, nullable=True)
    stuff_plus_sea_ci95: Series[float] = pa.Field(ge=0.0, nullable=True)

    # Extra runs conceded per NINE INNINGS at altitude. Per nine and not per
    # hundred pitches because nine innings is the unit baseball already reads;
    # "runs per 100 pitches" is a unit nobody thinks in and it cost us a
    # conversation with the data team to discover that.
    #
    # Conservative by construction: it is built from per-pitch linear weights,
    # which price the outcome of each pitch but never see sequencing. Measured
    # against actual runs allowed it recovers +1.77 of the observed +2.70 RA/9,
    # about 65%. Report it as a floor on the effect, never as the whole of it.
    altitude_tax_per_9: Series[float] = pa.Field(nullable=True)
    altitude_tax_se: Series[float] = pa.Field(gt=0.0, nullable=True)
    # False for 246 of 286 pitchers in the v0 cohort. Product MUST render
    # "no concluyente" rather than a number when this is False - the same
    # instinct as MIN_PITCHES_FOR_SCORE, applied to a different statistic.
    altitude_tax_significant: Series[bool] = pa.Field(nullable=False)

    # List of per-pitch-type dicts: usage, velo, ivb, hb, spin, stuff_plus, whiff.
    arsenal: Series[object] = pa.Field(nullable=True)

    class Config:
        """The composite key is (pitcher_id, season).

        Environment is deliberately NOT in the key. Each row already carries
        both `stuff_plus_hh` and `stuff_plus_sea`: it is a comparison between
        environments, not an observation of one. Keying by environment as well
        would duplicate that comparison on every row.
        """

        strict = "filter"
        coerce = True
        unique: ClassVar[list[str]] = ["pitcher_id", "season"]
