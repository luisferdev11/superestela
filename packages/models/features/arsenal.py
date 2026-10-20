"""A pitch against its pitcher's primary fastball, as the final Stuff+ was trained.

Data's ``FINAL_v1`` (docs/15) grades every pitch by how it differs from the
pitcher's primary fastball in the same season and altitude category
(``speed_diff_env``, ``ivb_diff_env``, ``hb_diff_env``). The scores only mean
what they meant in training if the reference is picked the same way, so this
is a port of ``_fb_diffs`` in data's ``notebooks/experimentos_stuff.py``, not a
new definition:

- The fastball family is four-seam, sinker, two-seam and one-seam. The cutter
  is NOT in it, unlike ``core.arsenal.FASTBALL_TYPES``, which the Simulator
  uses to show differentials; the two answer different questions and must
  not be merged.
- The primary fastball is the family type thrown most. A pitcher with none
  is graded against his fastest type, whatever it is.
- Horizontal break is on the arm side, as ``models.scoring.to_arm_side``
  leaves it.

Pure functions: no I/O.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
import pandas as pd

from contracts.mapping import CANONICAL_TO_VENDOR, normalize_columns
from core.arsenal import ArsenalPitch

# data's FASTBALL_FAMILY, notebooks/experimentos_stuff.py line 66
FASTBALL_FAMILY = ("Four-Seam", "Sinker", "TwoSeamFastBall", "OneSeamFastBall")

# One arsenal: a pitcher in a season and an altitude category (training key).
ARSENAL_KEY = ("pitcher_anon_id", "year", "environment")

DIFF_COLUMNS = ("speed_diff", "ivb_diff", "hb_diff")


@dataclass(frozen=True)
class FastballDiffs:
    """A pitch minus its primary fastball, on the three axes the model reads."""

    speed_diff: float  # mph
    ivb_diff: float  # inches
    hb_diff: float  # inches, arm side


def frame_differentials(frame: pd.DataFrame) -> pd.DataFrame:
    """Return ``speed_diff``, ``ivb_diff`` and ``hb_diff`` for every row of a frame.

    The reference is computed from the rows passed in, so pass the whole
    file BEFORE filtering rows out: in training, a pitch the model never saw
    (an unsupported type, a row without an outcome) still counted towards
    its pitcher's fastball. A row whose key is incomplete gets NaN, never a
    zero.

    Args:
        frame: Canonical columns, ``horizontal_break`` on the arm side, with
            ``ARSENAL_KEY``, ``pitch_type``, ``release_speed`` and ``ivb``.
    """
    key = list(ARSENAL_KEY)
    # The same aggregation and sorts as _fb_diffs, so ties break the same way.
    g = (
        frame.groupby([*key, "pitch_type"])
        .agg(
            n=("release_speed", "size"),
            v=("release_speed", "mean"),
            ivb=("ivb", "mean"),
            hb=("horizontal_break", "mean"),
        )
        .reset_index()
    )
    fam = g[g["pitch_type"].isin(FASTBALL_FAMILY)].sort_values("n", ascending=False)
    fam = fam.drop_duplicates(key)
    rest = g.merge(fam[key].assign(_has=1), on=key, how="left")
    rest = rest[rest["_has"].isna()].sort_values("v", ascending=False).drop_duplicates(key)
    prim = pd.concat([fam, rest[fam.columns]], ignore_index=True)[[*key, "v", "ivb", "hb"]]
    ref = frame[key].merge(prim, on=key, how="left")
    return pd.DataFrame(
        {
            "speed_diff": frame["release_speed"].to_numpy() - ref["v"].to_numpy(),
            "ivb_diff": frame["ivb"].to_numpy() - ref["ivb"].to_numpy(),
            "hb_diff": frame["horizontal_break"].to_numpy() - ref["hb"].to_numpy(),
        },
        index=frame.index,
    )


def raw_differentials(raw: pd.DataFrame) -> pd.DataFrame:
    """Return the differentials of every row of a frame with the vendor's columns.

    Mirrors horizontal break to the arm side as training did: any hand but
    "Left" counts as a right-hander here; such rows are refused later, but
    still count towards their pitcher's fastball, as they did in training.
    """
    needed = [
        *ARSENAL_KEY,
        "pitch_type",
        "pitcher_hand",
        "release_speed",
        "ivb",
        "horizontal_break",
    ]
    frame = normalize_columns(raw[[CANONICAL_TO_VENDOR.get(c, c) for c in needed]])
    for c in ("pitch_type", "pitcher_hand", "environment"):
        frame[c] = frame[c].astype(object)
    sign = np.where(frame["pitcher_hand"] == "Left", -1.0, 1.0)
    return frame_differentials(frame.assign(horizontal_break=frame["horizontal_break"] * sign))


def primary_fastball(arsenal: Sequence[ArsenalPitch]) -> ArsenalPitch | None:
    """Return the reference pitch of an arsenal by training's rule, or None if empty.

    Usage stands in for the pitch count the frame version ranks by.
    """
    if not arsenal:
        return None
    family = [p for p in arsenal if p.pitch_type in FASTBALL_FAMILY]
    if family:
        return max(family, key=lambda p: p.usage)
    return max(arsenal, key=lambda p: p.release_speed)


def arsenal_differentials(
    release_speed: float,
    ivb: float,
    horizontal_break: float,
    arsenal: Sequence[ArsenalPitch],
) -> FastballDiffs | None:
    """Return one pitch's differentials against its arsenal, or None without one.

    A pitch that is itself the reference type is graded against the
    arsenal's average of that type, as in training, where its diffs were the
    pitch minus its type's season mean.
    """
    ref = primary_fastball(arsenal)
    if ref is None:
        return None
    return FastballDiffs(
        speed_diff=release_speed - ref.release_speed,
        ivb_diff=ivb - ref.ivb,
        hb_diff=horizontal_break - ref.horizontal_break,
    )
