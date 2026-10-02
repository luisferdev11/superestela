"""A Scorer that is not the v0 bridge: what a data team's model looks like to the product.

Module level so joblib can pickle it, as it would a real model in artifacts/.
"""

from collections.abc import Sequence

import numpy as np
import numpy.typing as npt

from models.scoring import ArsenalContext, PitchInput, ScaleSpec, Score


class ToyScorer:
    """Stuff+ = 100 + (mph - 90) - 10 * (1 - density), with three draws around it."""

    model_id: str = "9.9.9+toy0000"
    uses_arsenal: bool = False
    scale = ScaleSpec(description="toy: 100 at 90 mph at sea level", mean_xrv=0.0, sd_xrv=1.0)
    pitch_types: tuple[str, ...] = (
        "Four-Seam",
        "Sinker",
        "Slider",
        "Changeup",
        "Curveball",
        "Cutter",
    )

    def draws(
        self, pitches: Sequence[PitchInput], density_indices: Sequence[float]
    ) -> npt.NDArray[np.float64]:
        centre = np.array(
            [
                100.0 + (p.release_speed - 90.0) - 10.0 * (1.0 - rho)
                for p, rho in zip(pitches, density_indices, strict=True)
            ]
        )
        return np.stack([centre - 1.0, centre, centre + 1.0])

    def score(
        self, pitch: PitchInput, arsenal: ArsenalContext | None, density_index: float
    ) -> Score:
        d = self.draws([pitch], [density_index])
        return Score(value=float(d.mean()), se=float(d.std(ddof=1)), model_id=self.model_id)
