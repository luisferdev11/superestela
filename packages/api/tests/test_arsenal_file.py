"""The translator's file summary: happy path, each refusal, and the endpoint.

Files are generated here from a seed, with the vendor's columns, so no row of
the dataset is ever committed (ADR 0002).
"""

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.arsenal_file import ArsenalFileError, summarize_arsenal
from api.main import app
from api.schemas import MAX_ARSENAL_FILE_CHARS

client = TestClient(app)

# Vendor spelling on purpose: this is what a club's export looks like.
SHAPES = {
    "Four-Seam": {"RelSpeed": 94.0, "InducedVertBreak": 17.0, "HorzBreak": 8.0, "SpinAxis": 210.0},
    "Slider": {"RelSpeed": 85.0, "InducedVertBreak": 2.0, "HorzBreak": -4.0, "SpinAxis": 100.0},
    "Changeup": {"RelSpeed": 86.0, "InducedVertBreak": 9.0, "HorzBreak": 14.0, "SpinAxis": 230.0},
}


def export(
    counts: dict[str, int], hand: str = "Right", seed: int = 7, **extra: object
) -> pd.DataFrame:
    """A pitch-level export: one row per pitch, shapes with a little noise."""
    rng = np.random.default_rng(seed)
    flip = 1.0 if hand == "Right" else -1.0
    frames = []
    for pitch_type, n in counts.items():
        base = SHAPES.get(pitch_type, SHAPES["Four-Seam"])
        frames.append(
            pd.DataFrame(
                {
                    "AutoPitchType": pitch_type,
                    "PitcherThrows": hand,
                    "RelSpeed": base["RelSpeed"] + rng.normal(0, 0.5, n),
                    "InducedVertBreak": base["InducedVertBreak"] + rng.normal(0, 1, n),
                    # The vendor reports horizontals from the catcher: a lefty's are flipped.
                    "HorzBreak": flip * (base["HorzBreak"] + rng.normal(0, 1, n)),
                    "SpinRate": 2300 + rng.normal(0, 50, n),
                    "SpinAxis": base["SpinAxis"] if hand == "Right" else 360 - base["SpinAxis"],
                    "Extension": 6.2,
                    "RelHeight": 5.9,
                    "RelSide": 2.0 if hand == "Right" else -2.0,
                    **extra,
                }
            )
        )
    return pd.concat(frames, ignore_index=True)


def csv(df: pd.DataFrame) -> str:
    return df.to_csv(index=False)


def test_summary_has_one_row_per_type_with_usage_and_shape() -> None:
    summary = summarize_arsenal(csv(export({"Four-Seam": 300, "Slider": 100})))
    assert [p.pitch_type for p in summary.pitches] == ["Four-Seam", "Slider"]
    assert [p.n for p in summary.pitches] == [300, 100]
    assert [p.usage for p in summary.pitches] == pytest.approx([0.75, 0.25])
    four_seam = summary.pitches[0]
    assert four_seam.release_speed == pytest.approx(94.0, abs=0.2)
    assert four_seam.ivb == pytest.approx(17.0, abs=0.3)
    assert summary.pitcher_hand == "Right"
    assert summary.origin is None


def test_left_hander_is_mirrored_to_the_arm_side() -> None:
    right = summarize_arsenal(csv(export({"Four-Seam": 200}, hand="Right")))
    left = summarize_arsenal(csv(export({"Four-Seam": 200}, hand="Left")))
    assert left.pitches[0].horizontal_break == pytest.approx(right.pitches[0].horizontal_break)
    assert left.pitches[0].release_side == pytest.approx(right.pitches[0].release_side)
    assert left.pitches[0].spin_axis == pytest.approx(right.pitches[0].spin_axis)


def test_spin_axis_is_averaged_around_the_circle() -> None:
    df = export({"Four-Seam": 2})
    df["SpinAxis"] = [359.0, 1.0]
    axis = summarize_arsenal(csv(df)).pitches[0].spin_axis
    assert min(axis, 360 - axis) == pytest.approx(0.0, abs=1e-6)


def test_unsupported_types_and_incomplete_rows_are_counted_not_hidden() -> None:
    df = export({"Four-Seam": 100, "Splitter": 10})
    df.loc[0, "SpinRate"] = np.nan
    summary = summarize_arsenal(csv(df))
    assert [p.n for p in summary.pitches] == [99]
    assert summary.unsupported_rows == 10
    assert summary.unsupported_types == ("Splitter",)
    assert summary.missing_feature_rows == 1


def test_at_most_six_types_the_most_thrown() -> None:
    counts = {"Four-Seam": 70, "Sinker": 60, "Slider": 50, "Changeup": 40, "Curveball": 30}
    df = pd.concat([export(counts), export({"Cutter": 20}, seed=8)], ignore_index=True)
    assert len(summarize_arsenal(csv(df)).pitches) == 6


def test_origin_comes_from_a_single_altitude_category() -> None:
    sea = summarize_arsenal(csv(export({"Four-Seam": 50}, altitude_category="No Altitude")))
    extreme = summarize_arsenal(
        csv(export({"Four-Seam": 50}, altitude_category="Extreme Altitude"))
    )
    assert (sea.origin, sea.is_measured_at_extreme) == ("sea", False)
    assert (extreme.origin, extreme.is_measured_at_extreme) == (None, True)


@pytest.mark.parametrize(
    ("df", "code"),
    [
        (export({"Four-Seam": 10}).drop(columns=["SpinRate"]), "missing_columns"),
        (
            pd.concat([export({"Four-Seam": 10}), export({"Slider": 10}, hand="Left")]),
            "mixed_hands",
        ),
        (export({"Four-Seam": 10}, hand="Undefined"), "mixed_hands"),
        (export({"Four-Seam": 10}, pitcher_anon_id=["a", "b"] * 5), "mixed_pitchers"),
        (export({"Four-Seam": 10}).iloc[:0], "empty"),
    ],
)
def test_file_refusals_carry_their_reason(df: pd.DataFrame, code: str) -> None:
    with pytest.raises(ArsenalFileError) as caught:
        summarize_arsenal(csv(df))
    assert caught.value.code == code


def test_missing_columns_are_named_as_the_file_should_carry_them() -> None:
    with pytest.raises(ArsenalFileError) as caught:
        summarize_arsenal(csv(export({"Four-Seam": 10}).drop(columns=["SpinRate", "RelSide"])))
    assert caught.value.columns == ("SpinRate", "RelSide")


def test_endpoint_returns_the_arsenal_in_camel_case() -> None:
    res = client.post(
        "/api/v1/arsenals/summarize", json={"csv": csv(export({"Four-Seam": 30, "Slider": 10}))}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["pitcherHand"] == "Right"
    assert body["pitches"][0]["pitchType"] == "Four-Seam"
    assert set(body["pitches"][0]) >= {"releaseSpeed", "horizontalBreak", "usage", "n"}


def test_endpoint_rejects_a_file_it_cannot_read() -> None:
    res = client.post("/api/v1/arsenals/summarize", json={"csv": "only,a,header\n"})
    assert res.status_code == 422
    assert res.json()["error"] in {"missing_columns", "empty"}


def test_endpoint_rejects_an_empty_body_and_an_oversized_file() -> None:
    assert client.post("/api/v1/arsenals/summarize", json={"csv": ""}).status_code == 422
    huge = "x" * (MAX_ARSENAL_FILE_CHARS + 1)
    assert client.post("/api/v1/arsenals/summarize", json={"csv": huge}).status_code == 422
