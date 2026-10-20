"""Descriptive features data computed alongside the final models. docs/15.

``prepare_extra_features`` in data's ``experimentos_stuff.py`` adds these to
every pitch. Neither final model reads them (``FINAL_v1`` and
``L3_loc_count_hand`` list their features in ``config.json``), so they are
for analysis only: the API returns them when the inputs are there and
``null`` when not, and no score depends on them.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# data's ALT_ORD (experimentos_stuff.py line 71)
ALTITUDE_ORDER = {"No Altitude": 0, "Medium Altitude": 1, "Extreme Altitude": 2}
# _vaa_est's assumptions: plate height of the pitch and mph lost on the way
# (docs/09 section 3.5), and the mound-to-plate distance in feet.
PLATE_HEIGHT_FT = 2.5
SPEED_LOSS_MPH = 7.0
MOUND_TO_PLATE_FT = 60.5
FRONT_OF_PLATE_FT = 17 / 12
GRAVITY_FT_S2 = -32.174
MPH_TO_FT_S = 1.46667
# Centre of the zone that loc_dist_center measures from, in feet.
ZONE_CENTRE_HEIGHT_FT = 2.5

ANALYSIS_FEATURES = (
    "alt_ord",
    "total_break",
    "move_per_rpm",
    "vaa_est",
    "loc_abs_side",
    "loc_dist_center",
)


def _col(frame: pd.DataFrame, name: str) -> pd.Series:
    if name in frame:
        return pd.to_numeric(frame[name], errors="coerce")
    return pd.Series(np.nan, index=frame.index)


def analysis_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Return the six descriptive features for every row, NaN where an input is missing.

    ``frame`` is canonical, horizontal break on the arm side.
    """
    speed, ivb, hb = (
        _col(frame, "release_speed"),
        _col(frame, "ivb"),
        _col(frame, "horizontal_break"),
    )
    spin = _col(frame, "spin_rate")
    total = np.sqrt(ivb**2 + hb**2)
    v0 = speed * MPH_TO_FT_S
    vf = (speed - SPEED_LOSS_MPH) * MPH_TO_FT_S
    length = MOUND_TO_PLATE_FT - _col(frame, "extension") - FRONT_OF_PLATE_FT
    t = length / (0.5 * (v0 + vf))
    az = GRAVITY_FT_S2 + 2 * (ivb / 12) / t**2
    vz0 = ((PLATE_HEIGHT_FT - _col(frame, "release_height")) - 0.5 * az * t**2) / t
    side, height = _col(frame, "plate_side"), _col(frame, "plate_height")
    environment = (
        frame["environment"] if "environment" in frame else pd.Series(None, index=frame.index)
    )
    return pd.DataFrame(
        {
            "alt_ord": environment.map(ALTITUDE_ORDER).astype(float),
            "total_break": total,
            "move_per_rpm": total / spin.where(spin > 0) * 1000,
            "vaa_est": np.degrees(np.arctan((vz0 + az * t) / vf)),
            "loc_abs_side": side.abs(),
            "loc_dist_center": np.sqrt(side**2 + (height - ZONE_CENTRE_HEIGHT_FT) ** 2),
        },
        index=frame.index,
    )
