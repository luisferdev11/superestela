"""Pitcher role for a given season, inferred from when he enters the game.

This is a rule, not a model, and it separates exactly two things because two
is what the data separates. Whether a pitcher opens the game is bimodal
across the 22,569 appearances in the dataset:

    opens  0-10% of appearances  ############################ 469
    opens 40-50%                 ## 21        <- the valley
    opens 90-100%                ######## 119

Pitch counts per appearance are bimodal on the same line: 450 pitchers at
10-20 pitches, a valley at 30-50, then 79 at 70-80. Two jobs, and ranking one
against the other on average Stuff+ compares a start to an inning of relief.

**There is no third tier, and the reason is worth keeping.** An earlier
version split relievers at "enters from the 7th onward", which sounds like a
category. It is not one: the relievers' median entry inning is unimodal with
its mode at exactly the 7th, so the cut ran through the peak with 222 of 568
pitchers standing on the line, and the two halves differed by 3 pitches per
appearance with almost fully overlapping interquartile ranges. Nameable is
not the same as separable. See docs/adr/0004.

There is also no "closer": a closer is defined by entering a save situation,
and the dataset carries no score.

**Role is per season, not per pitcher.** 43 of the 347 pitchers with two or
more classified seasons change role between them.
"""

from __future__ import annotations

import pandas as pd

from contracts.schemas import MIN_APPEARANCES_FOR_ROLE

# A pitcher who opens at least half his appearances is doing the starter's
# job, even on a staff that uses openers. The valley in the measured
# distribution sits at 40-50%, so the threshold lands inside it.
STARTER_FIRST_INNING_SHARE = 0.50


def summarize_appearances(
    pitches: pd.DataFrame,
    pitcher_col: str = "pitcher_id",
    season_col: str = "season",
    game_col: str = "game_id",
    inning_col: str = "inning",
) -> pd.DataFrame:
    """Collapse pitch-level rows into one row per pitcher and season.

    An appearance is a pitcher in a game. Entry inning is the earliest inning
    he threw in that game.

    Args:
        pitches: Pitch-level rows.
        pitcher_col: Column holding the pitcher identifier.
        season_col: Column holding the season.
        game_col: Column holding the game identifier.
        inning_col: Column holding the inning the pitch was thrown in.

    Returns:
        One row per pitcher and season, indexed by both, carrying
        `appearances`, `first_inning_share`, `median_entry_inning` and
        `median_pitches`.
    """
    per_game = pitches.groupby([pitcher_col, season_col, game_col], observed=True).agg(
        entry_inning=(inning_col, "min"), pitches=(inning_col, "size")
    )
    return per_game.groupby(level=[0, 1]).agg(
        appearances=("pitches", "size"),
        first_inning_share=("entry_inning", lambda s: float((s == 1).mean())),
        median_entry_inning=("entry_inning", "median"),
        median_pitches=("pitches", "median"),
    )


def assign_role(first_inning_share: float, appearances: int) -> str | None:
    """Classify one pitcher-season from his appearance pattern.

    Args:
        first_inning_share: Fraction of appearances begun in the first inning.
        appearances: How many games he pitched in that season.

    Returns:
        One of the values in `contracts.schemas.ROLES`, or None when there are
        too few appearances to say anything - which is a real answer, not a
        missing one.
    """
    if appearances < MIN_APPEARANCES_FOR_ROLE:
        return None
    return "starter" if first_inning_share >= STARTER_FIRST_INNING_SHARE else "reliever"


def classify_roles(
    pitches: pd.DataFrame,
    pitcher_col: str = "pitcher_id",
    season_col: str = "season",
    game_col: str = "game_id",
    inning_col: str = "inning",
) -> pd.DataFrame:
    """Infer every pitcher-season's role from pitch-level rows.

    Args:
        pitches: Pitch-level rows.
        pitcher_col: Column holding the pitcher identifier.
        season_col: Column holding the season.
        game_col: Column holding the game identifier.
        inning_col: Column holding the inning the pitch was thrown in.

    Returns:
        The appearance summary with a `role` column added, indexed by
        (pitcher, season).
    """
    summary = summarize_appearances(pitches, pitcher_col, season_col, game_col, inning_col)
    shares = summary["first_inning_share"].to_numpy(dtype=float)
    appearances = summary["appearances"].to_numpy(dtype=int)
    roles = [
        assign_role(float(share), int(count))
        for share, count in zip(shares, appearances, strict=True)
    ]
    return summary.assign(role=pd.Series(roles, index=summary.index, dtype=object))
