"""Regenerate every artifact the screens read, in order, with one model.

    uv run python scripts/regenerate.py                                  # today's numbers, v0
    uv run python scripts/regenerate.py --model artifacts/<m>.joblib     # a data team's model
    uv run python scripts/regenerate.py --model artifacts/<m>.joblib --publish
    uv run python scripts/regenerate.py --cards-model artifacts/<m>.joblib --publish  # docs/15

The order matters, because each step reads what the one before wrote:

1. ``analysis/evidence.py`` -> evidence.json, simulator.json, arsenals.json and
   mockup_data.json. With ``--model``, that model scores the cards that the
   Radar, the Ficha, the Plan, the Despliegue and the Plantel show.
2. ``analysis/projection_evidence.py`` -> projections.json (reads arsenals.json),
   ``analysis/pitcher_runs.py`` -> pitcher_runs.json (RA/9 for the Ficha), and
   ``analysis/pitcher_locations.py`` -> locations.json (the Ficha's location maps).
3. ``analysis/simulator_gates.py`` -> the verdict next to the model, which the
   API reads to decide whether the Simulator and the Translator show Stuff+.
   Without ``--model`` it refits the v0 bridge; skip it with ``--no-gates``.
4. ``analysis/projected_tax_check.py`` -> how the translator's projected tax
   compares with the measured one; the screen quotes it.
5. ``python -m report.build`` -> report/tables, checked against claims.toml.

``--publish`` also writes analysis/outputs/simulator_validation.json, the
committed record the web's provenance line cites. Publish when the model or
the gates changed, not on every run (ADR 0010).

Needs data/stuff_model_df.parquet. Stops at the first step that fails.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / "analysis"


def run(step: str, command: list[str], cwd: Path) -> None:
    """Run one step, echoing it, and stop everything if it fails."""
    print(f"\n==> {step}\n    {' '.join(command)}", flush=True)
    result = subprocess.run(command, cwd=cwd, check=False)
    if result.returncode != 0:
        sys.exit(f"{step} failed (exit {result.returncode}); nothing after it ran.")


def main() -> None:
    """Parse the flags and run the steps in order."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--model", type=Path, help="a Scorer joblib; default: today's v0")
    parser.add_argument("--publish", action="store_true", help="write simulator_validation.json")
    parser.add_argument("--no-gates", action="store_true", help="skip the gates (no refit)")
    parser.add_argument(
        "--cards-model",
        type=Path,
        help="a Scorer for the cards only; the Simulator keeps --model or the bridge (docs/15)",
    )
    args = parser.parse_args()

    if not (ROOT / "data" / "stuff_model_df.parquet").exists():
        sys.exit("data/stuff_model_df.parquet is missing: the dataset is not in git (ADR 0002).")
    model = ["--model", str(args.model.resolve())] if args.model else []
    if args.model and not args.model.exists():
        sys.exit(f"{args.model} does not exist.")

    cards = model
    if args.cards_model is not None:
        if not args.cards_model.exists():
            sys.exit(f"{args.cards_model} does not exist.")
        # A model that passed the cards' tests but not the Simulator's display
        # gates scores the real pitches; the gates then judge the Simulator's
        # model against these cards (S4), as the screens will show them.
        cards = ["--model", str(args.cards_model.resolve())]

    python = [sys.executable]
    run("evidence", [*python, "evidence.py", *cards], ANALYSIS)
    run("projections", [*python, "projection_evidence.py"], ANALYSIS)
    run("runs", [*python, "pitcher_runs.py"], ANALYSIS)
    run("locations", [*python, "pitcher_locations.py"], ANALYSIS)
    if not args.no_gates:
        publish = ["--publish"] if args.publish else []
        run("gates", [*python, "simulator_gates.py", *model, *publish], ANALYSIS)
    if not args.no_gates:
        # After the gates: without --model they refit the bridge this checks.
        publish = ["--publish"] if args.publish else []
        run("tax check", [*python, "projected_tax_check.py", *model, *publish], ANALYSIS)
    run("report", [*python, "-m", "report.build"], ROOT)

    api_model = str(args.model.resolve()) if args.model else "artifacts/stuff_plus_v0_bridge.joblib"
    print("\nDone. To see it:", flush=True)
    print(f"  SUPERESTELA_MODEL={api_model} \\")
    print("    uv run uvicorn api.main:app --port 8000")
    print("  cd packages/web && pnpm build && pnpm start")
    print("Before a PR: uv run pytest; in packages/web, pnpm lint && pnpm typecheck && pnpm test.")


if __name__ == "__main__":
    main()
