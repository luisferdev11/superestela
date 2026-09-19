"""One test per acceptance criterion in docs/07 section 1.1."""

import pandera.errors as pa_errors
import pytest

from contracts import fixtures
from contracts.mapping import VENDOR_TO_CANONICAL, normalize_columns
from contracts.schemas import (
    MIN_APPEARANCES_FOR_ROLE,
    MIN_PITCHES_FOR_SCORE,
    ROLES,
    PitcherAggregates,
    PitchScores,
)


def test_a_well_formed_delivery_is_accepted():
    PitchScores.validate(fixtures.valid_pitch_scores())


def test_aggregates_delivery_is_accepted():
    PitcherAggregates.validate(fixtures.valid_pitcher_aggregates())


def test_delivery_without_standard_error_column_is_rejected():
    with pytest.raises(pa_errors.SchemaError):
        PitchScores.validate(fixtures.missing_standard_error())


def test_delivery_with_null_standard_error_is_rejected():
    with pytest.raises(pa_errors.SchemaError):
        PitchScores.validate(fixtures.null_standard_error())


def test_duplicate_pitch_ids_are_rejected():
    with pytest.raises(pa_errors.SchemaError):
        PitchScores.validate(fixtures.duplicate_pitch_ids())


def test_stuff_plus_outside_the_signed_scale_is_rejected():
    with pytest.raises(pa_errors.SchemaError):
        PitchScores.validate(fixtures.out_of_range_stuff_plus())


def test_untraceable_model_version_is_rejected():
    with pytest.raises(pa_errors.SchemaError):
        PitchScores.validate(fixtures.malformed_model_version())


def test_vendor_column_names_pass_once_normalized():
    raw = fixtures.vendor_named_columns()
    with pytest.raises(pa_errors.SchemaError):
        PitchScores.validate(raw)
    PitchScores.validate(normalize_columns(raw))


def test_the_glossary_covers_every_vendor_name_we_rename():
    # Guards against a half-applied rename: both directions must be bijective.
    assert len(set(VENDOR_TO_CANONICAL.values())) == len(VENDOR_TO_CANONICAL)


def test_minimum_sample_is_the_documented_product_rule():
    # docs/07 section 1.2. If this number moves, the UI copy moves with it.
    assert MIN_PITCHES_FOR_SCORE == 100


def test_a_role_outside_the_enum_is_rejected():
    with pytest.raises(pa_errors.SchemaError):
        PitcherAggregates.validate(fixtures.invalid_role())


def test_closer_is_not_a_role_we_can_derive():
    # There is no score column in the dataset, so a save situation cannot be
    # identified. Naming the role anyway would be asserting what we measured
    # nothing about.
    assert "closer" not in ROLES
    assert "late_inning_reliever" in ROLES


def test_role_may_be_null_for_pitchers_with_too_few_appearances():
    df = fixtures.valid_pitcher_aggregates()
    df.loc[0, "role"] = None
    PitcherAggregates.validate(df)


def test_minimum_appearances_threshold_is_declared():
    assert MIN_APPEARANCES_FOR_ROLE == 5
