"""FastAPI application serving scores and the simulator.

Only the health endpoint exists so far. It is here from the first commit so
that the container has something real to build and CI has something real to
check; the scoring routes land with the model.
"""

from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="SuperEstela API", version="0.1.0")


class Health(BaseModel):
    """Liveness payload, read by docker-compose and by the deploy check."""

    status: Literal["ok"]
    version: str


@app.get("/health", response_model=Health)
def health() -> Health:
    """Report that the process is up and which build is serving."""
    return Health(status="ok", version=app.version)
