"""FastAPI application serving scores and the simulator.

The simulator reads the evidence and the fitted bridge once, at the first
request. Where they live is configuration, not code: SUPERESTELA_OUTPUTS and
SUPERESTELA_MODEL, defaulting to the repository layout.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.arsenal_batch import Band, score_pitchers
from api.arsenal_file import ArsenalFileError, summarize_arsenal
from api.schemas import (
    ArsenalFileProblem,
    ArsenalFileRequest,
    ArsenalFileResponse,
    ArsenalPitchOut,
    ArsenalScoresRequest,
    ArsenalScoresResponse,
    Metric,
    PitcherScoreOut,
    Rate,
    SimulateRequest,
    SimulateResponse,
    TaxValidation,
    TranslateRequest,
    TranslateResponse,
    TranslateShapeIn,
)
from api.simulator import SimulatorService, load_service
from contracts.schemas import MIN_PITCHES_FOR_SCORE
from core.translate import PitchShape, break_scaling_factor, translate

REPO = Path(__file__).resolve().parents[2]

app = FastAPI(title="SuperEstela API", version="0.2.0")


class Health(BaseModel):
    """Liveness payload, read by docker-compose and by the deploy check."""

    status: Literal["ok"]
    version: str


@app.get("/health", response_model=Health)
def health() -> Health:
    """Report that the process is up and which build is serving."""
    return Health(status="ok", version=app.version)


@lru_cache(maxsize=1)
def simulator_service() -> SimulatorService:
    """Load the simulator's evidence and model once per process."""
    outputs = os.environ.get("SUPERESTELA_OUTPUTS", str(REPO / "analysis" / "outputs"))
    model = os.environ.get(
        "SUPERESTELA_MODEL", str(REPO / "artifacts" / "stuff_plus_v0_bridge.joblib")
    )
    return load_service(outputs, model)


@app.post("/api/v1/simulate", response_model=SimulateResponse, response_model_by_alias=True)
def simulate(
    req: SimulateRequest, service: Annotated[SimulatorService, Depends(simulator_service)]
) -> SimulateResponse:
    """Score one pitch at sea level and at Harp Helu, side by side (docs/09)."""
    return service.simulate(req)


@app.post("/api/v1/translate", response_model=TranslateResponse, response_model_by_alias=True)
def translate_shape(req: TranslateRequest) -> TranslateResponse:
    """Move a measured shape between two air densities, with its band. Pure physics."""
    shape = PitchShape(**req.shape.model_dump())
    out = translate(shape, req.origin_density_index, req.target_density_index, req.pitch_type)
    return TranslateResponse(
        shape=TranslateShapeIn(**vars(out.shape)),
        ivb_se=out.ivb_se,
        horizontal_break_se=out.horizontal_break_se,
        release_speed_se=out.release_speed_se,
        break_scaling_factor=break_scaling_factor(
            req.origin_density_index, req.target_density_index
        ),
    )


@app.post(
    "/api/v1/arsenals/summarize",
    response_model=ArsenalFileResponse,
    response_model_by_alias=True,
    responses={422: {"model": ArsenalFileProblem}},
)
def summarize_arsenal_file(req: ArsenalFileRequest) -> ArsenalFileResponse | JSONResponse:
    """Turn a tracking export into the translator's arsenal, one row per pitch type (P3)."""
    try:
        summary = summarize_arsenal(req.csv)
    except ArsenalFileError as exc:
        problem = ArsenalFileProblem(error=exc.code, columns=list(exc.columns))
        return JSONResponse(status_code=422, content=problem.model_dump(by_alias=True))
    return ArsenalFileResponse(
        pitcher_hand=summary.pitcher_hand,
        origin=summary.origin,
        is_measured_at_extreme=summary.is_measured_at_extreme,
        n_rows=summary.n_rows,
        pitches=[ArsenalPitchOut(**vars(p)) for p in summary.pitches],
        unsupported_rows=summary.unsupported_rows,
        missing_feature_rows=summary.missing_feature_rows,
        unsupported_types=list(summary.unsupported_types),
        omitted_types=list(summary.omitted_types),
    )


@lru_cache(maxsize=1)
def extreme_pitches_per_inning() -> float:
    """Pitches per inning measured at extreme altitude, to price a pitch in runs per 9."""
    outputs = os.environ.get("SUPERESTELA_OUTPUTS", str(REPO / "analysis" / "outputs"))
    with open(os.path.join(outputs, "evidence.json")) as fh:
        evidence = json.load(fh)
    return float(evidence["run_environment"]["Extreme Altitude"]["pitches_per_inning"])


def tax_validation(
    service: Annotated[SimulatorService, Depends(simulator_service)],
) -> TaxValidation | None:
    """The projected tax's check, only if it checked the very model being served.

    It is looked for beside the model first (analysis/projected_tax_check.py
    writes it there), then in the published record. A check of another model
    is not quoted: the screen would credit this model with someone else's r.
    """
    if service.scorer is None:
        return None
    model = os.environ.get(
        "SUPERESTELA_MODEL", str(REPO / "artifacts" / "stuff_plus_v0_bridge.joblib")
    )
    outputs = os.environ.get("SUPERESTELA_OUTPUTS", str(REPO / "analysis" / "outputs"))
    for path in (
        os.path.splitext(model)[0] + ".tax_check.json",
        os.path.join(outputs, "projected_tax_check.json"),
    ):
        try:
            with open(path) as fh:
                record = json.load(fh)
        except FileNotFoundError:
            continue
        if record.get("model_id") != service.scorer.model_id:
            continue
        cards = record["all_cards"]
        return TaxValidation(
            n=cards["n"],
            pearson_r=cards["pearson_r"],
            mean_projected=cards["mean_projected"],
            mean_measured=cards["mean_measured"],
        )
    return None


@app.post(
    "/api/v1/arsenals/score",
    response_model=ArsenalScoresResponse,
    response_model_by_alias=True,
    responses={422: {"model": ArsenalFileProblem}},
)
def score_arsenal_file(
    req: ArsenalScoresRequest,
    service: Annotated[SimulatorService, Depends(simulator_service)],
    pitches_per_inning: Annotated[float, Depends(extreme_pitches_per_inning)],
    validation: Annotated[TaxValidation | None, Depends(tax_validation)],
) -> ArsenalScoresResponse | JSONResponse:
    """Score every pitcher of a file at sea level and at extreme altitude (P3, many pitchers)."""
    shown = service.scorer is not None and service.reason is None
    try:
        result = score_pitchers(
            req.csv,
            service.scorer if shown else None,
            pitches_per_inning,
            req.origin_density_index,
        )
    except ArsenalFileError as exc:
        problem = ArsenalFileProblem(error=exc.code, columns=list(exc.columns))
        return JSONResponse(status_code=422, content=problem.model_dump(by_alias=True))

    def metric(band: Band | None) -> Metric | None:
        return None if band is None else Metric(value=band.value, se=band.se)

    return ArsenalScoresResponse(
        model_id=service.scorer.model_id if service.scorer else None,
        stuff_plus_shown=shown,
        stuff_plus_reason=service.reason,
        n_rows=result.n_rows,
        pitchers=[
            PitcherScoreOut(
                pitcher_id=p.pitcher_id,
                pitcher_hand="Left" if p.pitcher_hand == "Left" else "Right",
                n=p.n,
                stuff_plus_sea=metric(p.stuff_plus_sea),
                stuff_plus_hh=metric(p.stuff_plus_hh),
                altitude_delta=metric(p.delta),
                projected_tax=metric(p.projected_tax),
                whiff_per_swing=None
                if p.whiff_per_swing is None
                else Rate(value=p.whiff_per_swing[0], ci95=p.whiff_per_swing[1]),
                swings=p.swings,
            )
            for p in result.pitchers
        ],
        few_pitches=result.few_pitches,
        min_pitches=MIN_PITCHES_FOR_SCORE,
        unsupported_rows=result.unsupported_rows,
        missing_feature_rows=result.missing_feature_rows,
        has_swings=result.has_swings,
        tax_validation=validation,
    )
