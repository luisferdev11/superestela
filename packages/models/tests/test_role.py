"""Tests for role inference. The rule is simple; the edges are where it matters."""

import pandas as pd
import pytest

from contracts.schemas import ROLES
from models.features.role import (
    STARTER_FIRST_INNING_SHARE,
    assign_role,
    classify_roles,
    summarize_appearances,
)


def _pitches(rows):
    """Build pitch-level rows from (pitcher, season, game, inning, n) tuples."""
    out = []
    for pitcher, season, game, inning, n in rows:
        out += [{"pitcher_id": pitcher, "season": season, "game_id": game, "inning": inning}] * n
    return pd.DataFrame(out)


def test_a_pitcher_who_always_opens_is_a_starter():
    df = _pitches([("p1", 2026, f"g{i}", 1, 90) for i in range(6)])
    assert classify_roles(df).loc[("p1", 2026), "role"] == "starter"


def test_a_pitcher_who_never_opens_is_a_reliever():
    df = _pitches([("p1", 2026, f"g{i}", 7, 15) for i in range(8)])
    assert classify_roles(df).loc[("p1", 2026), "role"] == "reliever"


def test_entering_late_does_not_create_a_third_role():
    # docs/adr/0004: the entry inning of relievers is unimodal with its mode
    # at the 7th, so "came in late" is not a separate population.
    ninth = classify_roles(_pitches([("p1", 2026, f"g{i}", 9, 14) for i in range(8)]))
    fifth = classify_roles(_pitches([("p2", 2026, f"g{i}", 5, 20) for i in range(8)]))
    assert ninth.loc[("p1", 2026), "role"] == fifth.loc[("p2", 2026), "role"] == "reliever"


def test_too_few_appearances_gets_no_role_rather_than_a_guess():
    df = _pitches([("p1", 2026, f"g{i}", 1, 90) for i in range(4)])
    assert classify_roles(df).loc[("p1", 2026), "role"] is None


def test_an_opener_who_starts_half_the_time_still_counts_as_a_starter():
    rows = [("p1", 2026, f"g{i}", 1, 80) for i in range(5)]
    rows += [("p1", 2026, f"h{i}", 6, 20) for i in range(5)]
    assert classify_roles(_pitches(rows)).loc[("p1", 2026), "role"] == "starter"


def test_the_same_pitcher_can_hold_different_roles_in_different_seasons():
    # 43 of 347 do exactly this, which is why the role is keyed by season.
    rows = [("p1", 2025, f"g{i}", 1, 90) for i in range(6)]
    rows += [("p1", 2026, f"h{i}", 7, 15) for i in range(8)]
    out = classify_roles(_pitches(rows))
    assert out.loc[("p1", 2025), "role"] == "starter"
    assert out.loc[("p1", 2026), "role"] == "reliever"


def test_a_pitcher_who_skipped_a_season_keeps_both_seasons_apart():
    rows = [("p1", 2024, f"g{i}", 1, 90) for i in range(6)]
    rows += [("p1", 2026, f"h{i}", 1, 90) for i in range(6)]
    out = classify_roles(_pitches(rows))
    assert sorted(s for _, s in out.index) == [2024, 2026]


def test_entry_inning_is_the_earliest_inning_of_the_appearance():
    # A starter who pitches into the seventh still entered in the first.
    df = _pitches([("p1", 2026, "g1", 1, 20), ("p1", 2026, "g1", 4, 20), ("p1", 2026, "g1", 7, 20)])
    assert summarize_appearances(df).loc[("p1", 2026), "median_entry_inning"] == 1


def test_every_assigned_role_is_one_the_contract_accepts():
    for share in [0.0, 0.3, 0.5, 1.0]:
        assert assign_role(share, appearances=10) in ROLES


def test_the_threshold_lands_in_the_measured_valley():
    # The valley of the bimodal distribution sits at 40-50%.
    assert STARTER_FIRST_INNING_SHARE == 0.50
    assert assign_role(0.49, 10) == "reliever"
    assert assign_role(0.50, 10) == "starter"


@pytest.mark.parametrize("appearances", [0, 1, 4])
def test_the_minimum_is_applied_consistently(appearances):
    assert assign_role(1.0, appearances) is None
