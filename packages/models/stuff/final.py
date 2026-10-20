"""Data's final Stuff+ (``FINAL_v1``), served through the scoring contract. docs/15.

What data trained, and what this class reproduces at inference:

- **Target.** Seven outcomes of a swing: whiff, foul, weak contact (exit
  speed under 71 mph), out, single, extra-base hit and home run. One XGBoost
  multiclass booster per pitch type.
- **Features.** Thirteen, in this order: speed, spin rate, spin axis as sine
  and cosine (right-hander frame), IVB, horizontal break and release side on
  the arm side, release height, extension, whether batter and pitcher share a
  side, and the pitch's speed, IVB and break against its primary fastball
  (``models.features.arsenal``), clipped per type to the training 0.1% and
  99.9% quantiles. No density index: altitude reaches the score only through
  the pitch's shape.
- **Hand neutral.** Stuff+ is the pitch, not the matchup: the probabilities
  are averaged over the two batter sides, weighted by how often the type met
  a same-side batter in training (``p_same``).
- **Scale.** xRV is the run value of the expected outcome; Stuff+ is
  ``100 - 10 * (xRV - mean) / sd`` with the mean and sd of the type's
  out-of-fold xRV, so 100 is the average pitch OF ITS TYPE.

The draws are one score per booster. With only the final booster there is
one draw, the scorer says so (``has_bands``) and the product does not show
the score as if it had a band (CONVENTIONS.md 8.2).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field

import numpy as np
import numpy.typing as npt
import pandas as pd

from models.features.arsenal import arsenal_differentials
from models.runs import DataRun, class_probabilities
from models.scoring import ArsenalContext, PitchInput, ScaleSpec, Score

FloatArray = npt.NDArray[np.float64]

# data's SCHEMES["swing_cq"]: booster output column i is class i.
CLASSES = ("Whiff", "Foul", "Weak", "Out", "Single", "XBH", "HomeRun")

# The arsenal features, and the columns they take in the boosters.
DIFF_FEATURES = {
    "speed_diff": "speed_diff_env",
    "ivb_diff": "ivb_diff_env",
    "hb_diff": "hb_diff_env",
}


@dataclass
class FinalStuffScorer:
    """``FINAL_v1`` behind ``models.scoring.Scorer``. Built by scripts/build_final_models.py."""

    model_id: str
    scale: ScaleSpec
    pitch_types: tuple[str, ...]
    run: DataRun
    # Share of same-side batters per type in training (hand-neutral weights).
    p_same: Mapping[str, float]
    # Per type, the training (low, high) quantiles of each arsenal feature.
    clip: Mapping[str, Mapping[str, tuple[float, float]]]
    uses_arsenal: bool = True
    # Which run, why it was chosen, and its rivals' metrics (the API returns it).
    provenance: Mapping[str, object] = field(default_factory=dict)

    @property
    def has_bands(self) -> bool:
        """Whether the draws are several boosters, so their spread is a band."""
        return self.run.has_folds

    def features(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Build the boosters' columns from a canonical frame on the arm side.

        ``frame`` has the ``PitchInput`` columns plus ``speed_diff``,
        ``ivb_diff`` and ``hb_diff`` and a single ``pitch_type``. ``same_hand``
        is left at 0; ``xrv`` sets it.
        """
        pitch_type = str(frame["pitch_type"].iloc[0])
        axis = np.deg2rad(frame["spin_axis"].to_numpy(dtype=float))
        x = pd.DataFrame(
            {
                "RelSpeed": frame["release_speed"].to_numpy(dtype=float),
                "SpinRate": frame["spin_rate"].to_numpy(dtype=float),
                "SpinAxis_sin": np.sin(axis),
                "SpinAxis_cos": np.cos(axis),
                "InducedVertBreak": frame["ivb"].to_numpy(dtype=float),
                "HorzBreak_m": frame["horizontal_break"].to_numpy(dtype=float),
                "RelHeight": frame["release_height"].to_numpy(dtype=float),
                "RelSide_m": frame["release_side"].to_numpy(dtype=float),
                "Extension": frame["extension"].to_numpy(dtype=float),
                "same_hand": 0.0,
            },
            index=frame.index,
        )
        for ours, theirs in DIFF_FEATURES.items():
            lo, hi = self.clip[pitch_type][theirs]
            x[theirs] = frame[ours].to_numpy(dtype=float).clip(lo, hi)
        return x[list(self.run.features)]

    def xrv(self, frame: pd.DataFrame) -> FloatArray:
        """Return the hand-neutral xRV of every row from every booster: shape (B, n).

        Raises:
            ValueError: If a row lacks an arsenal feature or has a type the
                model was not trained on.
        """
        out = np.full((len(next(iter(self.run.boosters.values()))), len(frame)), np.nan)
        missing = frame[list(DIFF_FEATURES)].isna().any(axis=1)
        if missing.any():
            raise ValueError(f"{int(missing.sum())} pitches have no fastball differentials")
        rv = np.asarray(self.run.rv_neutral)
        positions = np.arange(len(frame))
        for pitch_type, idx in frame.groupby("pitch_type", sort=False).indices.items():
            if pitch_type not in self.pitch_types:
                raise ValueError(f"{self.model_id} was not trained on {pitch_type}")
            x = self.features(frame.iloc[idx])
            w = self.p_same[str(pitch_type)]
            p = (1 - w) * class_probabilities(self.run, str(pitch_type), x)
            p += w * class_probabilities(self.run, str(pitch_type), x.assign(same_hand=1.0))
            out[: p.shape[0], positions[idx]] = p @ rv
        return out

    def stuff_plus(self, frame: pd.DataFrame) -> FloatArray:
        """Return Stuff+ draws for a canonical frame: shape (B, n)."""
        xrv = self.xrv(frame)
        mean = np.zeros(len(frame))
        sd = np.ones(len(frame))
        assert self.scale.by_type is not None  # set by the builder
        for i, pt in enumerate(frame["pitch_type"]):
            mean[i], sd[i] = self.scale.by_type[str(pt)]
        return 100.0 - 10.0 * (xrv - mean) / sd

    def draws(self, pitches: Sequence[PitchInput], density_indices: Sequence[float]) -> FloatArray:
        """Return one row of Stuff+ per booster. The density index is not a feature."""
        del density_indices  # FINAL_v1 reads altitude only through the shape
        frame = pd.DataFrame([p.__dict__ for p in pitches])
        return self.stuff_plus(frame)

    def score(
        self, pitch: PitchInput, arsenal: ArsenalContext | None, density_index: float
    ) -> Score:
        """Score one pitch, taking its differentials from the arsenal if it lacks them."""
        if pitch.speed_diff is None and arsenal is not None:
            diffs = arsenal_differentials(
                pitch.release_speed, pitch.ivb, pitch.horizontal_break, arsenal.pitches
            )
            if diffs is not None:
                pitch = PitchInput(**{**pitch.__dict__, **diffs.__dict__})
        d = self.draws([pitch], [density_index])[:, 0]
        se = float(d.std(ddof=1)) if len(d) > 1 else float("nan")
        return Score(value=float(d.mean()), se=se, model_id=self.model_id)
