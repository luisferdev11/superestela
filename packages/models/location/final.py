"""Data's final Location+ (``L3_loc_count_hand``). docs/14.

It answers a different question from Stuff+ and does not go through
``models.scoring.Scorer``: Stuff+ grades a shape, Location+ grades where a
pitch crossed the plate given the count and the batter's side. So it has its
own inputs, its own validation and its own vector, never Stuff+'s:

- **Target.** Eight outcomes of ANY pitch: ball, called strike, whiff, foul,
  out, single, extra-base hit, home run. One XGBoost booster per pitch type.
- **Features.** Plate height and side (catcher's view, NOT mirrored: data
  trained it raw), balls, strikes, and whether batter and pitcher share a
  side. Not hand neutral: the matchup is part of where a pitch should go.
- **Run values by count.** A called ball at 3-1 costs more than at 0-0, so
  each class is worth its mean ``delta_run_exp`` in that count (a (8, 4, 3)
  table); a count out of range takes the class's overall value.
- **Scale.** ``100 - 10 * (xRV - mean) / sd`` per pitch type. Data did not
  hand over this run's mean and sd; scripts/build_final_models.py computes
  them from the final booster on the training rows, not out of fold, and
  docs/14 says so.

What the numbers support (L3's metrics.json): split-half r 0.53 and no
correlation with next season's runs. Location+ describes how a pitcher
located; it does not project him.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
import pandas as pd

from models.runs import DataRun, class_probabilities

FloatArray = npt.NDArray[np.float64]

# data's SCHEMES["all8"]: booster output column i is class i.
CLASSES = ("Ball", "StrikeCalled", "Whiff", "Foul", "Out", "Single", "XBH", "HomeRun")

# What a pitch needs for a Location+, in canonical names (contracts.mapping).
REQUIRED = (
    "pitch_type",
    "pitcher_hand",
    "batter_hand",
    "plate_height",
    "plate_side",
    "balls",
    "strikes",
)
HANDS = ("Right", "Left")


@dataclass
class FinalLocationScorer:
    """``L3_loc_count_hand`` as a servable model. Built by scripts/build_final_models.py."""

    model_id: str
    pitch_types: tuple[str, ...]
    run: DataRun
    # Run value of each class by (balls, strikes): shape (8, 4, 3).
    rv_by_count: FloatArray
    # Per type (mean, sd) of the xRV that sets 100 and one sd.
    scale: Mapping[str, tuple[float, float]]
    scale_description: str

    @property
    def has_bands(self) -> bool:
        """Whether the draws are several boosters, so their spread is a band."""
        return self.run.has_folds

    def run_values(self, balls: pd.Series, strikes: pd.Series) -> FloatArray:
        """Return each row's run value per class for its count: shape (n, 8)."""
        b = pd.to_numeric(balls, errors="coerce")
        s = pd.to_numeric(strikes, errors="coerce")
        bad = (b.isna() | s.isna() | (b < 0) | (b > 3) | (s < 0) | (s > 2)).to_numpy()
        bi = b.fillna(0).clip(0, 3).astype(int).to_numpy()
        si = s.fillna(0).clip(0, 2).astype(int).to_numpy()
        m = self.rv_by_count[:, bi, si].T.copy()
        m[bad] = np.asarray(self.run.rv_neutral)
        return m

    def xrv(self, frame: pd.DataFrame) -> FloatArray:
        """Return the xRV of every row from every booster: shape (B, n).

        ``frame`` is canonical (``REQUIRED``), every row already validated.
        """
        n_boosters = len(next(iter(self.run.boosters.values())))
        out = np.full((n_boosters, len(frame)), np.nan)
        rv = self.run_values(frame["balls"], frame["strikes"])
        positions = np.arange(len(frame))
        for pitch_type, idx in frame.groupby("pitch_type", sort=False).indices.items():
            if pitch_type not in self.pitch_types:
                raise ValueError(f"{self.model_id} was not trained on {pitch_type}")
            part = frame.iloc[idx]
            x = pd.DataFrame(
                {
                    "PlateLocHeight": part["plate_height"].to_numpy(dtype=float),
                    "PlateLocSide": part["plate_side"].to_numpy(dtype=float),
                    "Balls": part["balls"].to_numpy(dtype=float),
                    "Strikes": part["strikes"].to_numpy(dtype=float),
                    "same_hand": (part["pitcher_hand"] == part["batter_hand"]).to_numpy(float),
                }
            )
            p = class_probabilities(self.run, str(pitch_type), x)
            out[: p.shape[0], positions[idx]] = (p * rv[idx][None, :, :]).sum(axis=2)
        return out

    def draws(self, frame: pd.DataFrame) -> FloatArray:
        """Return Location+ draws, one row per booster: shape (B, n)."""
        xrv = self.xrv(frame)
        mean = frame["pitch_type"].map(lambda t: self.scale[str(t)][0]).to_numpy(dtype=float)
        sd = frame["pitch_type"].map(lambda t: self.scale[str(t)][1]).to_numpy(dtype=float)
        out: FloatArray = 100.0 - 10.0 * (xrv - mean) / sd
        return out
