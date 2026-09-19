"""Pitcher role, inferred from when he enters the game.

This is a rule, not a model, and it is written as one on purpose. Measured
across the 22,569 appearances in the dataset, the separation is close to
clean: 439 pitchers enter the first inning in under 5% of their appearances,
153 in over 80%, and only 59 sit in the ambiguous 20-50% band. Pitch counts
per appearance are bimodal with a shallow valley - 247 pitchers at 15 or
fewer, 183 above 60. Fitting a classifier to that would add a training step,
a seed and a failure mode in exchange for nothing.

The role matters because ranking a starter against a reliever on average
Stuff+ compares two different jobs: a starter passes through the order three
times, a reliever once.

**There is no "closer" here, and that is not an oversight.** A closer is
defined by entering a save situation, which needs the score; the dataset has
no score column. `late_inning_reliever` is what the data actually supports.
"""

from __future__ import annotations

import pandas as pd

from contracts.schemas import MIN_APPEARANCES_FOR_ROLE

# A pitcher who opens at least half his appearances is doing the starter's job,
# even in a staff that uses openers. measured: the 20-50% band holds 59 of 786.
STARTER_FIRST_INNING_SHARE = 0.50

# Entering from the seventh onward is the late-inning job: setup or closing.
# We can see that he came in late; we cannot see whether it was a save.
LATE_INNING_ENTRY = 7


def summarize_appearances(
    pitches: pd.DataFrame,
    pitcher_col: str = "pitcher_id",
    game_col: str = "game_id",
    inning_col: str = "inning",
) -> pd.DataFrame:
    """Collapse pitch-level rows into one row per pitcher.

    An appearance is a pitcher in a game. Entry inning is the earliest inning
    he threw in that game.

    Args:
        pitches: Pitch-level rows.
        pitcher_col: Column holding the pitcher identifier.
        game_col: Column holding the game identifier.
        inning_col: Column holding the inning the pitch was thrown in.

    Returns:
        One row per pitcher, indexed by pitcher id, carrying `appearances`,
        `first_inning_share`, `median_entry_inning` and `median_pitches`.
    """
    per_game = pitches.groupby([pitcher_col, game_col], observed=True).agg(
        entry_inning=(inning_col, "min"),
        pitches=(inning_col, "size"),
    )
    return per_game.groupby(level=0).agg(
        appearances=("pitches", "size"),
        first_inning_share=("entry_inning", lambda s: float((s == 1).mean())),
        median_entry_inning=("entry_inning", "median"),
        median_pitches=("pitches", "median"),
    )


def assign_role(
    first_inning_share: float,
    median_entry_inning: float,
    appearances: int,
) -> str | None:
    """Classify one pitcher from his appearance pattern.

    Args:
        first_inning_share: Fraction of appearances begun in the first inning.
        median_entry_inning: Median inning he enters the game in.
        appearances: How many games he pitched in.

    Returns:
        One of the values in `contracts.schemas.ROLES`, or None when there are
        too few appearances to say anything - which is a real answer, not a
        missing one.
    """
    if appearances < MIN_APPEARANCES_FOR_ROLE:
        return None
    if first_inning_share >= STARTER_FIRST_INNING_SHARE:
        return "starter"
    if median_entry_inning >= LATE_INNING_ENTRY:
        return "late_inning_reliever"
    return "reliever"


def classify_roles(
    pitches: pd.DataFrame,
    pitcher_col: str = "pitcher_id",
    game_col: str = "game_id",
    inning_col: str = "inning",
) -> pd.DataFrame:
    """Infer every pitcher's role from pitch-level rows.

    Args:
        pitches: Pitch-level rows.
        pitcher_col: Column holding the pitcher identifier.
        game_col: Column holding the game identifier.
        inning_col: Column holding the inning the pitch was thrown in.

    Returns:
        The appearance summary with a `role` column added.
    """
    summary = summarize_appearances(pitches, pitcher_col, game_col, inning_col)
    shares = summary["first_inning_share"].to_numpy(dtype=float)
    entries = summary["median_entry_inning"].to_numpy(dtype=float)
    appearances = summary["appearances"].to_numpy(dtype=int)
    roles = [
        assign_role(float(share), float(entry), int(count))
        for share, entry, count in zip(shares, entries, appearances, strict=True)
    ]
    return summary.assign(role=pd.Series(roles, index=summary.index, dtype=object))
