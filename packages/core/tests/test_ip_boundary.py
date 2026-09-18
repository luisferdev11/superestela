"""packages/core is the IP boundary. This test is what keeps it one.

CONVENTIONS.md section 8 rule 6 and docs/04 section 5.1: core is derived from
first principles and is portable IP; models touches data licensed only for the
competition. The rule is worth nothing if nobody checks it, so we check it.
"""

import ast
import pathlib

CORE = pathlib.Path(__file__).resolve().parent.parent
FORBIDDEN_MODULES = {"models", "contracts", "api", "pandas", "mlflow", "sklearn"}


def _source_files():
    return [p for p in CORE.glob("*.py") if p.name != "__init__.py"]


def test_core_modules_exist():
    assert _source_files(), "packages/core has no modules to check"


def test_core_imports_nothing_from_the_data_layers():
    offenders = []
    for path in _source_files():
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [a.name.split(".")[0] for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [(node.module or "").split(".")[0]]
            else:
                continue
            for name in names:
                if name in FORBIDDEN_MODULES:
                    offenders.append(f"{path.name}:{node.lineno} imports {name}")
    assert not offenders, "core must stay free of the data layers: " + "; ".join(offenders)


def test_core_reads_no_files():
    # A pure layer has no file paths in it. This also catches a hardcoded
    # dataset path, which would be a competition-rules problem, not just a
    # design one.
    offenders = []
    for path in _source_files():
        source = path.read_text()
        for needle in ("open(", "read_parquet", "read_csv", "Path(", "os.path", "data/"):
            if needle in source:
                offenders.append(f"{path.name} contains {needle!r}")
    assert not offenders, "core must not touch the filesystem: " + "; ".join(offenders)
