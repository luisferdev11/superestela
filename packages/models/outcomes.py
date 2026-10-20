"""The outcome of every pitch and its run value, as data built them for training.

The final models (docs/14) were trained on classes and run values derived
from ``PitchCall`` and ``play_result`` in data's notebook
(``superestela_experimentos.ipynb`` cells 8, 11 and 20, and ``build_labels``
in ``experimentos_stuff.py``). The product needs the same derivation twice:
to rebuild what data did not hand over (Location+'s run values by count, the
hand-neutral weights) and to check the port against the numbers data did
hand over (``rv_values.csv``). It is a port: when it disagrees with data's
code, data's code is right.

Raw layer: vendor column names, as the dataset delivers them.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

FOUL_CALLS = ("FoulBall", "FoulBallNotFieldable", "FoulBallFieldable")
# Pitches without a play result whose pitch call says what happened (cell 8).
RESCUE = {
    "BallCalled": "BallCalled",
    "BallinDirt": "BallCalled",
    "StrikeCalled": "StrikeCalled",
    "StrikeSwinging": "StrikeSwinging",
    "HitByPitch": "HitByPitch",
}

# Exit speed under which a ball in play is weak contact (data's swing_cq).
WEAK_CONTACT_MPH = 71.0

_SWING = {
    "StrikeSwinging": "Whiff",
    "FoulBall": "Foul",
    "Out": "Out",
    "Single": "Single",
    "Double": "XBH",
    "Triple": "XBH",
    "HomeRun": "HomeRun",
}
_TAKE = {"BallCalled": "Ball", "Walk": "Ball", "HitByPitch": "Ball", "StrikeCalled": "StrikeCalled"}
IN_PLAY = ("Out", "Single", "XBH", "HomeRun")


def event_type(raw: pd.DataFrame) -> pd.Series:
    """Return the event of every pitch from ``PitchCall`` and ``play_result`` (cell 8)."""
    pc = raw["PitchCall"].astype(object)
    pr = raw["play_result"].astype(object)
    out = pr.copy()
    done = pd.Series(False, index=raw.index)

    def put(mask: pd.Series, value: object) -> None:
        m = mask & ~done
        out[m] = value[m] if isinstance(value, pd.Series) else value
        done[m] = True

    neutral = pr == "NeutralPlay"
    put(neutral & pc.isin(FOUL_CALLS), "FoulBall")
    put(neutral & (pc == "StrikeCalled"), "StrikeCalled")
    put(neutral, None)
    put(pr == "Strikeout", pc)
    put(pr.isin(["Error", "FieldersChoice", "Sacrifice"]), "Out")
    put(pr == "BallinDirt", "BallCalled")
    put(pr == "FoulBallFieldable", "FoulBall")
    rescued = out.isna() & pc.isin(list(RESCUE))
    out[rescued] = pc[rescued].map(RESCUE)
    return out


def delta_run_exp(raw: pd.DataFrame, events: pd.Series, table: pd.DataFrame) -> pd.Series:
    """Return the run value of every pitch from data's ``runValues.csv`` (cell 11).

    ``table`` has ``event, balls, strikes, delta_run_exp``. A called ball at
    three balls is a walk, and takes the walk's value.
    """
    key = table.rename(columns={"event": "_event", "balls": "Balls", "strikes": "Strikes"})
    left = pd.DataFrame(
        {
            "_event": events.to_numpy(),
            "Balls": raw["Balls"].to_numpy(),
            "Strikes": raw["Strikes"].to_numpy(),
        }
    )
    merged = left.merge(key, on=["_event", "Balls", "Strikes"], how="left", validate="m:1")
    value = pd.Series(merged["delta_run_exp"].to_numpy(dtype=float), index=raw.index)
    walk = table[table["event"] == "Walk"].set_index(["balls", "strikes"])["delta_run_exp"]
    for s in (0, 1, 2):
        m = value.isna() & (events == "BallCalled") & (raw["Balls"] == 3) & (raw["Strikes"] == s)
        if m.any() and (3, s) in walk.index:
            value[m] = float(walk[(3, s)])
    return value


def swing_quality_class(raw: pd.DataFrame, events: pd.Series) -> pd.Series:
    """Return data's ``swing_cq`` class, NaN on a take: weak contact splits the balls in play."""
    label = events.map(_SWING)
    exit_speed = pd.to_numeric(raw["ExitSpeed"], errors="coerce")
    weak = label.isin(IN_PLAY) & (exit_speed < WEAK_CONTACT_MPH)
    return label.mask(weak, "Weak")


def every_pitch_class(events: pd.Series) -> pd.Series:
    """Return data's ``all8`` class: takes and swings, no weak contact."""
    return events.map({**_SWING, **_TAKE})


def run_value_table(
    labels: pd.Series,
    run_value: pd.Series,
    balls: pd.Series,
    strikes: pd.Series,
    classes: tuple[str, ...],
) -> tuple[np.ndarray, np.ndarray]:
    """Return each class's mean run value overall and by count (data's ``RV``).

    Returns:
        ``(neutral, by_count)``: shapes (K,) and (K, 4, 3). A count with no
        pitch of a class keeps the class's overall value.
    """
    ok = labels.notna() & run_value.notna()
    d = pd.DataFrame({"c": labels[ok], "v": run_value[ok], "b": balls[ok], "s": strikes[ok]})
    neutral = d.groupby("c")["v"].mean().reindex(list(classes)).fillna(0.0).to_numpy()
    by_count = np.tile(neutral[:, None, None], (1, 4, 3))
    means = d.groupby(["c", "b", "s"])["v"].mean()
    for (c, b, s), v in zip(means.index.tolist(), means.to_numpy(), strict=True):
        if 0 <= b <= 3 and 0 <= s <= 2:
            by_count[classes.index(str(c)), int(b), int(s)] = v
    return neutral, by_count
