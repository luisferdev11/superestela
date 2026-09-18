"""Command-line validator for a data delivery.

Run by `contracts.yml` in CI on every pull request that touches model code, so
that a delivery is checked before it can reach product:

    python -m contracts.validate scores.parquet --contract A \
        --expected-pitches 210000 --mlflow-run a3f9c1e

Exits non-zero when the delivery is rejected, and always writes
`contract_report.json` so the workflow can paste the verdict into the PR.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal

import pandas as pd
import pandera.errors as pa_errors

from contracts.mapping import normalize_columns
from contracts.schemas import PitcherAggregates, PitchScores

# Product rejects a delivery that does not cover essentially every tracked pitch.
MIN_COVERAGE = 0.99  # acceptance criterion, docs/07 section 1.1

ContractName = Literal["A", "B"]


@dataclass
class Check:
    """One acceptance criterion and how it went."""

    name: str
    passed: bool
    detail: str
    skipped: bool = False


@dataclass
class Report:
    """The full verdict on a delivery."""

    path: str
    contract: str
    n_rows: int
    checks: list[Check] = field(default_factory=list)

    @property
    def accepted(self) -> bool:
        """A delivery is accepted only when no check actually failed."""
        return all(c.passed or c.skipped for c in self.checks)

    @property
    def summary(self) -> str:
        """Markdown summary, pasted into the pull request by CI."""
        verdict = "ACEPTADA" if self.accepted else "RECHAZADA"
        lines = [
            f"**Entrega {verdict}** - contrato {self.contract}, {self.n_rows:,} filas",
            "",
            "| Criterio | Resultado | Detalle |",
            "|---|---|---|",
        ]
        for c in self.checks:
            mark = "omitido" if c.skipped else ("ok" if c.passed else "FALLA")
            lines.append(f"| {c.name} | {mark} | {c.detail} |")
        return "\n".join(lines)


def _check_schema(df: pd.DataFrame, contract: ContractName) -> tuple[Check, pd.DataFrame | None]:
    """Validate the frame against the pandera model for the given contract."""
    model = PitchScores if contract == "A" else PitcherAggregates
    try:
        validated = model.validate(df, lazy=True)
    except pa_errors.SchemaErrors as exc:
        failures = exc.failure_cases
        # Keep the report readable: the first few distinct failures say enough.
        top = failures[["check", "column", "failure_case"]].head(10).to_dict("records")
        detail = "; ".join(f"{r['column']}: {r['check']} (ej. {r['failure_case']})" for r in top)
        return Check("Esquema", False, detail or str(exc)[:300]), None
    return Check("Esquema", True, f"{len(df.columns)} columnas conformes"), validated


def _check_coverage(n_rows: int, expected: int | None) -> Check:
    """Confirm the delivery covers at least MIN_COVERAGE of tracked pitches."""
    if expected is None:
        return Check(
            "Cobertura",
            True,
            "sin --expected-pitches, no se pudo verificar",
            skipped=True,
        )
    ratio = n_rows / expected if expected else 0.0
    passed = ratio >= MIN_COVERAGE
    return Check("Cobertura", passed, f"{ratio:.2%} de {expected:,} esperados")


def _check_mlflow(run_id: str | None) -> Check:
    """Confirm the delivery names the MLflow run that produced it."""
    if run_id is None:
        return Check("Corrida de MLflow", False, "no se declaró corrida que la respalde")
    return Check("Corrida de MLflow", True, run_id)


def validate_delivery(
    path: Path,
    contract: ContractName = "A",
    expected_pitches: int | None = None,
    mlflow_run: str | None = None,
) -> Report:
    """Run every acceptance criterion from docs/07 section 1.1 against a delivery."""
    df = normalize_columns(pd.read_parquet(path))
    report = Report(path=str(path), contract=contract, n_rows=len(df))

    schema_check, _ = _check_schema(df, contract)
    report.checks.append(schema_check)

    if contract == "A":
        report.checks.append(_check_coverage(len(df), expected_pitches))
    report.checks.append(_check_mlflow(mlflow_run))
    return report


def main(argv: list[str] | None = None) -> int:
    """Entry point. Returns the process exit code."""
    parser = argparse.ArgumentParser(prog="contracts.validate")
    parser.add_argument("path", type=Path, help="parquet file to validate")
    parser.add_argument("--contract", choices=["A", "B"], default="A")
    parser.add_argument("--expected-pitches", type=int, default=None)
    parser.add_argument("--mlflow-run", type=str, default=None)
    parser.add_argument("--out", type=Path, default=Path("contract_report.json"))
    args = parser.parse_args(argv)

    report = validate_delivery(args.path, args.contract, args.expected_pitches, args.mlflow_run)
    payload = asdict(report) | {"accepted": report.accepted, "summary": report.summary}
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    print(report.summary)  # noqa: T201 - this is a CLI, printing is the point
    return 0 if report.accepted else 1


if __name__ == "__main__":
    sys.exit(main())
