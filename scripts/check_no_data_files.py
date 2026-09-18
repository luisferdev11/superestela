#!/usr/bin/env python3
"""Reject data files before they can enter git history.

The competition rules forbid redistributing the dataset. A parquet pushed to a
repository is a rule violation, not an accident, and it cannot be taken back:
rewriting history does not un-publish what a mirror already fetched. So this
runs before every commit, on every path.

Exceptions live in ALLOWED, spelled out one full path at a time. Never a glob:
a pattern is how an exception quietly grows into a hole.
"""

from __future__ import annotations

import sys
from pathlib import Path

BLOCKED_SUFFIXES = {".parquet", ".csv", ".xlsx", ".xls", ".feather", ".pkl", ".h5"}

# Documentation that happens to ship as a table. Not data: a description OF the
# data, with no rows from the dataset in it. Declared in CONVENTIONS.md 8.4.
ALLOWED: frozenset[str] = frozenset(
    {
        "docs/reference/stuff_plus_data_dictionary.csv",
    }
)


def main(argv: list[str]) -> int:
    """Return 1 and explain, if any staged path looks like data."""
    offenders = [
        path
        for path in argv
        if Path(path).suffix.lower() in BLOCKED_SUFFIXES and path not in ALLOWED
    ]
    if not offenders:
        return 0

    print("Se bloqueó el commit: estos archivos parecen datos y no entran a git.")
    for path in offenders:
        print(f"  {path}")
    print()
    print("Los datos viven en data/, que está en .gitignore. Si de verdad es")
    print("documentación y no datos, agrégalo a ALLOWED en este script con el")
    print("motivo, y decláralo en CONVENTIONS.md sección 8.4.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
