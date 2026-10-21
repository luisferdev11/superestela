"""Save the final models as a folder anyone can load: XGBoost JSON plus a manifest. docs/16.

A ``.joblib`` is a Python pickle: it ties the file to the classes, the library
versions and, through XGBoost's binary buffers, the machine that wrote it. A
teammate on Windows got ``XGBoostError: input stream corrupted`` from one. This
format has no pickle in it:

    <name>/manifest.json          what the model is: class, id, scale, run values,
                                   clip quantiles, hand-neutral weights, provenance
    <name>/boosters/<type>_<k>.json   every booster, in XGBoost's own JSON format

so it loads the same on any operating system and any XGBoost that reads JSON,
and anyone can open the manifest and read what the model is.
"""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb

from models.location.final import FinalLocationScorer
from models.runs import DataRun
from models.scoring import ScaleSpec
from models.stuff.final import FinalStuffScorer
from models.stuff.monotone import MonotoneStuffScorer

MANIFEST = "manifest.json"
# Where `scripts/fetch_models.py` installs the published models, under artifacts/.
MODELS_DIR = "models"
STUFF_MODEL = "stuff_plus_final_v1_monotone"
LOCATION_MODEL = "location_plus_l3"
BRIDGE_MODEL = "stuff_plus_v0_bridge.joblib"


def published(artifacts: Path, name: str) -> Path | None:
    """The published model ``name`` in ``artifacts``: its portable folder, else its pickle."""
    for path in (artifacts / MODELS_DIR / name, artifacts / f"{name}.joblib"):
        if path.exists():
            return path
    return None


FORMAT_VERSION = 1
KINDS: dict[str, type] = {
    "stuff_final": FinalStuffScorer,
    "stuff_monotone": MonotoneStuffScorer,
    "location_final": FinalLocationScorer,
}


def is_portable(path: str | os.PathLike[str]) -> bool:
    """Whether a path is a model folder in this format."""
    return (Path(path) / MANIFEST).is_file()


def _kind_of(model: object) -> str:
    # MonotoneStuffScorer subclasses FinalStuffScorer: check the subclass first.
    for kind in ("stuff_monotone", "stuff_final", "location_final"):
        if type(model) is KINDS[kind]:
            return kind
    raise TypeError(f"no portable format for {type(model).__name__}")


def _run_meta(run: DataRun, folder: Path) -> dict[str, Any]:
    (folder / "boosters").mkdir(parents=True, exist_ok=True)
    files: dict[str, list[str]] = {}
    for pitch_type, boosters in run.boosters.items():
        for k, booster in enumerate(boosters):
            name = f"boosters/{pitch_type}_{k}.json"
            booster.save_model(str(folder / name))
            files.setdefault(pitch_type, []).append(name)
    return {
        "name": run.name,
        "features": list(run.features),
        "classes": list(run.classes),
        "rv_neutral": list(run.rv_neutral),
        "has_folds": run.has_folds,
        "boosters": files,
    }


def save(model: FinalStuffScorer | FinalLocationScorer, folder: str | os.PathLike[str]) -> None:
    """Write a final model as a portable folder (overwrites the manifest and boosters)."""
    root = Path(folder)
    root.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = {
        "format": FORMAT_VERSION,
        "kind": _kind_of(model),
        "model_id": model.model_id,
        "pitch_types": list(model.pitch_types),
        "provenance": dict(model.provenance),
        "run": _run_meta(model.run, root),
    }
    if isinstance(model, FinalStuffScorer):
        manifest["scale"] = {
            "description": model.scale.description,
            "mean_xrv": model.scale.mean_xrv,
            "sd_xrv": model.scale.sd_xrv,
            "kind": model.scale.kind,
            "by_type": {t: list(v) for t, v in (model.scale.by_type or {}).items()},
        }
        manifest["p_same"] = dict(model.p_same)
        manifest["clip"] = {t: {c: list(v) for c, v in cs.items()} for t, cs in model.clip.items()}
    else:
        manifest["rv_by_count"] = np.asarray(model.rv_by_count).tolist()
        manifest["scale"] = {t: list(v) for t, v in model.scale.items()}
        manifest["scale_description"] = model.scale_description
    (root / MANIFEST).write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")


def _read_run(meta: Mapping[str, Any], root: Path) -> DataRun:
    boosters: dict[str, tuple[xgb.Booster, ...]] = {}
    for pitch_type, names in meta["boosters"].items():
        loaded = []
        for name in names:
            booster = xgb.Booster()
            booster.load_model(str(root / name))
            loaded.append(booster)
        boosters[pitch_type] = tuple(loaded)
    return DataRun(
        name=str(meta["name"]),
        features=tuple(meta["features"]),
        classes=tuple(meta["classes"]),
        boosters=boosters,
        rv_neutral=tuple(float(v) for v in meta["rv_neutral"]),
        has_folds=bool(meta["has_folds"]),
    )


def load(folder: str | os.PathLike[str]) -> FinalStuffScorer | FinalLocationScorer:
    """Read a portable model folder back into the class that wrote it.

    Raises:
        ValueError: If the folder is not this format, or a newer version of it.
    """
    root = Path(folder)
    if not is_portable(root):
        raise ValueError(f"{root} has no {MANIFEST}: not a portable model folder")
    m = json.loads((root / MANIFEST).read_text())
    if int(m["format"]) > FORMAT_VERSION:
        raise ValueError(f"{root}: format {m['format']} is newer than this code reads")
    run = _read_run(m["run"], root)
    provenance = m.get("provenance", {})
    if m["kind"] in ("stuff_final", "stuff_monotone"):
        s = m["scale"]
        scale = ScaleSpec(
            description=s["description"],
            mean_xrv=float(s["mean_xrv"]),
            sd_xrv=float(s["sd_xrv"]),
            kind=s["kind"],
            by_type={t: (float(v[0]), float(v[1])) for t, v in s["by_type"].items()} or None,
        )
        cls = MonotoneStuffScorer if m["kind"] == "stuff_monotone" else FinalStuffScorer
        return cls(
            model_id=m["model_id"],
            scale=scale,
            pitch_types=tuple(m["pitch_types"]),
            run=run,
            p_same={t: float(v) for t, v in m["p_same"].items()},
            clip={
                t: {c: (float(v[0]), float(v[1])) for c, v in cs.items()}
                for t, cs in m["clip"].items()
            },
            provenance=provenance,
        )
    if m["kind"] == "location_final":
        return FinalLocationScorer(
            model_id=m["model_id"],
            pitch_types=tuple(m["pitch_types"]),
            run=run,
            rv_by_count=np.asarray(m["rv_by_count"], dtype=float),
            scale={t: (float(v[0]), float(v[1])) for t, v in m["scale"].items()},
            scale_description=m["scale_description"],
            provenance=provenance,
        )
    raise ValueError(f"{root}: unknown model kind {m['kind']!r}")
