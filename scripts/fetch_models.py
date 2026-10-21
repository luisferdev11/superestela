"""Install the published models on this machine, verified byte for byte. docs/16.

    uv run python scripts/fetch_models.py              # downloads the release with `gh`
    uv run python scripts/fetch_models.py --zip <file> # or installs a zip you downloaded

The models are fitted on licensed data, so they are not in git: they travel as
one zip attached to a GitHub Release of this private repository. Its SHA-256 is
in ``models.lock.json``, committed: a zip that does not match is refused before
anything is installed, so a file damaged on the way (a chat app, a partial
download) says so instead of failing later inside XGBoost.

Works the same on Windows, macOS and Linux: no shell commands besides ``gh``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "models.lock.json"
TARGET = ROOT / "artifacts" / "models"
REPO = "luisferdev11/superestela"


def sha256(path: Path) -> str:
    """The file's SHA-256, read in chunks."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(lock: dict[str, str], folder: Path) -> Path:
    """Download the locked zip from the release with the GitHub CLI."""
    if shutil.which("gh") is None:
        sys.exit(
            "Falta la CLI de GitHub (`gh`). Instálala y entra con `gh auth login`, o descarga "
            f"{lock['file']} de https://github.com/{REPO}/releases/tag/{lock['release']} y corre:\n"
            f"  uv run python scripts/fetch_models.py --zip <ruta al zip>"
        )
    command = [
        "gh",
        "release",
        "download",
        lock["release"],
        "--repo",
        REPO,
        "--pattern",
        lock["file"],
    ]
    result = subprocess.run([*command, "--dir", str(folder)], check=False)
    if result.returncode != 0:
        sys.exit(
            "No se pudo descargar el release. ¿Entraste con `gh auth login` a tu cuenta del equipo?"
        )
    return folder / lock["file"]


def install(zip_path: Path, lock: dict[str, str]) -> None:
    """Check the zip against the lock, then replace artifacts/models/ with its contents."""
    got = sha256(zip_path)
    if got != lock["sha256"]:
        sys.exit(
            f"{zip_path.name} no coincide con models.lock.json (sha256 {got[:12]}…, se esperaba "
            f"{lock['sha256'][:12]}…): el archivo se dañó o es otra versión. Descárgalo de nuevo "
            "del release, no por un chat."
        )
    staging = TARGET.with_name("models.installing")
    shutil.rmtree(staging, ignore_errors=True)
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(staging)
    shutil.rmtree(TARGET, ignore_errors=True)
    staging.rename(TARGET)


def check() -> None:
    """Load every installed model once, so a problem shows here and not in the app."""
    sys.path.insert(0, str(ROOT / "packages"))
    from models import portable

    lock = json.loads(LOCK.read_text())
    for name, model_id in lock["models"].items():
        model = portable.load(TARGET / name)
        if model.model_id != model_id:
            sys.exit(f"{name}: se instaló {model.model_id}, el lock dice {model_id}")
        print(f"  ✓ {name} {model_id}")


def main() -> None:
    """Install the models named in models.lock.json and prove they load."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--zip", type=Path, help="a zip you already downloaded")
    args = parser.parse_args()
    lock = json.loads(LOCK.read_text())
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = args.zip if args.zip else download(lock, Path(tmp))
        install(zip_path, lock)
    print(f"Modelos instalados en {TARGET.relative_to(ROOT)}:")
    check()
    print("Listo. Arranca la app con: uv run python scripts/start.py")


if __name__ == "__main__":
    main()
