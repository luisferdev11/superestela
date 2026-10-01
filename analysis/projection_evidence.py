"""The projection P7 shows: each pitcher's measured sea-level arsenal moved to
medium altitude and to Harp Helu, with the band per axis.

It applies ``core.translate.translate`` - the same function the API and the
simulator use - so the same pitch shows the same number everywhere in the app
(docs/10 T6). It needs no dataset: it reads the arsenals and writes one file.

    uv run python analysis/projection_evidence.py

In:   analysis/outputs/arsenals.json
Out:  analysis/outputs/projections.json

Medium altitude is an extrapolation of the density law, measured between sea
level and extreme altitude, and the band there reuses the error measured on
that same pair. The screen says so.
"""

import json
import os

from core.density import DENSITY_INDEX_EXTREME, DENSITY_INDEX_MEDIUM, DENSITY_INDEX_SEA_LEVEL
from core.translate import PitchShape, break_scaling_factor, translate

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "outputs")
SEA, EXT = "No Altitude", "Extreme Altitude"

TARGETS = {"medium": DENSITY_INDEX_MEDIUM, "hh": DENSITY_INDEX_EXTREME}


def _shape(p):
    return PitchShape(
        release_speed=p["release_speed"],
        ivb=p["ivb"],
        horizontal_break=p["horizontal_break"],
        extension=p["extension"],
        release_height=p["release_height"],
        release_side=p["release_side"],
    )


def project(arsenals):
    """Every sea-level pitch of every pitcher-season, moved to each target."""
    out = {}
    for key, rec in arsenals.items():
        sea = rec["by_environment"].get(SEA, [])
        if not sea:
            continue
        measured_hh = {p["pitch_type"]: p for p in rec["by_environment"].get(EXT, [])}
        pitches = []
        for p in sea:
            targets = {}
            for name, rho in TARGETS.items():
                t = translate(_shape(p), DENSITY_INDEX_SEA_LEVEL, rho, p["pitch_type"])
                targets[name] = {
                    "ivb": round(t.shape.ivb, 2),
                    "ivb_se": t.ivb_se,
                    "horizontal_break": round(t.shape.horizontal_break, 2),
                    "horizontal_break_se": t.horizontal_break_se,
                }
            hh = measured_hh.get(p["pitch_type"])
            pitches.append(
                {
                    "pitch_type": p["pitch_type"],
                    "n": p["n"],
                    "usage": p["usage"],
                    "sea": {"ivb": p["ivb"], "horizontal_break": p["horizontal_break"]},
                    "projected": targets,
                    # Only extreme altitude is measured per pitcher; medium is not.
                    "measured_hh": None
                    if hh is None
                    else {
                        "ivb": hh["ivb"],
                        "horizontal_break": hh["horizontal_break"],
                        "n": hh["n"],
                    },
                }
            )
        out[key] = {
            "pitcher_id": rec["pitcher_id"],
            "season": rec["season"],
            "pitcher_hand": rec["pitcher_hand"],
            "pitches": pitches,
        }
    return out


def main():
    with open(os.path.join(OUT, "arsenals.json")) as f:
        arsenals = json.load(f)
    payload = {
        "densities": {"sea": DENSITY_INDEX_SEA_LEVEL, **TARGETS},
        "factors": {
            name: round(break_scaling_factor(DENSITY_INDEX_SEA_LEVEL, rho), 4)
            for name, rho in TARGETS.items()
        },
        "pitchers": project(arsenals),
    }
    path = os.path.join(OUT, "projections.json")
    with open(path, "w") as f:
        # Compact: 370 pitcher-seasons indented weigh 1.1 MB for no reader's benefit.
        json.dump(payload, f, sort_keys=True, separators=(",", ":"))
        f.write("\n")
    print(f"Wrote {path}: {len(payload['pitchers'])} pitcher-seasons")


if __name__ == "__main__":
    main()
