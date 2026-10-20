"""Score pitches with data's final Stuff+ and Location+, each on its own inputs. docs/14.

``POST /api/v1/pitches/score``. The two models answer different questions
and read different columns, so each is validated on its own: a pitch with a
shape but no plate location gets a Stuff+ and, for Location+, the list of
what it lacked. Nothing missing is ever filled in, with a zero or anything
else; a model that cannot score a pitch says why.

- **Stuff+** reads the shape at release (arm side, as the Simulator sends
  it) and, for a model with ``uses_arsenal``, the pitch against its primary
  fastball: from the request's ``arsenal`` or, without one, from the
  request's own pitches of the same ``pitcherId``, season and environment.
- **Location+** reads plate location (catcher's view), the count and both
  hands.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace

import numpy as np
import pandas as pd
from pydantic.alias_generators import to_camel

from api import schemas as s
from core.arsenal import ArsenalPitch
from models.batch import CATEGORY_DENSITY
from models.features.analysis import ANALYSIS_FEATURES, analysis_features
from models.features.arsenal import DIFF_COLUMNS, arsenal_differentials, frame_differentials
from models.location.final import REQUIRED as LOCATION_REQUIRED
from models.location.final import FinalLocationScorer
from models.scoring import PitchInput, Scorer

STUFF_REQUIRED = (
    "pitch_type",
    "pitcher_hand",
    "release_speed",
    "spin_rate",
    "spin_axis",
    "ivb",
    "horizontal_break",
    "extension",
    "release_height",
    "release_side",
)
HANDS = ("Right", "Left")
SEA_LEVEL = CATEGORY_DENSITY["No Altitude"]


class MissingColumnsError(ValueError):
    """Every pitch lacks a column a requested model needs."""

    def __init__(self, model: str, columns: Sequence[str]) -> None:
        """Keep which model and which wire names, for the 422 body."""
        super().__init__(f"{model}: {', '.join(columns)}")
        self.model = model
        self.columns = [to_camel(c) for c in columns]


def _absent(frame: pd.DataFrame, required: Sequence[str]) -> list[str]:
    return [c for c in required if frame[c].isna().all()]


def _row_missing(frame: pd.DataFrame, required: Sequence[str]) -> list[list[str]]:
    gaps = frame[list(required)].isna()
    return [[to_camel(c) for c in required if row[c]] for _, row in gaps.iterrows()]


def _status(
    frame: pd.DataFrame,
    missing: list[list[str]],
    pitch_types: Sequence[str],
    hands: Sequence[str],
) -> list[s.ScoreStatus]:
    out: list[s.ScoreStatus] = []
    for i, row in enumerate(frame.itertuples(index=False)):
        if missing[i]:
            out.append("missing_features")
        elif row.pitch_type not in pitch_types:
            out.append("unsupported_pitch_type")
        elif any(getattr(row, h) not in HANDS for h in hands):
            out.append("unknown_hand")
        else:
            out.append("scored")
    return out


def _band(draws: np.ndarray) -> s.ScoreOut:
    se = float(draws.std(ddof=1)) if len(draws) > 1 else None
    return s.ScoreOut(value=float(draws.mean()), se=se)


def _differentials(frame: pd.DataFrame, arsenal: list[s.ArsenalPitchIn] | None) -> pd.DataFrame:
    """Each pitch against its fastball: from the given arsenal, else from the request's pitches."""
    if arsenal:
        pitches = [ArsenalPitch(**a.model_dump()) for a in arsenal]
        rows = [
            arsenal_differentials(float(speed), float(ivb), float(hb), pitches)
            for speed, ivb, hb in zip(
                frame["release_speed"], frame["ivb"], frame["horizontal_break"], strict=True
            )
        ]
        return pd.DataFrame(
            [d.__dict__ if d is not None else dict.fromkeys(DIFF_COLUMNS) for d in rows],
            index=frame.index,
            dtype=float,
        )
    keyed = frame.assign(
        pitcher_anon_id=frame["pitcher_id"],
        year=frame["year"].fillna(0),
        environment=frame["environment"].fillna("request").astype(object),
    )
    return frame_differentials(keyed)


def _stuff(
    frame: pd.DataFrame, scorer: Scorer | None, arsenal: list[s.ArsenalPitchIn] | None
) -> list[s.ModelScore]:
    if scorer is None:
        return [s.ModelScore(status="model_unavailable", score=None, missing=[])] * len(frame)
    missing = _row_missing(frame, STUFF_REQUIRED)
    status = _status(frame, missing, scorer.pitch_types, ("pitcher_hand",))
    if scorer.uses_arsenal:
        diffs = _differentials(frame, arsenal)
        frame = frame.join(diffs)
        for i, has in enumerate(diffs.notna().all(axis=1)):
            if status[i] == "scored" and not has:
                status[i] = "missing_arsenal"
                missing[i] = ["arsenal" if arsenal is None else "arsenal (sin recta)"]
                if arsenal is None and pd.isna(frame["pitcher_id"].iloc[i]):
                    missing[i] = ["arsenal", "pitcherId"]
    ok = [i for i, st in enumerate(status) if st == "scored"]
    scores: list[s.ScoreOut | None] = [None] * len(frame)
    if ok:
        rows = frame.iloc[ok]
        pitches = [
            replace(
                PitchInput(
                    pitch_type=str(r["pitch_type"]),
                    pitcher_hand=str(r["pitcher_hand"]),
                    **{c: float(r[c]) for c in STUFF_REQUIRED[2:]},
                ),
                **({c: float(r[c]) for c in DIFF_COLUMNS} if scorer.uses_arsenal else {}),  # type: ignore[arg-type]
            )
            for r in rows.to_dict("records")
        ]
        rho = rows["environment"].map(CATEGORY_DENSITY).fillna(SEA_LEVEL).astype(float).tolist()
        draws = scorer.draws(pitches, rho)
        for j, i in enumerate(ok):
            scores[i] = _band(draws[:, j])
    return [
        s.ModelScore(status=st, score=sc, missing=m)
        for st, sc, m in zip(status, scores, missing, strict=True)
    ]


def _location(frame: pd.DataFrame, scorer: FinalLocationScorer | None) -> list[s.ModelScore]:
    if scorer is None:
        return [s.ModelScore(status="model_unavailable", score=None, missing=[])] * len(frame)
    missing = _row_missing(frame, LOCATION_REQUIRED)
    status = _status(frame, missing, scorer.pitch_types, ("pitcher_hand", "batter_hand"))
    ok = [i for i, st in enumerate(status) if st == "scored"]
    scores: list[s.ScoreOut | None] = [None] * len(frame)
    if ok:
        draws = scorer.draws(frame.iloc[ok].reset_index(drop=True))
        for j, i in enumerate(ok):
            scores[i] = _band(draws[:, j])
    return [
        s.ModelScore(status=st, score=sc, missing=m)
        for st, sc, m in zip(status, scores, missing, strict=True)
    ]


def model_info(
    model_id: str,
    provenance: object,
    has_bands: bool,
    scale: str,
    pitch_types: Sequence[str],
    required: Sequence[str],
) -> s.ModelInfo:
    """Describe a model for the response, from what its builder recorded."""
    p = provenance if isinstance(provenance, dict) else {}
    return s.ModelInfo(
        model_id=model_id,
        run=p.get("run"),
        selection=p.get("selection"),
        has_bands=has_bands,
        scale=scale,
        pitch_types=list(pitch_types),
        required=[to_camel(c) for c in required],
        candidates=[s.CandidateRun(**c) for c in p.get("candidates", [])],
    )


def score_pitches(
    req: s.PitchScoresRequest,
    stuff_scorer: Scorer | None,
    location_scorer: FinalLocationScorer | None,
) -> s.PitchScoresResponse:
    """Score every pitch with each requested model, in the order they came.

    Raises:
        MissingColumnsError: When no pitch carries a column a requested model
            needs: then nothing could be scored, and the caller says which.
    """
    frame = pd.DataFrame([p.model_dump() for p in req.pitches])
    if "stuff" in req.models and stuff_scorer is not None:
        absent = _absent(frame, STUFF_REQUIRED)
        if absent:
            raise MissingColumnsError("stuff", absent)
    if "location" in req.models and location_scorer is not None:
        absent = _absent(frame, LOCATION_REQUIRED)
        if absent:
            raise MissingColumnsError("location", absent)

    stuff = _stuff(frame, stuff_scorer, req.arsenal) if "stuff" in req.models else None
    location = _location(frame, location_scorer) if "location" in req.models else None
    analysis = analysis_features(frame).astype(object)
    analysis = analysis.where(analysis.notna(), None)

    stuff_info = None
    if stuff_scorer is not None and "stuff" in req.models:
        stuff_info = model_info(
            stuff_scorer.model_id,
            getattr(stuff_scorer, "provenance", None),
            bool(getattr(stuff_scorer, "has_bands", True)),
            stuff_scorer.scale.description,
            stuff_scorer.pitch_types,
            STUFF_REQUIRED + (("arsenal | pitcher_id",) if stuff_scorer.uses_arsenal else ()),
        )
    location_info = None
    if location_scorer is not None and "location" in req.models:
        location_info = model_info(
            location_scorer.model_id,
            location_scorer.provenance,
            location_scorer.has_bands,
            location_scorer.scale_description,
            location_scorer.pitch_types,
            LOCATION_REQUIRED,
        )
    return s.PitchScoresResponse(
        stuff_model=stuff_info,
        location_model=location_info,
        optional_features=[to_camel(c) for c in ANALYSIS_FEATURES],
        pitches=[
            s.PitchScoreOut(
                pitch_id=str(frame["pitch_id"].iloc[i] or f"row_{i}"),
                stuff_plus=stuff[i] if stuff is not None else None,
                location_plus=location[i] if location is not None else None,
                analysis=s.AnalysisFeatures(
                    **{str(k): v for k, v in analysis.iloc[i].to_dict().items()}
                ),
            )
            for i in range(len(frame))
        ],
    )
