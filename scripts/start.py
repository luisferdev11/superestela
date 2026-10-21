"""Run SuperEstela on this machine: the API and the web, with one command. docs/16.

    uv run python scripts/start.py           # development server, reloads on edits
    uv run python scripts/start.py --prod    # the build the demo uses (faster, no dev badge)

Checks what is missing and says how to get it (the models, the web's
packages), starts the API on :8000 and the web on :3000, opens the browser,
and stops both with Ctrl+C. The same on Windows, macOS and Linux.

No dataset needed: every screen reads analysis/outputs/, which is in git. The
models are not (licensed data): ``scripts/fetch_models.py`` installs them.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "packages" / "web"
API_PORT, WEB_PORT = 8000, 3000
WINDOWS = os.name == "nt"


def run(command: list[str], cwd: Path) -> subprocess.Popen[bytes]:
    """Start a child process; on Windows through the shell, so pnpm.cmd resolves."""
    if WINDOWS:
        return subprocess.Popen(subprocess.list2cmdline(command), cwd=cwd, shell=True)
    return subprocess.Popen(command, cwd=cwd)


def models_ready() -> bool:
    """Whether the published models are installed, and say what to do if not."""
    lock = json.loads((ROOT / "models.lock.json").read_text())
    missing = [n for n in lock["models"] if not (ROOT / "artifacts" / "models" / n).is_dir()]
    if missing:
        print(
            "⚠  Faltan los modelos publicados: la app correrá con el puente v0 y lo dirá.\n"
            "   Para instalarlos: uv run python scripts/fetch_models.py\n"
        )
    return not missing


def wait_for(url: str, seconds: int) -> bool:
    """Poll a URL until it answers or time runs out."""
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except OSError:
            time.sleep(1)
    return False


def main() -> None:
    """Check, start the API and the web, open the browser, stop both on Ctrl+C."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--prod", action="store_true", help="build and serve the production web")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    pnpm = shutil.which("pnpm")
    if pnpm is None:
        sys.exit("Falta pnpm (Node 22 + pnpm 10): https://pnpm.io/installation")
    models_ready()
    if not (WEB / "node_modules").is_dir():
        print("Instalando los paquetes de la web (una sola vez)…")
        if run([pnpm, "install", "--frozen-lockfile"], WEB).wait() != 0:
            sys.exit("pnpm install falló")
    if args.prod:
        print("Construyendo la web (un minuto)…")
        if run([pnpm, "build"], WEB).wait() != 0:
            sys.exit("pnpm build falló")

    api = run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "api.main:app",
            "--app-dir",
            "packages",
            "--port",
            str(API_PORT),
        ],
        ROOT,
    )
    web = run([pnpm, "start" if args.prod else "dev", "--port", str(WEB_PORT)], WEB)
    try:
        if not wait_for(f"http://localhost:{API_PORT}/health", 60):
            print("⚠  La API no respondió en :8000 (¿el puerto está ocupado?)")
        if wait_for(f"http://localhost:{WEB_PORT}/radar", 120):
            print(f"\nSuperEstela corriendo en http://localhost:{WEB_PORT}  (Ctrl+C para salir)\n")
            if not args.no_browser:
                webbrowser.open(f"http://localhost:{WEB_PORT}")
        web.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for child in (web, api):
            if child.poll() is None:
                child.terminate()


if __name__ == "__main__":
    main()
