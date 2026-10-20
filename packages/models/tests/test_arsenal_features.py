"""The fastball differentials, ported from data's _fb_diffs (docs/15).

The parity with data's own function on the real dataset is checked by
scripts/verify_final_models.py; these pin the rules on small frames.
"""

import pandas as pd

from core.arsenal import ArsenalPitch
from models.features.arsenal import arsenal_differentials, frame_differentials, primary_fastball


def _frame(rows: list[tuple[str | None, str, float, float, float]]) -> pd.DataFrame:
    return pd.DataFrame(
        rows, columns=["pitcher_anon_id", "pitch_type", "release_speed", "ivb", "horizontal_break"]
    ).assign(year=2025, environment="No Altitude")


def test_a_pitch_is_measured_against_the_fastball_thrown_most():
    f = _frame(
        [
            ("p", "Four-Seam", 95.0, 16.0, 8.0),
            ("p", "Sinker", 93.0, 8.0, 15.0),
            ("p", "Sinker", 93.0, 8.0, 15.0),
            ("p", "Changeup", 85.0, 6.0, 14.0),
        ]
    )
    d = frame_differentials(f)
    assert d.loc[3, "speed_diff"] == -8.0  # against the sinker, thrown twice
    assert d.loc[3, "ivb_diff"] == -2.0


def test_a_two_seam_counts_as_a_fastball_and_a_cutter_does_not():
    f = _frame([("p", "Cutter", 90.0, 10.0, -2.0), ("p", "Cutter", 90.0, 10.0, -2.0)])
    f = pd.concat([f, _frame([("p", "TwoSeamFastBall", 92.0, 9.0, 14.0)])], ignore_index=True)
    assert frame_differentials(f).loc[0, "speed_diff"] == -2.0


def test_without_a_fastball_the_fastest_type_is_the_reference():
    f = _frame([("p", "Slider", 84.0, 2.0, -5.0), ("p", "Curveball", 78.0, -10.0, -8.0)])
    assert frame_differentials(f).loc[1, "speed_diff"] == -6.0


def test_a_row_without_its_pitcher_gets_no_reference_rather_than_zero():
    f = _frame([("p", "Four-Seam", 95.0, 16.0, 8.0), (None, "Slider", 84.0, 2.0, -5.0)])
    assert pd.isna(frame_differentials(f).loc[1, "speed_diff"])


def test_each_season_and_environment_is_its_own_arsenal():
    f = pd.concat(
        [
            _frame([("p", "Four-Seam", 95.0, 16.0, 8.0)]),
            _frame([("p", "Four-Seam", 93.0, 12.0, 6.0)]).assign(environment="Extreme Altitude"),
        ],
        ignore_index=True,
    )
    assert (frame_differentials(f)["speed_diff"] == 0.0).all()


def _pitch(t: str, usage: float, speed: float) -> ArsenalPitch:
    return ArsenalPitch(t, usage, speed, 10.0, 5.0, 6.0, 1.5)


def test_an_arsenal_takes_the_most_used_fastball_by_the_same_rule():
    arsenal = [_pitch("Cutter", 0.5, 91.0), _pitch("Sinker", 0.2, 93.0), _pitch("Slider", 0.3, 85)]
    ref = primary_fastball(arsenal)
    assert ref is not None and ref.pitch_type == "Sinker"
    gaps = arsenal_differentials(85.0, 10.0, 5.0, arsenal)
    assert gaps is not None and gaps.speed_diff == -8.0


def test_no_arsenal_gives_no_differentials():
    assert arsenal_differentials(85.0, 10.0, 5.0, []) is None
