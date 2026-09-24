"""FastAPI application serving scores and the simulator.

The simulator reads the evidence and the fitted bridge once, at the first
request. Where they live is configuration, not code: SUPERESTELA_OUTPUTS and
SUPERESTELA_MODEL, defaulting to the repository layout.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from pydantic import BaseModel

from api.schemas import (
    SimulateRequest,
    SimulateResponse,
    TranslateRequest,
    TranslateResponse,
    TranslateShapeIn,
)
from api.simulator import SimulatorService, load_service
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
