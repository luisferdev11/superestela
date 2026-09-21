"""Write a contract fixture to a parquet file for CI to validate.

`packages/contracts/fixtures.py` generates deliveries from a fixed seed instead
of committing a parquet, because "no .parquet in git, on any path" is a rule with
no exceptions. This script is the bridge: it materialises a fixture to a path
CI hands to `contracts.validate`, which exercises exactly the path a real
delivery takes.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from contracts.fixtures import valid_pitch_scores, valid_pitcher_aggregates


def main(argv: list[str] | None = None) -> int:
    """Write the requested contract fixture and report where it landed."""
    parser = argparse.ArgumentParser(prog="scripts/materialize_fixture.py")
    parser.add_argument("out", type=Path, help="parquet file to write")
    parser.add_argument("--contract", choices=["A", "B"], default="A")
    parser.add_argument("--rows", type=int, default=500)
    args = parser.parse_args(argv)

    frame = (
        valid_pitch_scores(args.rows)
        if args.contract == "A"
        else valid_pitcher_aggregates(args.rows)
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(args.out)
    print(f"contrato {args.contract}: {len(frame)} filas en {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
