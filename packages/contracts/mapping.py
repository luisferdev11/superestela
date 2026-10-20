"""Vendor-to-canonical column renaming.

This module is the ONLY place in the repository where a vendor column name is
translated. The raw layer keeps the vendor spelling exactly as delivered; every
layer above it speaks canonical snake_case. See CONVENTIONS.md section 2.1.

If you are writing `df["RelSpeed"]` anywhere else, you are in the wrong layer.
"""

from __future__ import annotations

import pandas as pd

# Canonical names come from the glossary in CONVENTIONS.md section 2.2.
# `ivb` and `xrv` stay abbreviated on purpose: they are the terms of art.
VENDOR_TO_CANONICAL: dict[str, str] = {
    "RelSpeed": "release_speed",
    "SpinRate": "spin_rate",
    "SpinAxis": "spin_axis",
    "InducedVertBreak": "ivb",
    "HorzBreak": "horizontal_break",
    "Extension": "extension",
    "RelHeight": "release_height",
    "RelSide": "release_side",
    "PlateLocHeight": "plate_height",
    "PlateLocSide": "plate_side",
    "AutoPitchType": "pitch_type",
    "PitcherThrows": "pitcher_hand",
    "BatterSide": "batter_hand",
    "altitude_category": "environment",
    "PitchUID": "pitch_id",
    # The count, which Location+ reads (docs/15).
    "Balls": "balls",
    "Strikes": "strikes",
}

CANONICAL_TO_VENDOR: dict[str, str] = {v: k for k, v in VENDOR_TO_CANONICAL.items()}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename vendor columns to their canonical form.

    Applied at the raw-to-curated boundary so that no downstream module has to
    know the vendor's spelling. Columns with no mapping are left untouched:
    a delivery may legitimately carry fields we have not glossed yet.

    Returns a new frame; the input is not modified (CONVENTIONS.md section 3.7).
    """
    return df.rename(columns=VENDOR_TO_CANONICAL)


def denormalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename canonical columns back to vendor form.

    Needed only when writing something the vendor's own tooling will read back.
    """
    return df.rename(columns=CANONICAL_TO_VENDOR)
