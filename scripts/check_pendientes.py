"""Report which pendientes of docs/08 are done, by checking the repository.

A checklist nobody verifies drifts from reality within a week. This script
checks what a machine can check -- a file exists, a route exists, a workflow
exists, a test suite passes -- and says plainly which items it cannot check so
that nobody mistakes silence for completion.

    uv run python scripts/check_pendientes.py
    uv run python scripts/check_pendientes.py --json

Exit code is 0 always: this reports progress, it does not gate anything. The
gate is CI.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_APP = ROOT / "packages" / "web" / "src" / "app"

DONE = "✅"
PENDING = "⬜"
MANUAL = "✋"


@dataclass(frozen=True)
class Item:
    """One pendiente, with the check that decides whether it is done."""

    section: str
    name: str
    #  None means no machine can decide it; a human has to.
    check: Callable[[], bool] | None = None
    note: str = ""


@dataclass
class Result:
    """The verdict on one pendiente."""

    item: Item
    state: str
    detail: str = ""


def exists(*parts: str) -> Callable[[], bool]:
    """True when the path exists, relative to the repository root."""
    return lambda: (ROOT.joinpath(*parts)).exists()


def screen(route: str) -> Callable[[], bool]:
    """True when the app serves that route."""
    return lambda: (WEB_APP / route / "page.tsx").exists()


def api_route(fragment: str) -> Callable[[], bool]:
    """True when the FastAPI app declares a route containing this fragment."""

    def check() -> bool:
        source = ROOT / "packages" / "api" / "main.py"
        return source.exists() and fragment in source.read_text(encoding="utf-8")

    return check


def suite_passes(*command: str) -> Callable[[], bool]:
    """True when the command exits zero."""

    def check() -> bool:
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, check=False)
        return completed.returncode == 0

    return check


ITEMS: list[Item] = [
    # --- 3.1 Ruta critica -------------------------------------------------
    Item("Ruta critica", "A1 - modelos por componente", exists("packages", "models", "targets")),
    Item("Ruta critica", "A2 - pesos de run value", exists("packages", "models", "train.py")),
    Item("Ruta critica", "A3 - el puente a carreras", exists("packages", "models", "evaluate.py")),
    # --- 3.2 Pantallas ----------------------------------------------------
    Item("Pantallas", "P1 - Radar de Fichajes", screen("radar")),
    Item("Pantallas", "P4 - Simulador (OBLIGATORIO)", screen("simulador")),
    Item("Pantallas", "P3 - Traductor de Altitud", screen("traductor")),
    Item("Pantallas", "P2 - Ficha de Pitcher", screen("pitchers/[pitcherId]")),
    Item("Pantallas", "P5 - Plan de Desarrollo", screen("plan")),
    Item("Pantallas", "P6 - Tablero de Despliegue", screen("despliegue")),
    Item("Pantallas", "P7 - Proyeccion", screen("proyeccion")),
    Item("Pantallas", "P8 - Plantel", screen("plantel")),
    # --- 3.3 Ingenieria ---------------------------------------------------
    Item("Ingenieria", "report/build.py", exists("report", "build.py")),
    Item("Ingenieria", "report/compare.py", exists("report", "compare.py")),
    Item(
        "Ingenieria",
        "model-eval.yml",
        exists(".github", "workflows", "model-eval.yml"),
    ),
    Item("Ingenieria", "contracts.yml", exists(".github", "workflows", "contracts.yml")),
    Item("Ingenieria", "API - GET scores", api_route("/scores")),
    Item("Ingenieria", "API - POST simulate", api_route("/simulate")),
    Item("Ingenieria", "API - POST translate", api_route("/translate")),
    Item(
        "Ingenieria",
        "La web lee de la API",
        exists("packages", "web", "src", "sources", "apiSource.ts"),
    ),
    Item(
        "Ingenieria",
        "a11y.yml (o un ADR que lo descarte)",
        exists(".github", "workflows", "a11y.yml"),
    ),
    Item("Ingenieria", "pytest en verde", suite_passes("uv", "run", "pytest", "-q")),
    # --- 3.4 Entregables --------------------------------------------------
    Item("Entregables", "Documento tecnico", note="6-10 paginas, contra cifras congeladas"),
    Item("Entregables", "Ficha ejecutiva de 1 pagina", note="con recomendacion explicita"),
    Item(
        "Entregables",
        "Entregable 2 - Perfil Fisico Ideal",
        note="seccion del documento + lamina",
    ),
    Item("Entregables", "Decision Log auditable", note="25% de Aplicabilidad real"),
    Item("Entregables", "Copy de prohibicion de apuestas", note="declarado en el producto"),
    Item("Entregables", "Busqueda de marca 'SuperEstela'", note=""),
    Item("Entregables", "Hex del rojo y el teal confirmados", note="tokens.json, dos lineas"),
    Item("Entregables", "NDA de finalistas leido", note="antes de firmarlo"),
    Item("Entregables", "Quien presenta los 10 minutos", note=""),
]


def evaluate() -> list[Result]:
    """Run every check and collect the verdicts."""
    results = []
    for item in ITEMS:
        if item.check is None:
            results.append(Result(item, MANUAL, item.note))
            continue
        results.append(Result(item, DONE if item.check() else PENDING, item.note))
    return results


def render(results: list[Result]) -> str:
    """Lay the verdicts out as a checklist, grouped by section."""
    lines: list[str] = []
    checkable = [r for r in results if r.state != MANUAL]
    done = [r for r in checkable if r.state == DONE]

    lines.append("")
    lines.append(f"SuperEstela - pendientes: {len(done)}/{len(checkable)} verificables cumplidos")
    lines.append("")

    section = ""
    for result in results:
        if result.item.section != section:
            section = result.item.section
            lines.append(f"  {section}")
        detail = f"   - {result.detail}" if result.detail else ""
        lines.append(f"    {result.state} {result.item.name}{detail}")

    lines.append("")
    lines.append(f"  {MANUAL} = ningun check automatico lo decide; lo confirma una persona.")
    lines.append("  El detalle de cada pendiente esta en docs/08-PLAN-DE-ARRANQUE.md")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    """Print the checklist, or emit it as JSON."""
    parser = argparse.ArgumentParser(prog="scripts/check_pendientes.py")
    parser.add_argument("--json", action="store_true", help="emit machine-readable output")
    args = parser.parse_args(argv)

    results = evaluate()
    if args.json:
        print(
            json.dumps(
                [
                    {
                        "section": r.item.section,
                        "name": r.item.name,
                        "state": {DONE: "done", PENDING: "pending", MANUAL: "manual"}[r.state],
                        "note": r.detail,
                    }
                    for r in results
                ],
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        print(render(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
