"""Build the technical document's tables from the evidence, and refuse a claim without a run.

    uv run python -m report.build            # rewrites report/tables/
    uv run python -m report.build --check    # fails if the tables are stale or a claim broke

No table or figure in the document is typed by hand (docs/05 section 4.3). Every
one is generated here from the committed artifacts in analysis/outputs/, which
analysis/evidence.py and analysis/simulator_gates.py write. The traceability
matrix ties each sentence the document asserts to the place in an artifact that
backs it; a claim whose source is missing, or whose number no longer matches,
fails the build. That is the quality control of the whole document.

The data team's tables (A1-A3, C1-C3) enter the same way when their runs are
registered: a new artifact, a new table function, new claims. Nothing else in
this file has to change.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from report.matrix import Artifacts, BrokenClaimError, Claim, load_claims, traceability_page, verify
from report.tables import TABLE_BUILDERS

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "analysis" / "outputs"
TABLES = ROOT / "report" / "tables"

SOURCES = ("evidence.json", "simulator_validation.json", "speed_rule.json")


def load_artifacts(outputs: Path = OUTPUTS) -> Artifacts:
    """Read every artifact the document may cite, keyed by file name."""
    return {name: json.loads((outputs / name).read_text(encoding="utf-8")) for name in SOURCES}


def build(artifacts: Artifacts, claims: Sequence[Claim]) -> dict[str, str]:
    """Every generated file, by name. Raises if a claim is broken."""
    files = {}
    for name, builder in TABLE_BUILDERS.items():
        try:
            files[name] = builder(artifacts)
        except KeyError as err:
            # An artifact gained a key the table does not know (an H5, an F6): say which.
            raise BrokenClaimError(
                f"{name}: the artifact has {err}, which the table does not map"
            ) from err

    files["trazabilidad.md"] = traceability_page(verify(claims, artifacts))
    return files


def main(argv: list[str] | None = None) -> int:
    """Write the tables, or with --check fail if the committed ones are stale."""
    parser = argparse.ArgumentParser(prog="python -m report.build")
    parser.add_argument("--check", action="store_true", help="fail if report/tables is stale")
    args = parser.parse_args(argv)

    try:
        files = build(load_artifacts(), load_claims())
    except BrokenClaimError as err:
        print(f"Broken claim: {err}", file=sys.stderr)
        return 1

    if args.check:
        stale = [
            name
            for name, text in files.items()
            if not (TABLES / name).exists() or (TABLES / name).read_text(encoding="utf-8") != text
        ]
        # A table renamed or dropped leaves its old file behind; that is stale too.
        stale += sorted(p.name for p in TABLES.glob("*.md") if p.name not in files)
        if stale:
            print(
                f"Stale tables: {', '.join(stale)}. Run `uv run python -m report.build`.",
                file=sys.stderr,
            )
            return 1
        print(f"report/tables is up to date ({len(files)} files).")
        return 0

    TABLES.mkdir(parents=True, exist_ok=True)
    for orphan in TABLES.glob("*.md"):
        if orphan.name not in files:
            orphan.unlink()
    for name, text in files.items():
        (TABLES / name).write_text(text, encoding="utf-8")
    print(f"Wrote {len(files)} files to {TABLES.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
