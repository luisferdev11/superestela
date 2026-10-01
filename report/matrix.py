"""The traceability matrix: every claim of the document, and the run behind it.

``report/claims.toml`` lists what the document asserts and where each number
lives. A claim whose source is gone, or whose number no longer matches at the
digits the document quotes, raises ``BrokenClaimError`` and fails the build
(docs/05 section 4.3). A claim with no run yet says what it awaits, and the
matrix marks it as one the document may not make.
"""

from __future__ import annotations

import re
import tomllib
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

from report.markdown import page, table

CLAIMS = Path(__file__).resolve().parent / "claims.toml"

Artifacts = dict[str, Any]


class BrokenClaimError(RuntimeError):
    """A claim of the document has no run behind it, or the run disagrees."""


def resolve(document: object, path: Sequence[str]) -> object:
    """Follow a path into a JSON document.

    A step is a key, or ``"key=value"`` to pick the element of a list whose
    ``key`` equals ``value`` (the gates are a list keyed by ``id``).

    Raises:
        KeyError: If a step does not exist, naming the step.
    """
    node = document
    for step in path:
        if isinstance(node, list) and "=" in step:
            key, value = step.split("=", 1)
            found = [i for i in node if isinstance(i, dict) and key in i and str(i[key]) == value]
            if len(found) != 1:
                # None or several: either way the step does not name one element.
                raise KeyError(step)
            node = found[0]
        elif isinstance(node, dict) and step in node:
            node = node[step]
        else:
            raise KeyError(step)
    return node


@dataclass(frozen=True)
class Claim:
    """One sentence the document asserts, and where its number lives."""

    id: str
    text: str
    section: str
    source: str | None = None
    path: tuple[str, ...] = ()
    value: object = None
    awaits: str | None = None

    @property
    def is_pending(self) -> bool:
        """True when the claim declares the run it is waiting for instead of a source."""
        return self.awaits is not None


def load_claims(path: Path = CLAIMS) -> list[Claim]:
    """Read the claims file; every claim has a source and a path, or says what it awaits."""
    raw = tomllib.loads(path.read_text(encoding="utf-8"))
    claims: list[Claim] = []
    seen: set[str] = set()
    for entry in raw["claim"]:
        if entry["id"] in seen:
            raise BrokenClaimError(f"{entry['id']}: two claims with the same id")
        seen.add(entry["id"])
        value = entry.get("value")
        if isinstance(value, int | float) and not isinstance(value, bool):
            # TOML drops trailing zeros (0.50 -> 0.5): only a string keeps the digits quoted.
            raise BrokenClaimError(f'{entry["id"]}: quote a number as a string, e.g. "56"')
        claim = Claim(
            id=entry["id"],
            text=entry["text"],
            section=entry["section"],
            source=entry.get("source"),
            path=tuple(entry.get("path", ())),
            value=entry.get("value"),
            awaits=entry.get("awaits"),
        )
        if claim.is_pending == (claim.source is not None):
            raise BrokenClaimError(f"{claim.id}: give either a source and a path, or `awaits`")
        claims.append(claim)
    return claims


NUMBER = re.compile(r"[+-]?\d+(\.\d+)?")


def matches(expected: object, actual: object) -> bool:
    """Whether the artifact still says what the document says, to the digits it quotes.

    A number is quoted as a string ("0.754"), and the artifact's value is rounded
    half up to that many decimals: 0.7543 says "0.754", 56.06 says "56". A bool
    only matches a bool, since in Python True == 1.
    """
    if isinstance(expected, bool) or isinstance(actual, bool):
        return type(expected) is type(actual) and expected == actual
    if isinstance(expected, str) and NUMBER.fullmatch(expected) and isinstance(actual, int | float):
        quoted = Decimal(expected)
        places = Decimal(1).scaleb(quoted.as_tuple().exponent)  # type: ignore[arg-type]
        return Decimal(str(actual)).quantize(places, rounding=ROUND_HALF_UP) == quoted
    return bool(expected == actual)


def shown_value(actual: object) -> str:
    """The artifact's value as the matrix prints it: Spanish words, true minus sign."""
    if isinstance(actual, bool):
        return "sí" if actual else "no"
    return str(actual).replace("-", "\N{MINUS SIGN}")


def quotes(text: str, value: str) -> bool:
    """Whether the claim's own sentence carries the number it is checked on."""
    plain = text.replace("\N{MINUS SIGN}", "-").replace(",", "")
    return value.lstrip("+-") in plain


def verify(claims: Sequence[Claim], artifacts: Artifacts) -> list[tuple[Claim, str, str]]:
    """Check every claim against its artifact.

    Returns:
        ``(claim, state, shown)`` per claim: state ``"ok"`` or ``"pending"``.

    Raises:
        BrokenClaimError: On the first claim whose source is gone or disagrees.
    """
    out = []
    for claim in claims:
        if claim.is_pending:
            out.append((claim, "pending", f"espera {claim.awaits}"))
            continue
        assert claim.source is not None
        if claim.source not in artifacts:
            raise BrokenClaimError(f"{claim.id}: unknown source {claim.source}")
        try:
            actual = resolve(artifacts[claim.source], claim.path)
        except KeyError as err:
            raise BrokenClaimError(
                f"{claim.id}: {claim.source} has no {' → '.join(claim.path)} (missing {err})"
            ) from err
        quoted = isinstance(claim.value, str) and NUMBER.fullmatch(claim.value)
        if quoted and isinstance(claim.value, str) and not quotes(claim.text, claim.value):
            raise BrokenClaimError(f"{claim.id}: the text does not quote {claim.value}")
        if claim.value is not None and not matches(claim.value, actual):
            raise BrokenClaimError(
                f"{claim.id}: the document says {claim.value}, {claim.source} says {actual!r}"
            )
        out.append((claim, "ok", shown_value(actual)))
    return out


def traceability_page(checked: Sequence[tuple[Claim, str, str]]) -> str:
    """The matrix: what the document says, where it comes from, and whether it holds."""
    rows = []
    for claim, state, shown in checked:
        where = (
            f"`{claim.source}` → `{' → '.join(claim.path)}`"
            if claim.source
            else "sin corrida todavía"
        )
        mark = "✅" if state == "ok" else "🔴 no va en el documento"
        rows.append([claim.text, claim.section, where, shown, mark])
    ok = sum(1 for _, s, _ in checked if s == "ok")
    head = (
        f"{ok} de {len(checked)} afirmaciones tienen corrida. Las marcadas en rojo no se pueden "
        "escribir en el documento hasta que exista la corrida que esperan."
    )
    body = table(["Afirmación", "§", "De dónde sale", "Valor", "Estado"], rows, text=5)
    return page("Matriz de trazabilidad", "report/claims.toml", f"{head}\n\n{body}")
