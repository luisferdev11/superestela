"""The v0 bridge: Stuff+ for a pitch nobody threw, until A3 exists. ADR 0007.

It is ``stuff_plus_v0`` from analysis/evidence.py made servable, with two
declared differences and one addition:

- **Arm-side frame and platoon.** v0 feeds signed horizontal break, release
  side and spin axis with the pitcher's and batter's hands. The bridge feeds
  them mirrored to the arm side plus whether batter and pitcher share a side.
  Same information, better specified: platoon is what the literature models,
  and a mirrored left-hander can no longer score differently by construction.
- **Bagging by pitcher.** B models, each on a bootstrap sample of PITCHERS,
  since the pitcher is the unit of independence. The Stuff+ is their mean and
  its standard error their spread, which grows by itself away from the data,
  where the bags disagree. Averaging also smooths the steps a single tree
  ensemble takes when a slider moves (docs/09 section 5, gate S3).
- **Out-of-bag scale.** 100 and one sd are set on each pitch's out-of-bag
  prediction, from the bags that never saw its pitcher, which mirrors the
  out-of-fold predictions the Radar's v0 numbers come from.

It does not use arsenal features (``uses_arsenal = False``); the screen says
so. R2 of v0 is 0.003: the gates, not this docstring, decide whether it is
shown.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field

import joblib
import numpy as np
import numpy.typing as npt
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from models.scoring import ArsenalContext, PitchInput, ScaleSpec, Score

FloatArray = npt.NDArray[np.float64]

PITCH_TYPES = ("Four-Seam", "Sinker", "Slider", "Changeup", "Curveball", "Cutter")

# The canonical columns a training or scoring frame carries (CONVENTIONS.md 2.2),
# horizontal ones on the arm side.
PHYSICAL = [
    "release_speed",
    "spin_rate",
    "spin_axis",
    "ivb",
    "horizontal_break",
    "extension",
    "release_height",
    "release_side",
]
FEATURES = [*PHYSICAL, "density_index", "is_same_side"] + [f"is_{t}" for t in PITCH_TYPES]

# Same hyperparameters as stuff_plus_v0 in analysis/evidence.py, so the bridge
# differs from the Radar's model only where the docstring says it does.
V0_PARAMS = dict(max_iter=220, learning_rate=0.06, max_depth=6, min_samples_leaf=200)


def design_matrix(frame: pd.DataFrame) -> FloatArray:
    """Return the model's features from a canonical frame, in FEATURES order."""
    dummies = [(frame["pitch_type"] == t).astype(float).rename(f"is_{t}") for t in PITCH_TYPES]
    x = pd.concat([frame[[*PHYSICAL, "density_index", "is_same_side"]], *dummies], axis=1)
    return x[FEATURES].to_numpy(dtype=float)


@dataclass
class BridgeModel:
    """A fitted v0 bridge. Implements ``models.scoring.Scorer``."""

    model_id: str
    scale: ScaleSpec
    same_side_share: dict[str, float]
    bags: list[HistGradientBoostingRegressor] = field(repr=False)
    uses_arsenal: bool = False

    def bag_xrv(self, frame: pd.DataFrame) -> FloatArray:
        """Expected run value per bag and pitch, averaged over the batter's side.

        A hypothetical pitch has no batter, so it is scored against the mix of
        same-side and opposite-side hitters its type actually faces.
        """
        share = frame["pitch_type"].map(self.same_side_share).fillna(0.5).to_numpy()
        same = design_matrix(frame.assign(is_same_side=1.0))
        opposite = design_matrix(frame.assign(is_same_side=0.0))
        return np.stack(
            [share * m.predict(same) + (1 - share) * m.predict(opposite) for m in self.bags]
        )

    def stuff_plus(self, frame: pd.DataFrame) -> tuple[FloatArray, FloatArray]:
        """Return Stuff+ and its standard error for every row of a canonical frame."""
        per_bag = 100.0 - 10.0 * (self.bag_xrv(frame) - self.scale.mean_xrv) / self.scale.sd_xrv
        return per_bag.mean(axis=0), per_bag.std(axis=0, ddof=1)

    def draws(self, pitches: Sequence[PitchInput], density_indices: Sequence[float]) -> FloatArray:
        """Stuff+ per bag (rows) and pitch (columns): the bags are the draws."""
        frame = pd.DataFrame(
            [
                {
                    **{name: getattr(p, name) for name in PHYSICAL},
                    "pitch_type": p.pitch_type,
                    "density_index": rho,
                }
                for p, rho in zip(pitches, density_indices, strict=True)
            ]
        )
        return 100.0 - 10.0 * (self.bag_xrv(frame) - self.scale.mean_xrv) / self.scale.sd_xrv

    def score(
        self, pitch: PitchInput, arsenal: ArsenalContext | None, density_index: float
    ) -> Score:
        """Return the Stuff+ of one pitch. The arsenal is accepted and not used."""
        row = {name: getattr(pitch, name) for name in PHYSICAL}
        frame = pd.DataFrame(
            [{**row, "pitch_type": pitch.pitch_type, "density_index": density_index}]
        )
        value, se = self.stuff_plus(frame)
        return Score(value=float(value[0]), se=float(se[0]), model_id=self.model_id)

    def save(self, path: str) -> None:
        """Write the fitted model; the file is derived from licensed data, never commit it."""
        joblib.dump(self, path)

    @staticmethod
    def load(path: str) -> BridgeModel:
        """Read a model written by ``save``."""
        model = joblib.load(path)
        if not isinstance(model, BridgeModel):
            raise TypeError(f"{path} does not hold a BridgeModel")
        return model


def fit_bridge(
    frame: pd.DataFrame, model_id: str, n_bags: int = 20, seed: int = 7
) -> tuple[BridgeModel, FloatArray]:
    """Fit the bridge on a canonical frame with ``run_value`` and ``pitcher_id``.

    Returns the model and, per pitch, its out-of-bag expected run value: the
    mean over the bags that never saw its pitcher, NaN if every bag did. That
    is a pitcher holdout for free, and gates S5-S7 are measured on it.

    Args:
        frame: One row per pitch. Horizontal columns on the arm side,
            ``is_same_side`` as 0/1.
        model_id: ``MAJOR.MINOR.PATCH+<sha7>``, CONVENTIONS.md section 5.3.
        n_bags: Bootstrap samples of pitchers.
        seed: For the pitcher samples and the models.
    """
    rng = np.random.default_rng(seed)
    x, y = design_matrix(frame), frame["run_value"].to_numpy(dtype=float)
    pitchers = frame["pitcher_id"].to_numpy()
    unique = np.unique(pitchers)
    oob_sum, oob_n = np.zeros(len(frame)), np.zeros(len(frame))
    bags = []
    for b in range(n_bags):
        drawn, counts = np.unique(rng.choice(unique, size=len(unique)), return_counts=True)
        weight = pd.Series(counts, index=drawn).reindex(pitchers).fillna(0).to_numpy()
        bag = HistGradientBoostingRegressor(**V0_PARAMS, random_state=seed + b)
        bag.fit(x, y, sample_weight=weight)
        out = weight == 0
        oob_sum[out] += bag.predict(x[out])
        oob_n[out] += 1
        bags.append(bag)
    oob = np.full(len(frame), np.nan)
    seen = oob_n > 0
    oob[seen] = oob_sum[seen] / oob_n[seen]
    scale = ScaleSpec(
        description="100 - 10 z of out-of-bag expected run value over the whole league, "
        "both environments and all pitch types, as stuff_plus_v0",
        mean_xrv=float(np.nanmean(oob)),
        sd_xrv=float(np.nanstd(oob)),
    )
    share = frame.groupby("pitch_type")["is_same_side"].mean()
    model = BridgeModel(
        model_id=model_id,
        scale=scale,
        same_side_share={str(k): float(v) for k, v in share.items()},
        bags=bags,
    )
    return model, oob
