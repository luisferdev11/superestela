"""Rows as the vendor delivers them, seeded, for the scoring harness tests."""

import numpy as np
import pandas as pd

from models.stuff.v0_bridge import PITCH_TYPES

REFERENCE = 0.00159  # any positive drag coefficient will do on synthetic data


def raw_pitches(n: int = 120, seed: int = 3) -> pd.DataFrame:
    """Rows as the vendor delivers them, with trajectory and game."""
    rng = np.random.default_rng(seed)
    return pd.DataFrame(
        {
            "PitchUID": [f"uid_{i}" for i in range(n)],
            "AutoPitchType": rng.choice(PITCH_TYPES, n),
            "PitcherThrows": rng.choice(["Right", "Left"], n),
            "RelSpeed": rng.normal(89, 3, n),
            "SpinRate": rng.normal(2300, 150, n),
            "SpinAxis": rng.normal(200, 20, n),
            "InducedVertBreak": rng.normal(10, 5, n),
            "HorzBreak": rng.normal(5, 5, n),
            "Extension": rng.normal(6.1, 0.3, n),
            "RelHeight": rng.normal(5.9, 0.3, n),
            "RelSide": rng.normal(1.5, 0.5, n),
            "altitude_category": rng.choice(["No Altitude", "Extreme Altitude"], n),
            "game_anon_id": [f"g{i % 2}" for i in range(n)],
            # A plausible release: toward the plate at ~130 ft/s, with drag and lift.
            "vx0": rng.normal(5, 1, n),
            "vy0": rng.normal(-130, 3, n),
            "vz0": rng.normal(-5, 1, n),
            "ax0": rng.normal(-10, 2, n),
            "ay0": rng.normal(27, 2, n),
            "az0": rng.normal(-15, 2, n),
        }
    )
