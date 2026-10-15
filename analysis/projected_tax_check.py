"""Does the translator's projected tax agree with the tax the Radar measures?

The many-pitcher translator (14 October) shows a "projected altitude tax" for
pitchers who never pitched at altitude: the model's Stuff+ drop turned into
runs per 9 (``api.arsenal_batch``). Before the screen shows it, this checks it
where both exist: every Radar card, projected from its sea-level pitches only,
against the tax measured from its outcomes in both environments.

    uv run python analysis/projected_tax_check.py                       # the v0 bridge
    uv run python analysis/projected_tax_check.py --model artifacts/<m>.joblib
    uv run python analysis/projected_tax_check.py --publish

In:   data/stuff_model_df.parquet, analysis/outputs/{mockup_data,evidence}.json,
      the model (``--model``; default the v0 bridge in artifacts/)
Out:  ``<model>.tax_check.json`` beside the model, which the API reads for the
      model it serves; with ``--publish`` also analysis/outputs/projected_tax_check.json,
      the committed record. Like the gates' verdict (ADR 0010): the check that
      the screen quotes must be the check of the model that answered.
"""

import json
import os
import sys

import numpy as np
import pandas as pd

from api.arsenal_batch import score_pitchers
from models.scoring import load_scorer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "outputs")
DEFAULT_MODEL = os.path.join(ROOT, "artifacts", "stuff_plus_v0_bridge.joblib")


def check_path(model_path: str) -> str:
    """Where the check for a model file lives, beside it, as the gates' verdict does."""
    return os.path.splitext(model_path)[0] + ".tax_check.json"


COLUMNS = [
    "pitcher_anon_id",
    "year",
    "altitude_category",
    "AutoPitchType",
    "PitcherThrows",
    "RelSpeed",
    "InducedVertBreak",
    "HorzBreak",
    "SpinRate",
    "SpinAxis",
    "Extension",
    "RelHeight",
    "RelSide",
]


def main() -> None:
    with open(os.path.join(OUT, "mockup_data.json")) as fh:
        cards = json.load(fh)["pitchers"]
    with open(os.path.join(OUT, "evidence.json")) as fh:
        ppi = json.load(fh)["run_environment"]["Extreme Altitude"]["pitches_per_inning"]
    measured = {
        f"{c['pitcher_id']}/{c['season']}": (
            c["altitude_tax_runs_per_9"],
            c["altitude_tax_significant"],
        )
        for c in cards
    }
    df = pd.read_parquet(os.path.join(ROOT, "data", "stuff_model_df.parquet"), columns=COLUMNS)
    sea = df[df.altitude_category == "No Altitude"]
    sea = sea.assign(pitcher_anon_id=sea.pitcher_anon_id + "/" + sea.year.astype(str))
    sea = sea[sea.pitcher_anon_id.isin(measured)]

    model = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else DEFAULT_MODEL
    scorer = load_scorer(model)
    result = score_pitchers(sea.to_csv(index=False), scorer, ppi)
    rows = [
        (p.projected_tax.value, *measured[p.pitcher_id])
        for p in result.pitchers
        if p.projected_tax is not None
    ]
    projected = np.array([r[0] for r in rows])
    observed = np.array([r[1] for r in rows])
    significant = np.array([r[2] for r in rows])

    def summary(mask: np.ndarray) -> dict:
        x, y = projected[mask], observed[mask]
        return {
            "n": int(mask.sum()),
            "pearson_r": round(float(np.corrcoef(x, y)[0, 1]), 3),
            "spearman_r": round(float(pd.Series(x).corr(pd.Series(y), method="spearman")), 3),
            "mean_projected": round(float(x.mean()), 2),
            "mean_measured": round(float(y.mean()), 2),
        }

    record = {
        "model_id": scorer.model_id,
        "pitches_per_inning": ppi,
        "all_cards": summary(np.ones(len(rows), dtype=bool)),
        "significant_cards": summary(significant),
        "note": "Projected from sea-level pitches only, against the tax measured in both environments.",
    }
    targets = [check_path(model)]
    if "--publish" in sys.argv:
        targets.append(os.path.join(OUT, "projected_tax_check.json"))
    for path in targets:
        with open(path, "w") as fh:
            json.dump(record, fh, indent=2)
            fh.write("\n")
        print(f"Wrote {path}")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
