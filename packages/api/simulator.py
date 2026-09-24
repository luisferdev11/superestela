"""The simulator: one pitch, both environments, physics first and score second.

docs/09 section 4. The physics (core) always answers; the score answers only
if the current model passed its display gates and is the very model that was
gated. Otherwise Stuff+ goes out as null with a reason code the web
translates, and the rest of the screen still works.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, replace
from typing import Any, Literal, cast

import numpy as np
import numpy.typing as npt

from api import schemas as s
from core.arsenal import ArsenalPitch, Differentials, differentials, primary_fastball
from core.density import DENSITY_INDEX_EXTREME, DENSITY_INDEX_SEA_LEVEL
from core.spin import Bounds, Envelope, assess_plausibility, movement_per_krpm, percentile_rank
from core.trajectory import approach
from core.translate import PitchShape, break_scaling_factor, translate
from models.scoring import PitchInput, Scorer
from models.stuff.v0_bridge import BridgeModel

SEA, EXT = "No Altitude", "Extreme Altitude"
Reason = Literal["model_unavailable", "model_not_gated", "gates_failed"]

# Comparables: the closest real versions of the pitch, per environment. Below
# 30 pitches a pitcher's mean shape is too noisy to call his pitch "like" this.
COMPARABLE_MIN_PITCHES = 30
COMPARABLES_SHOWN = 3
COMPARABLE_AXES = ("release_speed", "ivb", "horizontal_break", "extension", "release_height")
# p5 to p95 of a normal spans 3.29 standard deviations.
P5_P95_IN_SD = 3.29


@dataclass
class SimulatorService:
    """Everything one simulation needs, loaded once."""

    scorer: Scorer | None
    reason: Reason | None
    evidence: dict[str, Any]  # simulator.json
    arsenals: dict[str, Any]  # arsenals.json

    def simulate(self, req: s.SimulateRequest) -> s.SimulateResponse:
        """Simulate one pitch at sea level and at Harp Helu."""
        p = req.pitch
        factor = break_scaling_factor(DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME)
        moved = translate(_shape(p), DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME, p.pitch_type)
        high = p.model_copy(
            update={"ivb": moved.shape.ivb, "horizontal_break": moved.shape.horizontal_break}
        )

        fastball, sea_diff, high_diff = self._differentials(req, factor)
        stuff_sea, stuff_high, delta = self._score(p, high)
        plaus = self._plausibility(p)
        per_krpm = movement_per_krpm(p.ivb, p.horizontal_break, p.spin_rate)
        percentiles = self.evidence["plausibility"][p.pitch_type]["movement_per_krpm_percentiles"]

        return s.SimulateResponse(
            model_id=self.scorer.model_id if self.scorer else None,
            uses_arsenal=bool(self.scorer and self.scorer.uses_arsenal),
            stuff_plus_shown=self.reason is None,
            stuff_plus_reason=self.reason,
            sea=self._environment(
                "sea",
                SEA,
                DENSITY_INDEX_SEA_LEVEL,
                p,
                s.Shape(
                    ivb=s.Metric(value=p.ivb, se=0.0),
                    horizontal_break=s.Metric(value=p.horizontal_break, se=0.0),
                ),
                stuff_sea,
                sea_diff,
                req.pitcher_id,
            ),
            harp_helu=self._environment(
                "harpHelu",
                EXT,
                DENSITY_INDEX_EXTREME,
                high,
                s.Shape(
                    ivb=s.Metric(value=moved.shape.ivb, se=moved.ivb_se),
                    horizontal_break=s.Metric(
                        value=moved.shape.horizontal_break, se=moved.horizontal_break_se
                    ),
                ),
                stuff_high,
                high_diff,
                req.pitcher_id,
            ),
            altitude_delta=delta,
            primary_fastball=fastball,
            plausibility=plaus,
            movement_per_krpm=s.MovementPerKrpm(
                value=per_krpm, percentile=percentile_rank(per_krpm, percentiles)
            ),
        )

    def _environment(
        self,
        name: Literal["sea", "harpHelu"],
        env: str,
        rho: float,
        pitch: s.PitchIn,
        shape: s.Shape,
        stuff: s.Metric | None,
        diff: s.Differentials | None,
        exclude: str | None,
    ) -> s.EnvironmentResult:
        loss = self.evidence["speed_loss"][pitch.pitch_type][env]["speed_drop_fraction"]
        arrival = approach(
            pitch.release_speed,
            loss * pitch.release_speed,
            pitch.ivb,
            pitch.extension,
            pitch.release_height,
        )
        return s.EnvironmentResult(
            environment=name,
            density_index=rho,
            shape=shape,
            approach=s.Approach(plate_speed=arrival.plate_speed, vaa=arrival.vaa),
            stuff_plus=stuff,
            differentials=diff,
            comparables=self._comparables(pitch, env, exclude),
        )

    def _score(
        self, sea: s.PitchIn, high: s.PitchIn
    ) -> tuple[s.Metric | None, s.Metric | None, s.AltitudeDelta | None]:
        if self.scorer is None or self.reason is not None:
            return None, None, None
        a, b = _pitch_input(sea), _pitch_input(high)
        # Column 1 is the altitude shape in sea-level air: it splits the delta
        # into what the shape loses and what the environment adds (docs/09 3.9).
        d = self.scorer.draws(
            [a, b, b], [DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME]
        )
        delta = s.AltitudeDelta(
            total=_metric(d[:, 2] - d[:, 0]),
            shape=_metric(d[:, 1] - d[:, 0]),
            environment=_metric(d[:, 2] - d[:, 1]),
        )
        return _metric(d[:, 0]), _metric(d[:, 2]), delta

    def _differentials(
        self, req: s.SimulateRequest, factor: float
    ) -> tuple[s.PitchType | None, s.Differentials | None, s.Differentials | None]:
        if not req.arsenal:
            return None, None, None
        pitches = [ArsenalPitch(**a.model_dump()) for a in req.arsenal]
        fastball = primary_fastball(pitches)
        if fastball is None:
            return None, None, None
        if fastball.pitch_type == req.pitch.pitch_type:
            return req.pitch.pitch_type, None, None  # the pitch IS the anchor
        mine = ArsenalPitch(
            pitch_type=req.pitch.pitch_type,
            usage=0.0,
            release_speed=req.pitch.release_speed,
            ivb=req.pitch.ivb,
            horizontal_break=req.pitch.horizontal_break,
            release_height=req.pitch.release_height,
            release_side=req.pitch.release_side,
        )
        at_sea = differentials(mine, fastball)
        high = differentials(
            replace(mine, ivb=mine.ivb * factor, horizontal_break=mine.horizontal_break * factor),
            replace(
                fastball,
                ivb=fastball.ivb * factor,
                horizontal_break=fastball.horizontal_break * factor,
            ),
        )
        return cast(s.PitchType, fastball.pitch_type), _diff(at_sea), _diff(high)

    def _plausibility(self, p: s.PitchIn) -> s.Plausibility:
        e = self.evidence["plausibility"][p.pitch_type]
        env = Envelope(
            e["mean"],
            e["inverse_covariance"],
            e["threshold_squared_distance"],
            {n: Bounds(b["low"], b["high"]) for n, b in e["bounds"].items()},
        )
        out = assess_plausibility(p.release_speed, p.ivb, p.horizontal_break, p.spin_rate, env)
        return s.Plausibility(
            is_plausible=out.is_plausible,
            squared_distance=out.squared_distance,
            threshold=out.threshold,
            unusual=list(out.unusual),
        )

    def _comparables(self, pitch: s.PitchIn, env: str, exclude: str | None) -> list[s.Comparable]:
        spread = self.evidence["distributions"][pitch.pitch_type][env]
        sd = np.array(
            [(spread[a]["p95"] - spread[a]["p5"]) / P5_P95_IN_SD for a in COMPARABLE_AXES]
        )
        target = np.array([getattr(pitch, a) for a in COMPARABLE_AXES])
        found = []
        for rec in self.arsenals.values():
            if rec["pitcher_id"] == exclude:
                continue
            for q in rec["by_environment"].get(env, []):
                if q["pitch_type"] != pitch.pitch_type or q["n"] < COMPARABLE_MIN_PITCHES:
                    continue
                x = np.array([q[a] for a in COMPARABLE_AXES])
                found.append((float(np.sum(((x - target) / sd) ** 2)), rec, q))
        found.sort(key=lambda t: t[0])
        return [
            s.Comparable(
                pitcher_id=rec["pitcher_id"],
                season=rec["season"],
                n=q["n"],
                ivb=q["ivb"],
                horizontal_break=q["horizontal_break"],
                release_speed=q["release_speed"],
                whiff_per_swing=q["whiff_per_swing"],
            )
            for _, rec, q in found[:COMPARABLES_SHOWN]
        ]


def _shape(p: s.PitchIn) -> PitchShape:
    return PitchShape(
        release_speed=p.release_speed,
        ivb=p.ivb,
        horizontal_break=p.horizontal_break,
        extension=p.extension,
        release_height=p.release_height,
        release_side=p.release_side,
    )


def _pitch_input(p: s.PitchIn) -> PitchInput:
    return PitchInput(**p.model_dump())


def _metric(draws: npt.NDArray[np.float64]) -> s.Metric:
    return s.Metric(value=float(draws.mean()), se=float(draws.std(ddof=1)))


def _diff(d: Differentials) -> s.Differentials:
    return s.Differentials(
        release_speed=d.release_speed,
        ivb=d.ivb,
        horizontal_break=d.horizontal_break,
        release_distance=d.release_distance,
    )


def load_service(outputs_dir: str, model_path: str) -> SimulatorService:
    """Read the evidence, the arsenals, the gate verdict and the model, once."""

    def read(name: str) -> dict[str, Any]:
        with open(os.path.join(outputs_dir, name)) as fh:
            return dict(json.load(fh))

    evidence, arsenals = read("simulator.json"), read("arsenals.json")
    if not os.path.exists(model_path):
        return SimulatorService(None, "model_unavailable", evidence, arsenals)
    model = BridgeModel.load(model_path)
    try:
        verdict = read("simulator_validation.json")
    except FileNotFoundError:
        return SimulatorService(model, "model_not_gated", evidence, arsenals)
    if verdict.get("model_id") != model.model_id:
        # The gates judged a different fit; this one has not earned display.
        return SimulatorService(model, "model_not_gated", evidence, arsenals)
    reason: Reason | None = None if verdict.get("stuff_plus_shown") else "gates_failed"
    return SimulatorService(model, reason, evidence, arsenals)
