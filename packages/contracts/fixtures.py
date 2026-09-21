"""Synthetic deliveries used to test the contracts.

docs/07 section 4.2 asks for a small anonymised fixture committed to the repo.
We generate it from a fixed seed instead of committing a parquet file, for two
reasons: nothing generated here can possibly contain competition data, and the
rule "no .parquet in git, on any path" stays absolute with no exception for
anyone to remember or misread.

`contracts.yml` materialises these to a temporary file and validates that file,
which exercises exactly the path a real delivery takes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from contracts.schemas import ROLES

FIXTURE_SEED = 7
FIXTURE_MODEL_VERSION = "1.2.0+a3f9c1e"


def valid_pitch_scores(n: int = 500, seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """Build a delivery that satisfies Contract A in every respect."""
    rng = np.random.default_rng(seed)
    return pd.DataFrame(
        {
            "pitch_id": [f"pitch_{i:06d}" for i in range(n)],
            "model_version": FIXTURE_MODEL_VERSION,
            "stuff_plus": rng.normal(100.0, 10.0, n).clip(40.0, 160.0),
            "stuff_plus_se": rng.uniform(1.5, 4.0, n),
            "location_plus": rng.normal(100.0, 8.0, n).clip(40.0, 160.0),
            "pitching_plus": rng.normal(100.0, 9.0, n).clip(40.0, 160.0),
            "p_whiff": rng.uniform(0.0, 1.0, n),
            "p_chase": rng.uniform(0.0, 1.0, n),
            "p_gb": rng.uniform(0.0, 1.0, n),
            "p_hard_hit": rng.uniform(0.0, 1.0, n),
            "xrv": rng.uniform(-0.5, 0.8, n),
            "density_index": rng.uniform(0.80, 1.02, n),
            "scored_at": pd.Timestamp("2026-10-01T12:00:00Z"),
        }
    )


def valid_pitcher_aggregates(n: int = 60, seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """Build a delivery that satisfies Contract B in every respect.

    One row per pitcher and season, and deliberately not the same seasons for
    everyone: the real dataset has 702 pitchers with a single season, 252 with
    two, 152 with three, and 28 who skipped a year and came back. A fixture
    where everyone has the same seasons would never exercise that.
    """
    rng = np.random.default_rng(seed)
    season_patterns = [
        (2026,),
        (2025,),
        (2025, 2026),
        (2024, 2025, 2026),
        (2024, 2026),  # the gap: left and came back
    ]
    rows = [
        {
            "pitcher_id": f"pitcher_{i:05d}",
            "season": season,
            "n_pitches_hh": int(rng.integers(100, 800)),
            "n_pitches_sea": int(rng.integers(100, 800)),
            "stuff_plus_hh": float(np.clip(rng.normal(100.0, 10.0), 40.0, 160.0)),
            "stuff_plus_hh_ci95": float(rng.uniform(1.0, 6.0)),
            "stuff_plus_sea": float(np.clip(rng.normal(100.0, 10.0), 40.0, 160.0)),
            "stuff_plus_sea_ci95": float(rng.uniform(1.0, 6.0)),
            "role": str(rng.choice(ROLES)),
            "median_entry_inning": float(rng.integers(1, 10)),
            "altitude_tax_per_9": float(rng.normal(1.8, 0.9)),
            "altitude_tax_se": float(rng.uniform(0.1, 0.4)),
            "altitude_tax_significant": bool(rng.integers(0, 2)),
            "arsenal": [{"pitch_type": "Four-Seam", "usage": 0.55}],
        }
        for i in range(n)
        for season in season_patterns[i % len(season_patterns)]
    ]
    return pd.DataFrame(rows)


def duplicate_pitcher_season(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """The same pitcher twice in one season. Rejected: that is the key."""
    df = valid_pitcher_aggregates(seed=seed)
    df.loc[1, ["pitcher_id", "season"]] = df.loc[0, ["pitcher_id", "season"]].to_numpy()
    return df


def missing_standard_error(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """A delivery with no `stuff_plus_se` at all. Rejected: docs/07 section 1.1."""
    return valid_pitch_scores(seed=seed).drop(columns=["stuff_plus_se"])


def null_standard_error(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """A delivery where some scores carry no band. Rejected, same rule."""
    df = valid_pitch_scores(seed=seed)
    df.loc[: len(df) // 10, "stuff_plus_se"] = np.nan
    return df


def duplicate_pitch_ids(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """A delivery whose join key is not unique. Rejected."""
    df = valid_pitch_scores(seed=seed)
    df.loc[1, "pitch_id"] = df.loc[0, "pitch_id"]
    return df


def out_of_range_stuff_plus(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """A delivery with a score off the signed scale. Rejected."""
    df = valid_pitch_scores(seed=seed)
    df.loc[3, "stuff_plus"] = 250.0
    return df


def malformed_model_version(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """A delivery that cannot be traced back to a build. Rejected."""
    df = valid_pitch_scores(seed=seed)
    df["model_version"] = "v2-final-FINAL"
    return df


def vendor_named_columns(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """A valid delivery still using the vendor's spelling of the join key.

    Accepted after normalisation: renaming at the boundary is exactly what
    `contracts.mapping` exists to do.
    """
    return valid_pitch_scores(seed=seed).rename(columns={"pitch_id": "PitchUID"})


def invalid_role(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """Aggregates claiming a role the data cannot support. Rejected.

    "closer" is the realistic mistake here: it is the word everyone reaches
    for, and the dataset has no score column to justify it.
    """
    df = valid_pitcher_aggregates(seed=seed)
    df.loc[0, "role"] = "closer"
    return df


def retired_role(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """A delivery still using the three-way split. Rejected since ADR 0004."""
    df = valid_pitcher_aggregates(seed=seed)
    df.loc[0, "role"] = "late_inning_reliever"
    return df
