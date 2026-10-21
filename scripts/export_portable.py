"""Export the published models to portable folders and check they score the same. docs/16.

    uv run python scripts/export_portable.py

Reads ``artifacts/<name>.joblib`` (written by build_final_models.py and
distill_monotone.py), writes ``artifacts/models/<name>/`` (``models.portable``:
XGBoost JSON and a manifest, no pickle), loads the folder back and scores the
same synthetic pitches with both. Stops if a single draw differs: a model that
does not round-trip exactly is not the model that was published.
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from models import portable
from models.scoring import PitchInput

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"


def _pitches(pitch_types: tuple[str, ...], n: int = 50) -> list[PitchInput]:
    rng = np.random.default_rng(0)
    return [
        PitchInput(
            pitch_type=pitch_types[i % len(pitch_types)],
            pitcher_hand="Right",
            release_speed=float(rng.uniform(80, 98)),
            ivb=float(rng.uniform(-15, 20)),
            horizontal_break=float(rng.uniform(-15, 18)),
            spin_rate=float(rng.uniform(1800, 2800)),
            spin_axis=float(rng.uniform(0, 360)),
            extension=float(rng.uniform(5.5, 7)),
            release_height=float(rng.uniform(5, 6.5)),
            release_side=float(rng.uniform(1, 3)),
            speed_diff=float(rng.uniform(-12, 0)),
            ivb_diff=float(rng.uniform(-20, 0)),
            hb_diff=float(rng.uniform(-20, 5)),
        )
        for i in range(n)
    ]


def _located(pitch_types: tuple[str, ...], n: int = 50) -> pd.DataFrame:
    rng = np.random.default_rng(1)
    return pd.DataFrame(
        {
            "pitch_type": [pitch_types[i % len(pitch_types)] for i in range(n)],
            "pitcher_hand": "Right",
            "batter_hand": rng.choice(["Right", "Left"], n),
            "plate_height": rng.uniform(1, 4, n),
            "plate_side": rng.uniform(-1.5, 1.5, n),
            "balls": rng.integers(0, 4, n),
            "strikes": rng.integers(0, 3, n),
        }
    )


def export(name: str) -> None:
    """Write one model's folder and prove it scores exactly as the pickle does."""
    original = joblib.load(ARTIFACTS / f"{name}.joblib")
    folder = ARTIFACTS / portable.MODELS_DIR / name
    portable.save(original, folder)
    copy = portable.load(folder)
    if hasattr(original, "draws") and name != portable.LOCATION_MODEL:
        pitches = _pitches(original.pitch_types)
        a = original.draws(pitches, [1.0] * len(pitches))
        b = copy.draws(pitches, [1.0] * len(pitches))
    else:
        frame = _located(original.pitch_types)
        a, b = original.draws(frame), copy.draws(frame)
    if a.shape != b.shape or not np.array_equal(a, b):
        sys.exit(f"{name}: the portable folder does not score like the pickle")
    size = sum(f.stat().st_size for f in folder.rglob("*")) / 1e6
    print(f"{name}: {folder.relative_to(ROOT)} ({size:.0f} MB), {a.shape} draws identical")


def main() -> None:
    """Export the two models the API serves."""
    for name in (portable.STUFF_MODEL, portable.LOCATION_MODEL):
        export(name)


if __name__ == "__main__":
    main()
