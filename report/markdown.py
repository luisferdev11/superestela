"""Markdown in the technical document's style, shared by every generated table."""

from __future__ import annotations

from collections.abc import Sequence


def number(value: float, decimals: int = 2) -> str:
    """A number in the document's style: comma thousands, true minus sign."""
    text = f"{value:,.{decimals}f}"
    return text.replace("-", "\N{MINUS SIGN}")


def signed(value: float, decimals: int = 2) -> str:
    """A difference, always with its sign."""
    return ("+" if value > 0 else "") + number(value, decimals)


def table(headers: Sequence[str], rows: Sequence[Sequence[str]], text: int = 1) -> str:
    """A Markdown table: the first ``text`` columns left-aligned, the numbers right-aligned."""
    align = [":---"] * text + ["---:"] * (len(headers) - text)
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(align) + " |"]
    lines += ["| " + " | ".join(row) + " |" for row in rows]
    return "\n".join(lines)


def page(title: str, source: str, body: str) -> str:
    """One generated file: title, provenance, and the table."""
    return (
        f"# {title}\n\n"
        f"> Generado por `report/build.py` desde `{source}`. No se edita a mano.\n\n"
        f"{body}\n"
    )
