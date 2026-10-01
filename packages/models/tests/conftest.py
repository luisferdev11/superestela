"""A small bridge fitted on seeded synthetic data, shared by the harness tests."""

import numpy as np
import pandas as pd
import pytest

from models.stuff.v0_bridge import PITCH_TYPES, BridgeModel, fit_bridge


@pytest.fixture(scope="module")
def model() -> BridgeModel:
    rng = np.random.default_rng(0)
    n = 4000
    frame = pd.DataFrame(
        {
            "pitch_type": rng.choice(PITCH_TYPES, n),
            "release_speed": rng.normal(89, 4, n),
            "spin_rate": rng.normal(2300, 200, n),
            "spin_axis": rng.normal(200, 30, n),
            "ivb": rng.normal(10, 7, n),
            "horizontal_break": rng.normal(6, 6, n),
            "extension": rng.normal(6.1, 0.4, n),
            "release_height": rng.normal(5.9, 0.4, n),
            "release_side": rng.normal(1.8, 0.5, n),
            "density_index": rng.choice([1.0, 0.858], n),
            "is_same_side": rng.integers(0, 2, n).astype(float),
            "pitcher_id": rng.integers(0, 40, n).astype(str),
        }
    )
    frame["run_value"] = -0.02 * (frame.release_speed - 89) + rng.normal(0, 0.2, n)
    fitted, _ = fit_bridge(frame, model_id="0.1.0+test", n_bags=3, seed=1)
    return fitted
