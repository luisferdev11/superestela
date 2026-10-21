"""Pack the published models into one zip for a GitHub Release, and lock its hash. docs/16.

    uv run python scripts/package_models.py
    gh release create models-<version> artifacts/<zip> --title ... --notes ...

Zips ``artifacts/models/`` (portable folders, scripts/export_portable.py) and
writes ``models.lock.json`` at the repository root: the release tag, the file
name, its SHA-256 and the model ids inside. The lock is committed, so
``scripts/fetch_models.py`` on any machine knows exactly which bytes to accept.
"""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

from models import portable

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "artifacts" / portable.MODELS_DIR
LOCK = ROOT / "models.lock.json"


def main() -> None:
    """Zip the model folders and write the lock."""
    ids = {}
    for name in (portable.STUFF_MODEL, portable.LOCATION_MODEL):
        manifest = json.loads((MODELS / name / portable.MANIFEST).read_text())
        ids[name] = manifest["model_id"]
    version = ids[portable.STUFF_MODEL].split("+")[0]
    zip_name = f"superestela-models-{version}.zip"
    target = ROOT / "artifacts" / zip_name
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted(MODELS.rglob("*")):
            if path.is_file():
                z.write(path, path.relative_to(MODELS).as_posix())
    sha = hashlib.sha256(target.read_bytes()).hexdigest()
    lock = {
        "release": f"models-{version}",
        "file": zip_name,
        "sha256": sha,
        "models": ids,
        "note": "Installed by scripts/fetch_models.py into artifacts/models/ (docs/16).",
    }
    LOCK.write_text(json.dumps(lock, indent=2) + "\n")
    print(f"{target.relative_to(ROOT)}: {target.stat().st_size / 1e6:.1f} MB, sha256 {sha[:12]}…")


if __name__ == "__main__":
    main()
