"""Draw the speed-rule finding for the report: FINAL_v1 against its distilled version. docs/15 §6.

    uv run python scripts/figure_speed_rule.py --tracking-db ../superestela-datos/mlFlow/mlflow.db

Two panels, from the same 300 real sea-level four-seams gate S1 uses:

1. Stuff+ of three of those four-seams as their speed is swept from 86 to
   99 mph, everything else fixed: FINAL_v1 (data's model, 20 boosters) dips
   where a faster pitch should never be worse; the distilled model follows
   it and never dips.
2. What +1 mph does to each of the 300: the share that loses Stuff+ is the
   gate's number (at most 10% to be shown).

Out: ``docs/figures/regla-de-velocidad.png`` and the same file in MLflow,
``superestela/A-target/final-monotone``. Only model curves and aggregates are
drawn, never a row of the dataset.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path

import joblib
import matplotlib
import mlflow
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "analysis"))
DATA = ROOT / "data" / "stuff_model_df.parquet"
OUT = ROOT / "docs" / "figures" / "regla-de-velocidad.png"
SPEEDS = np.arange(86.0, 99.01, 0.1)
TEAL, RED, INK = "#0f6e66", "#c8102e", "#1a1a1a"


def main() -> None:
    """Score the gate's four-seams with both models and draw the two panels."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--tracking-db", type=Path, required=True)
    args = parser.parse_args()
    db = args.tracking_db.resolve()

    os.chdir(ROOT / "analysis")
    import evidence as E  # noqa: N812 -- the alias analysis/ uses
    import simulator_gates as G  # noqa: N812

    from models.features.arsenal import raw_differentials
    from models.scoring import stuff_plus_of

    teacher = joblib.load(ROOT / "artifacts" / "stuff_plus_final_v1.joblib")
    student = joblib.load(ROOT / "artifacts" / "stuff_plus_final_v1_monotone.joblib")
    df = E.load()
    df = df.join(raw_differentials(df))
    df = df[df.altitude_category.notna()].dropna(
        subset=["vx0", "vy0", "vz0", "ax0", "ay0", "az0", "pitcher_anon_id", "game_anon_id"]
    )
    frame = G.canonical(E.add_physics(df))
    frame = frame[frame[["speed_diff", "ivb_diff", "hb_diff"]].notna().all(axis=1)]
    four_seams = frame[(frame.pitch_type == "Four-Seam") & (frame.environment == E.SEA)]
    base = four_seams.sample(300, random_state=G.SEED)

    lift = {}
    for name, model in (("FINAL_v1", teacher), ("monotone", student)):
        faster = base.assign(release_speed=base.release_speed + 1.0)
        lift[name] = stuff_plus_of(model, faster)[0] - stuff_plus_of(model, base)[0]

    # The three four-seams FINAL_v1 penalises most for +1 mph: where the dip shows.
    worst = base.iloc[np.argsort(lift["FINAL_v1"])[:3]]
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), gridspec_kw={"width_ratios": [1.35, 1]})
    ax = axes[0]
    for i, (_, row) in enumerate(worst.iterrows()):
        sweep = pd.DataFrame([row] * len(SPEEDS)).assign(release_speed=SPEEDS)
        t = stuff_plus_of(teacher, sweep)[0]
        s = stuff_plus_of(student, sweep)[0]
        label = i == 0
        ax.plot(
            SPEEDS, t, color=RED, lw=1.4, alpha=0.85, label="FINAL_v1 (datos)" if label else None
        )
        ax.plot(SPEEDS, s, color=TEAL, lw=2.2, label="FINAL_v1 con la regla" if label else None)
        ax.plot(
            [row.release_speed], [np.interp(row.release_speed, SPEEDS, s)], "o", color=INK, ms=4
        )
    ax.set_xlabel("Velocidad de la recta (mph); lo demás no se mueve")
    ax.set_ylabel("Stuff+")
    ax.set_title(
        "Tres rectas reales: subir velocidad nunca debería restar", fontsize=11, loc="left"
    )
    ax.legend(frameon=False, fontsize=9)
    ax.grid(alpha=0.25)

    ax = axes[1]
    bins = np.linspace(-3, 5, 33)
    share = {k: float((v < 0).mean()) for k, v in lift.items()}
    ax.hist(
        lift["FINAL_v1"],
        bins=bins,
        color=RED,
        alpha=0.55,
        label=f"FINAL_v1: {100 * share['FINAL_v1']:.1f}% bajan",
    )
    ax.hist(
        lift["monotone"],
        bins=bins,
        color=TEAL,
        alpha=0.55,
        label=f"Con la regla: {100 * share['monotone']:.1f}% bajan",
    )
    ax.axvline(0, color=INK, lw=1)
    ax.set_xlabel("Cambio de Stuff+ al sumar 1 mph (300 rectas, compuerta S1)")
    ax.set_ylabel("Rectas")
    ax.set_title("Compuerta S1: a lo más 10% pueden bajar", fontsize=11, loc="left")
    ax.legend(frameon=False, fontsize=9)
    ax.grid(alpha=0.25)
    fig.tight_layout()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=150)
    print(f"Wrote {OUT.relative_to(ROOT)}: {share}")

    os.chdir(db.parent)
    mlflow.set_tracking_uri(f"sqlite:///{db}")
    mlflow.set_experiment("superestela/A-target/final-monotone")
    with mlflow.start_run(run_name="figure-speed-rule"):
        mlflow.set_tags(
            {
                "question": "C1",
                "hypothesis": "propia: la velocidad nunca resta xRV, sin perder precision",
                "report_section": "4-modelado",
                "product_claim": "stuff-plus-significa-algo",
                "status": "candidate",
                "dataset_hash": hashlib.sha1(DATA.read_bytes()).hexdigest()[:12],
            }
        )
        mlflow.log_metrics(
            {
                "s1_violation_share_final_v1": share["FINAL_v1"],
                "s1_violation_share_monotone": share["monotone"],
                "s1_mean_lift_final_v1": float(np.mean(lift["FINAL_v1"])),
                "s1_mean_lift_monotone": float(np.mean(lift["monotone"])),
            }
        )
        mlflow.log_artifact(str(OUT))


if __name__ == "__main__":
    main()
