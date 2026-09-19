"""Tests for role inference. The rule is simple; the edges are where it matters."""

import pandas as pd
import pytest

from contracts.schemas import ROLES
from models.features.role import assign_role, classify_roles, summarize_appearances


def _pitches(rows):
    """Build pitch-level rows from (pitcher, game, inning, n_pitches) tuples."""
    out = []
    for pitcher, game, inning, n in rows:
        out += [{"pitcher_id": pitcher, "game_id": game, "inning": inning}] * n
    return pd.DataFrame(out)


def test_a_pitcher_who_always_opens_is_a_starter():
    df = _pitches([("p1", f"g{i}", 1, 90) for i in range(6)])
    assert classify_roles(df).loc["p1", "role"] == "starter"


def test_a_pitcher_who_always_enters_in_the_ninth_is_a_late_inning_reliever():
    df = _pitches([("p1", f"g{i}", 9, 15) for i in range(8)])
    assert classify_roles(df).loc["p1", "role"] == "late_inning_reliever"


def test_a_pitcher_who_enters_in_the_middle_innings_is_a_reliever():
    df = _pitches([("p1", f"g{i}", 5, 20) for i in range(8)])
    assert classify_roles(df).loc["p1", "role"] == "reliever"


def test_too_few_appearances_gets_no_role_rather_than_a_guess():
    df = _pitches([("p1", f"g{i}", 1, 90) for i in range(4)])
    assert classify_roles(df).loc["p1", "role"] is None


def test_an_opener_who_starts_half_the_time_still_counts_as_a_starter():
    rows = [("p1", f"g{i}", 1, 80) for i in range(5)]
    rows += [("p1", f"h{i}", 6, 20) for i in range(5)]
    assert classify_roles(_pitches(rows)).loc["p1", "role"] == "starter"


def test_entry_inning_is_the_earliest_inning_of_the_appearance():
    # A starter who pitches into the seventh still entered in the first.
    df = _pitches([("p1", "g1", 1, 20), ("p1", "g1", 4, 20), ("p1", "g1", 7, 20)])
    assert summarize_appearances(df).loc["p1", "median_entry_inning"] == 1


def test_every_assigned_role_is_one_the_contract_accepts():
    for share, entry in [(1.0, 1), (0.0, 9), (0.0, 5), (0.3, 8)]:
        role = assign_role(share, entry, appearances=10)
        assert role in ROLES


@pytest.mark.parametrize("appearances", [0, 1, 4])
def test_the_threshold_is_applied_consistently(appearances):
    assert assign_role(1.0, 1, appearances) is None
