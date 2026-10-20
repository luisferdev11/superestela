"""Read one of data's MLflow runs from disk: boosters, feature order, run values.

Data trains with ``notebooks/experimentos_stuff.py`` on their branch and
leaves, per run, a folder with ``config.json`` (``features_resolved`` is the
exact column order each booster expects), ``rv_values.csv`` (the run value of
each class) and ``models/stuff_<pitch type>.json`` (one XGBoost multiclass
booster per type, the file is named ``stuff_`` even for Location+). The
folders live in ``artifacts/data-runs/`` and never in git: they are fitted on
the licensed data (CONVENTIONS.md 8.4).

A type may also carry its cross-validation boosters as
``models/folds/stuff_<pitch type>_f<k>.json``. With them, the scorers draw one
score per fold and the spread is the band; without them there is one booster
and no band (docs/14).
"""

from __future__ import annotations

import glob
import json
import os
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
import pandas as pd
import xgboost as xgb

FloatArray = npt.NDArray[np.float64]


@dataclass(frozen=True)
class DataRun:
    """The parts of a run the product needs to score the way data trained."""

    name: str
    features: tuple[str, ...]
    classes: tuple[str, ...]
    # Per pitch type, the final booster alone or the fold boosters.
    boosters: dict[str, tuple[xgb.Booster, ...]]
    rv_neutral: tuple[float, ...]
    has_folds: bool


def read_run(path: str, classes: tuple[str, ...]) -> DataRun:
    """Read a run folder, checking that every booster speaks the declared classes.

    Args:
        path: The run folder (``config.json``, ``rv_values.csv``, ``models/``).
        classes: The class order of the run's target scheme, as data's
            ``SCHEMES`` lists it; booster output column i is class i.

    Raises:
        ValueError: If a booster's features or class count disagree with the
            run, or the run values do not name the same classes.
    """
    with open(os.path.join(path, "config.json")) as fh:
        config = json.load(fh)
    features = tuple(config["features_resolved"])
    rv = pd.read_csv(os.path.join(path, "rv_values.csv"), index_col=0).iloc[:, 0]
    if tuple(rv.index) != classes:
        raise ValueError(f"{path}: rv_values.csv lists {tuple(rv.index)}, expected {classes}")

    folds = sorted(glob.glob(os.path.join(path, "models", "folds", "stuff_*_f*.json")))
    files = folds or sorted(glob.glob(os.path.join(path, "models", "stuff_*.json")))
    boosters: dict[str, list[xgb.Booster]] = {}
    for file in files:
        stem = os.path.basename(file)[len("stuff_") : -len(".json")]
        pitch_type = stem.rsplit("_f", 1)[0] if folds else stem
        booster = xgb.Booster()
        booster.load_model(file)
        if tuple(booster.feature_names or ()) != features:
            raise ValueError(f"{file}: features differ from {path}/config.json")
        n_class = int(
            json.loads(booster.save_config())["learner"]["learner_model_param"]["num_class"]
        )
        if n_class != len(classes):
            raise ValueError(f"{file}: {n_class} classes, the run declares {len(classes)}")
        boosters.setdefault(pitch_type, []).append(booster)
    if not boosters:
        raise ValueError(f"{path}: no boosters under models/")
    return DataRun(
        name=str(config["name"]),
        features=features,
        classes=classes,
        boosters={k: tuple(v) for k, v in boosters.items()},
        rv_neutral=tuple(float(v) for v in rv.to_numpy()),
        has_folds=bool(folds),
    )


def class_probabilities(run: DataRun, pitch_type: str, x: pd.DataFrame) -> FloatArray:
    """Return P(class) for each row from each booster of a type: shape (B, n, K).

    ``x`` must carry exactly ``run.features``; it is cast to float32 as in
    training.
    """
    matrix = xgb.DMatrix(x[list(run.features)].astype("float32"), feature_names=list(run.features))
    return np.stack([b.predict(matrix) for b in run.boosters[pitch_type]]).astype(float)
