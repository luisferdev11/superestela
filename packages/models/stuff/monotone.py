"""FINAL_v1 distilled so that more speed never lowers a pitch's Stuff+. docs/15.

Data's FINAL_v1 is a multiclass model: it predicts seven outcomes of a swing
and the expected run value (xRV) is their mix. A tree cannot be told that
speed never hurts an outcome mix, and on 14.7% of real four-seams +1 mph
lowered its Stuff+ (gate S1). ``scripts/distill_monotone.py`` trains, per
pitch type, a regressor on FINAL_v1's xRV with XGBoost's monotone constraint
on speed, without leakage across pitcher folds; on data's own evaluation it
matches or beats FINAL_v1 (``docs/15`` §6).

Everything before the boosters is FINAL_v1's: the same features, mirrored
and clipped the same way, against the same primary fastball. Only the xRV
changes, read straight from the regressors instead of mixed from classes.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
import pandas as pd
import xgboost as xgb

from models.stuff.final import FinalStuffScorer

FloatArray = npt.NDArray[np.float64]


@dataclass
class MonotoneStuffScorer(FinalStuffScorer):
    """The distilled FINAL_v1 behind ``models.scoring.Scorer``.

    ``run.features`` are the regressors' columns (FINAL_v1's without
    ``same_hand``) and ``run.boosters`` the five fold regressors per type;
    ``p_same`` and the run values are not used: the teacher already folded
    the batter's side and the outcome values into the target.
    """

    def xrv(self, frame: pd.DataFrame) -> FloatArray:
        """Return the xRV of every row from every regressor: shape (B, n).

        Raises:
            ValueError: If a row lacks an arsenal feature or has a type the
                model was not trained on.
        """
        out = np.full((len(next(iter(self.run.boosters.values()))), len(frame)), np.nan)
        positions = np.arange(len(frame))
        for pitch_type, idx in frame.groupby("pitch_type", sort=False).indices.items():
            if pitch_type not in self.pitch_types:
                raise ValueError(f"{self.model_id} was not trained on {pitch_type}")
            x = xgb.DMatrix(self.features(frame.iloc[idx]).astype("float32"))
            boosters = self.run.boosters[str(pitch_type)]
            out[: len(boosters), positions[idx]] = np.stack([b.predict(x) for b in boosters])
        return out
