"""Run folders in data's layout, with tiny boosters fitted to noise, for the tests."""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from models.location import final as location
from models.runs import read_run
from models.scoring import ScaleSpec
from models.stuff import final as stuff

STUFF_FEATURES = [
    "RelSpeed",
    "SpinRate",
    "SpinAxis_sin",
    "SpinAxis_cos",
    "InducedVertBreak",
    "HorzBreak_m",
    "RelHeight",
    "RelSide_m",
    "Extension",
    "same_hand",
    "speed_diff_env",
    "ivb_diff_env",
    "hb_diff_env",
]
LOCATION_FEATURES = ["PlateLocHeight", "PlateLocSide", "Balls", "Strikes", "same_hand"]


def write_run(path: Path, features: list[str], classes: tuple[str, ...], folds: int = 0) -> Path:
    rng = np.random.default_rng(1)
    (path / "models" / "folds").mkdir(parents=True)
    (path / "config.json").write_text(
        json.dumps({"name": path.name, "features_resolved": features})
    )
    rv = pd.Series(np.linspace(-0.2, 1.0, len(classes)), index=list(classes), name="rv_neutral")
    rv.to_csv(path / "rv_values.csv")
    for k in range(max(folds, 1)):
        x = pd.DataFrame(rng.normal(size=(300, len(features))), columns=features)
        y = rng.integers(0, len(classes), 300)
        params = {"objective": "multi:softprob", "num_class": len(classes), "max_depth": 2}
        b = xgb.train(params, xgb.DMatrix(x, label=y), num_boost_round=5)
        target = (
            path / "models" / (f"folds/stuff_Slider_f{k}.json" if folds else "stuff_Slider.json")
        )
        b.save_model(str(target))
    return path


def toy_stuff(path: Path) -> stuff.FinalStuffScorer:
    """A FINAL_v1-shaped Stuff+ that knows only sliders."""
    run = read_run(str(write_run(path, STUFF_FEATURES, stuff.CLASSES)), stuff.CLASSES)
    return stuff.FinalStuffScorer(
        model_id="1.0.0+abcdef0",
        scale=ScaleSpec("toy", 0.0, 0.05, by_type={"Slider": (0.01, 0.02)}),
        pitch_types=("Slider",),
        run=run,
        p_same={"Slider": 0.6},
        clip={"Slider": {c: (-5.0, 5.0) for c in stuff.DIFF_FEATURES.values()}},
        provenance={"run": "FINAL", "selection": "toy", "candidates": []},
    )


def toy_location(path: Path) -> location.FinalLocationScorer:
    """An L3-shaped Location+ that knows only sliders; a ball at three balls costs more."""
    run = read_run(str(write_run(path, LOCATION_FEATURES, location.CLASSES)), location.CLASSES)
    by_count = np.tile(np.asarray(run.rv_neutral)[:, None, None], (1, 4, 3))
    by_count[0, 3, :] = 0.5
    return location.FinalLocationScorer(
        model_id="1.0.0+abcdef0",
        pitch_types=("Slider",),
        run=run,
        rv_by_count=by_count,
        scale={"Slider": (0.0, 0.05)},
        scale_description="toy",
    )
