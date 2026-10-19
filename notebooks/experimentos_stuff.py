"""
EXPERIMENTOS STUFF+ — rejilla de versiones + registro en MLflow
================================================================
Uso en el notebook (después de la sección 8 y de la política de outliers, ANTES o DESPUÉS de entrenar;
no depende de lo ya entrenado, solo de las columnas del dataframe `df`):

    import importlib, experimentos_stuff as ex
    importlib.reload(ex)
    df = ex.prepare_extra_features(df)                  # features nuevas (VAA, movimiento/rpm, diffs por entorno)
    summary = ex.run_grid(df, ex.GRID_TARGETS, screen=True, dataset_path=DATA_PATH)
    ex.compare_runs()                                    # tabla ordenada de todas las corridas

Interfaz MLflow:   mlflow ui --backend-store-uri sqlite:///mlflow.db

QUÉ CAMBIA ENTRE VERSIONES (los tres ejes)
  target : qué se predice (clases) y sobre qué filas      -> SCHEMES
  rv     : cuánto vale cada clase en carreras             -> RV_KINDS (+ rv_mult para premiar whiff/chase/contacto débil)
  features / params : con qué se predice / cómo aprende   -> FEATURE_SETS / PARAM_SETS

COMPARABILIDAD (importante)
  * El log-loss SOLO es comparable entre corridas con el MISMO target (mismas clases).
  * Entre targets distintos comparar con las métricas de lanzador:
      auc_whiff, calib_slope*, splithalf_r_mean, next_whiff_r_stuff, next_rv_r_stuff,
      s6_r_dstuff_dwhiff, xrv_vs_observed_r, xrv_next_season_rv_r.

QUÉ SE GUARDA PARA VER EL APRENDIZAJE (carpeta runs/<nombre>/ y artifacts de MLflow)
  curves.csv, fold_summary.csv, importance_gain.csv, (shap_mean_abs.csv), per_type_report.csv,
  calibration_classes.csv, deciles.csv, pitcher_table.csv, config.json, metrics.json,
  figuras PNG (curvas de aprendizaje, importancia, deciles) y opcionalmente oof.parquet.
  En MLflow: una corrida padre por experimento y una hija por tipo de pitcheo con las curvas por fold
  (train_mlogloss_f{k}, val_mlogloss_f{k}) en pasos de árbol.
"""
from __future__ import annotations

import hashlib
import itertools
import json
import os
import time
import warnings
from copy import deepcopy

import numpy as np
import pandas as pd
import xgboost as xgb

os.environ.setdefault("GIT_PYTHON_REFRESH", "quiet")   # mlflow: sin aviso de git

warnings.filterwarnings("ignore", category=FutureWarning)

try:
    import mlflow
    from mlflow.entities import Metric, Param
    from mlflow.tracking import MlflowClient
    HAS_MLFLOW = True
except Exception:  # pragma: no cover
    HAS_MLFLOW = False

# ----------------------------------------------------------------------------- constantes (como el notebook)
GROUP_COL = "pitcher_anon_id"
GAME_COL = "game_anon_id"
PT = "AutoPitchType"
ALT = "altitude_category"
YEAR = "year"
ALT_ORD = {"No Altitude": 0, "Medium Altitude": 1, "Extreme Altitude": 2}
FASTBALL_FAMILY = ["Four-Seam", "Sinker", "TwoSeamFastBall", "OneSeamFastBall"]
STUFF_CORE = ["RelSpeed", "InducedVertBreak", "HorzBreak_m"]
LOC_CONTROLS = ["PlateLocHeight", "PlateLocSide", "Balls", "Strikes"]
WEAK_EV = 71.0                       # mph: contacto débil (igual que is_weak_contact del notebook)
EXCLUDE_PITCH_TYPES = ["Other", "Knuckleball", "Undefined", "Splitter", "Sweeper",
                       "OneSeamFastBall", "TwoSeamFastBall"]   # Splitter: su log-loss fue peor que la base
MIN_ROWS_PER_TYPE = 3000


# ============================================================================= 1. TARGETS (clases)
_BASE_MAP = {"StrikeSwinging": "Whiff", "FoulBall": "Foul", "Out": "Out", "Single": "Single",
             "Double": "XBH", "Triple": "XBH", "HomeRun": "HomeRun",
             "BallCalled": "Ball", "Walk": "Ball", "HitByPitch": "Ball", "StrikeCalled": "StrikeCalled"}
TAKE_CLASSES = {"Ball", "StrikeCalled"}
WHIFF_CLASSES = {"Whiff", "Whiff_IZ", "Whiff_OZ"}

SCHEMES = {
    # domain = filas con las que se entrena: solo swings ("swing") o todos los pitcheos ("all")
    "swing6":    dict(domain="swing", classes=["Whiff", "Foul", "Out", "Single", "XBH", "HomeRun"],
                      desc="Actual del notebook: P(resultado | swing)"),
    "swing_cq":  dict(domain="swing", classes=["Whiff", "Foul", "Weak", "Out", "Single", "XBH", "HomeRun"],
                      desc="Como swing6 + clase 'Weak' (contacto con ExitSpeed < 71 mph, sea out o hit)"),
    "whiff_bin": dict(domain="swing", classes=["Whiff", "Contact"],
                      desc="Binario: whiff vs contacto, dado swing"),
    "all8":      dict(domain="all", classes=["Ball", "StrikeCalled", "Whiff", "Foul", "Out", "Single", "XBH", "HomeRun"],
                      desc="Todos los pitcheos (incluye Ball/StrikeCalled), solo features físicas"),
    "all_cq":    dict(domain="all", classes=["Ball", "StrikeCalled", "Whiff", "Foul", "Weak", "Out", "Single", "XBH", "HomeRun"],
                      desc="Todos los pitcheos + clase Weak, solo features físicas (sin ubicación)"),
    "all_zone":  dict(domain="all", classes=["Ball", "StrikeCalled", "Whiff_IZ", "Whiff_OZ", "Foul", "Out",
                                              "Single", "XBH", "HomeRun"],
                      desc="Todos los pitcheos y el whiff partido en dentro/fuera de zona (captura chase)"),
}


def build_labels(d: pd.DataFrame, scheme: str) -> pd.Series:
    cls = SCHEMES[scheme]["classes"]
    base = d["event_type"].map(_BASE_MAP).astype(object)
    if scheme in ("swing6", "all8"):
        lab = base
    elif scheme in ("swing_cq", "all_cq"):
        es = pd.to_numeric(d["ExitSpeed"], errors="coerce")
        bip = base.isin(["Out", "Single", "XBH", "HomeRun"])
        lab = base.where(~(bip & (es < WEAK_EV)), "Weak")
    elif scheme == "whiff_bin":
        lab = pd.Series(np.where(base == "Whiff", "Whiff",
                                 np.where(base.isin(["Foul", "Out", "Single", "XBH", "HomeRun"]), "Contact", None)),
                        index=d.index, dtype=object)
    elif scheme == "all_zone":
        iz = pd.to_numeric(d["in_strike_zone"], errors="coerce").fillna(0).to_numpy() == 1
        lab = pd.Series(np.where(base == "Whiff", np.where(iz, "Whiff_IZ", "Whiff_OZ"), base),
                        index=d.index, dtype=object)
    else:
        raise ValueError(f"target desconocido: {scheme}")
    return lab.where(lab.isin(cls))


def swing_class_mask(classes):
    return np.array([c not in TAKE_CLASSES for c in classes], dtype=float)


# ============================================================================= 2. RUN VALUE (qué vale cada clase)
RV_KINDS = {
    "neutral":    "Promedio de delta_run_exp por clase (sin importar conteo ni entorno). Es el actual.",
    "by_count":   "Promedio por clase y conteo (balls, strikes).",
    "by_env":     "Promedio por clase y categoría de altitud (A2: el valor de un hit cambia en altura).",
    "whiff_only": "Valor -1 si es whiff, 0 en lo demás: Stuff+ = whiff+ (lo que mira Diablos).",
}


class RV:
    """Valor en carreras de cada clase. matrix() devuelve (n, K) por fila."""

    def __init__(self, kind, classes, d_fit, labels, mult=None):
        self.kind, self.classes = kind, list(classes)
        K = len(classes)
        m = labels.notna() & d_fit["has_rv"].astype(bool)
        sub = d_fit.loc[m, ["delta_run_exp", "Balls", "Strikes", ALT]].assign(c=labels[m])
        neutral = sub.groupby("c")["delta_run_exp"].mean().reindex(classes).fillna(0.0).to_numpy()
        self.neutral = neutral
        self.arr = np.tile(neutral[:, None, None], (1, 4, 3))
        for (c, b, s), v in sub.groupby(["c", "Balls", "Strikes"])["delta_run_exp"].mean().items():
            if 0 <= b <= 3 and 0 <= s <= 2:
                self.arr[classes.index(c), int(b), int(s)] = v
        self.env = {a: g.groupby("c")["delta_run_exp"].mean().reindex(classes).fillna(0.0).to_numpy()
                    for a, g in sub.groupby(ALT)}
        self.whiff_vec = np.array([-1.0 if c in WHIFF_CLASSES else 0.0 for c in classes])
        self.mult = np.array([(mult or {}).get(c, 1.0) for c in classes])
        if kind not in RV_KINDS:
            raise ValueError(f"rv desconocido: {kind}")

    def table(self):
        return pd.Series(self.neutral * self.mult, index=self.classes, name=f"rv_{self.kind}")

    def matrix(self, balls, strikes, alt):
        n = len(balls)
        if self.kind == "neutral":
            M = np.tile(self.neutral, (n, 1))
        elif self.kind == "whiff_only":
            M = np.tile(self.whiff_vec, (n, 1))
        elif self.kind == "by_count":
            b = pd.to_numeric(pd.Series(np.asarray(balls)), errors="coerce")
            s = pd.to_numeric(pd.Series(np.asarray(strikes)), errors="coerce")
            bad = (b.isna() | s.isna() | (b < 0) | (b > 3) | (s < 0) | (s > 2)).to_numpy()
            bi = b.fillna(0).clip(0, 3).astype(int).to_numpy()
            si = s.fillna(0).clip(0, 2).astype(int).to_numpy()
            M = self.arr[:, bi, si].T.copy()
            M[bad] = self.neutral
        else:  # by_env
            M = np.tile(self.neutral, (n, 1))
            a = np.asarray(alt, dtype=object)
            for k, vec in self.env.items():
                M[a == k] = vec
        return M * self.mult


# ============================================================================= 3. FEATURES
def _fb_diffs(df, key, suffix):
    g = (df.groupby(key + [PT]).agg(n=("RelSpeed", "size"), v=("RelSpeed", "mean"),
                                    ivb=("InducedVertBreak", "mean"), hb=("HorzBreak_m", "mean")).reset_index())
    fam = g[g[PT].isin(FASTBALL_FAMILY)].sort_values("n", ascending=False).drop_duplicates(key)
    rest = g.merge(fam[key].assign(_has=1), on=key, how="left")
    rest = rest[rest["_has"].isna()].sort_values("v", ascending=False).drop_duplicates(key)
    prim = pd.concat([fam, rest[fam.columns]], ignore_index=True)[key + ["v", "ivb", "hb"]]
    m = df[key].merge(prim, on=key, how="left")
    df[f"speed_diff{suffix}"] = df["RelSpeed"].to_numpy() - m["v"].to_numpy()
    df[f"ivb_diff{suffix}"] = df["InducedVertBreak"].to_numpy() - m["ivb"].to_numpy()
    df[f"hb_diff{suffix}"] = df["HorzBreak_m"].to_numpy() - m["hb"].to_numpy()


def _vaa_est(d, plate_h=2.5, decel_mph=7.0):
    """VAA aproximado SOLO con variables de release (cinemática de docs/09 §3.5, sin SpeedDrop ni ubicación)."""
    v0 = d["RelSpeed"] * 1.46667
    vf = (d["RelSpeed"] - decel_mph) * 1.46667
    L = 60.5 - d["Extension"] - 17 / 12
    t = L / (0.5 * (v0 + vf))
    az = -32.174 + 2 * (d["InducedVertBreak"] / 12) / t ** 2
    vz0 = ((plate_h - d["RelHeight"]) - 0.5 * az * t ** 2) / t
    return np.degrees(np.arctan((vz0 + az * t) / vf))


def _clip_by_type(df, cols, lo=0.001, hi=0.999):
    for c in cols:
        q = df.groupby(PT)[c].quantile([lo, hi]).unstack()
        df[c] = df[c].clip(lower=df[PT].map(q[lo]).astype(float), upper=df[PT].map(q[hi]).astype(float))


def _decat(d):
    """Convierte columnas categóricas (tipo de pitcheo, altitud, ids) a texto: evita errores de clip/groupby."""
    for c in (GROUP_COL, GAME_COL, PT, ALT, "event_type"):
        if c in d.columns and str(d[c].dtype) == "category":
            d[c] = d[c].astype(object)
    return d


def prepare_extra_features(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega columnas para los FEATURE_SETS nuevos. Llamar una vez antes del grid.
      alt_ord        0/1/2 por categoría de altitud (alternativa discreta a density_index)
      total_break    sqrt(IVB^2 + HB^2)
      move_per_rpm   total_break / SpinRate * 1000 (movimiento por rpm: coherencia/eficiencia relativa)
      vaa_est        ángulo de aproximación vertical aproximado desde el release
      *_diff_env     diferenciales vs fastball principal con baseline por (lanzador, año, ENTORNO)
    """
    df = _decat(df.copy())
    df["alt_ord"] = df[ALT].map(ALT_ORD)
    df["total_break"] = np.sqrt(df["InducedVertBreak"] ** 2 + df["HorzBreak_m"] ** 2)
    df["move_per_rpm"] = df["total_break"] / df["SpinRate"].where(df["SpinRate"] > 0) * 1000
    df["vaa_est"] = _vaa_est(df)
    if {"PlateLocHeight", "PlateLocSide"} <= set(df.columns):
        df["loc_abs_side"] = df["PlateLocSide"].abs()
        df["loc_dist_center"] = np.sqrt(df["PlateLocSide"] ** 2 + (df["PlateLocHeight"] - 2.5) ** 2)
    _fb_diffs(df, [GROUP_COL, YEAR, ALT], "_env")
    _clip_by_type(df, ["total_break", "move_per_rpm", "vaa_est", "speed_diff_env", "ivb_diff_env", "hb_diff_env"])
    return df


_BASE14 = ["RelSpeed", "SpinRate", "SpinAxis_sin", "SpinAxis_cos", "InducedVertBreak", "HorzBreak_m",
           "RelHeight", "RelSide_m", "Extension", "same_hand", "speed_diff", "ivb_diff", "hb_diff", "density_index"]
_ARS = ["speed_diff", "ivb_diff", "hb_diff"]
_ARS_ENV = ["speed_diff_env", "ivb_diff_env", "hb_diff_env"]
_SPIN = ["SpinRate", "SpinAxis_sin", "SpinAxis_cos"]
_PHYS = ["total_break", "move_per_rpm", "vaa_est"]

FEATURE_SETS = {
    "base":            _BASE14,
    "base_noarsenal":  [f for f in _BASE14 if f not in _ARS],                                    # C2
    "base_nodensity":  [f for f in _BASE14 if f != "density_index"],                              # C1
    "base_altbucket":  [f for f in _BASE14 if f != "density_index"] + ["alt_ord"],                # C1
    "base_arsenal_env": [f for f in _BASE14 if f not in _ARS] + _ARS_ENV,                         # C2
    "arsenal_env_nodensity": [f for f in _BASE14 if f not in _ARS and f != "density_index"] + _ARS_ENV,   # C1 con arsenal por entorno
    "core6":           ["RelSpeed", "InducedVertBreak", "HorzBreak_m", "RelHeight", "RelSide_m", "Extension"],
    "base_nospin":     [f for f in _BASE14 if f not in _SPIN],                                    # H4
    "plus_physics":    _BASE14 + _PHYS,
    "plus_physics_env": [f for f in _BASE14 if f not in _ARS] + _ARS_ENV + _PHYS,
}

# Location+: solo ubicación (+ conteo y lateralidad). Se usan con target all8/all_cq, rv="by_count", marginalize=False
FEATURE_SETS.update({
    "loc_only":            ["PlateLocHeight", "PlateLocSide"],
    "loc_count":           ["PlateLocHeight", "PlateLocSide", "Balls", "Strikes"],
    "loc_count_hand":      ["PlateLocHeight", "PlateLocSide", "Balls", "Strikes", "same_hand"],
    "loc_count_hand_dist": ["PlateLocHeight", "PlateLocSide", "Balls", "Strikes", "same_hand", "loc_abs_side", "loc_dist_center"],
})

PARAM_SETS = {
    "base":    dict(eta=0.05, max_depth=4, min_child_weight=30, subsample=0.8, colsample_bytree=0.8, reg_lambda=5.0),
    "shallow": dict(eta=0.05, max_depth=3, min_child_weight=100, subsample=0.8, colsample_bytree=0.8, reg_lambda=10.0),
    "deep":    dict(eta=0.05, max_depth=6, min_child_weight=50, subsample=0.8, colsample_bytree=0.7, reg_lambda=5.0),
    "slow":    dict(eta=0.02, max_depth=4, min_child_weight=30, subsample=0.8, colsample_bytree=0.8, reg_lambda=5.0),
}
ROUNDS_BY_PARAMS = {"slow": 600}


# ============================================================================= 4. CONFIG y REJILLA
DEFAULT_CFG = dict(
    name=None, question="A1", hypothesis="propia", report_section="4-modelado",
    product_claim="stuff-plus-significa-algo", status="exploratory",
    target="swing6", rv="neutral", rv_mult=None, features="base", params="base",
    rounds=250, es_rounds=20, val_frac=0.1, n_folds=5, seed=42,
    marginalize=False,       # solo con targets "all*": entrena con ubicación+conteo como CONTROL y los promedia al puntuar
    marg_samples=4,
    stuff_from="auto",       # "all" = usa xRV de todos los pitcheos; "swing" = xRV condicionado a swing; auto: all si domain=all
    compute_ref=True,        # Stuff+ con density_index = 1.0 (contrafactual de entorno)
    shap_sample=0,           # >0: mean|SHAP| por clase en una muestra del fold 0
    fit_final=False, save_oof=False,
    pitch_types=None, pitcher_frac=1.0,
    hand_neutral=False,      # True: puntúa cada pitcheo promediando same_hand=0/1 (Stuff+ sin efecto de la lateralidad enfrentada)
    cache_models=True,       # reutiliza modelos ya entrenados cuando solo cambia el valor de carrera (rv / rv_mult)
)
_MODEL_CACHE = {}


def clear_cache():
    _MODEL_CACHE.clear()


def _name(cfg):
    if cfg.get("name"):
        return cfg["name"]
    rv = cfg["rv"] + ("+mult" if cfg.get("rv_mult") else "")
    return f"{cfg['target']}{'-marg' if cfg['marginalize'] else ''}__{rv}__{cfg['features']}__{cfg['params']}"


def E(**kw):
    c = deepcopy(DEFAULT_CFG)
    c.update(kw)
    return c


# Bloque 1 · target y valor de carrera, con las features/params actuales (responde A1/A2)
GRID_TARGETS = [
    E(name="T0_swing6_neutral",          target="swing6",    rv="neutral", question="A1", status="candidate"),
    E(name="T1_swing6_bycount",          target="swing6",    rv="by_count", question="A2"),
    E(name="T2_swing6_byenv",            target="swing6",    rv="by_env", question="A2"),
    E(name="T3_swing6_whiffonly",        target="swing6",    rv="whiff_only", question="A2"),
    E(name="T4_swingcq_neutral",         target="swing_cq",  rv="neutral", question="A1"),
    E(name="T5_swingcq_whiff_weak_x1.5", target="swing_cq",  rv="neutral", question="A2",
      rv_mult={"Whiff": 1.5, "Weak": 1.5}),
    E(name="T6_whiffbin_whiffonly",      target="whiff_bin", rv="whiff_only", question="A1"),
    E(name="T7_all8_neutral",            target="all8",      rv="neutral", question="A1"),
    E(name="T8_all8_marg_bycount",       target="all8",      rv="by_count", marginalize=True, question="A1"),
    E(name="T9_allzone_marg_bycount",    target="all_zone",  rv="by_count", marginalize=True, question="A1"),
    E(name="T10_allzone_marg_chase_x1.5", target="all_zone", rv="by_count", marginalize=True, question="A2",
      rv_mult={"Whiff_OZ": 1.5, "Whiff_IZ": 1.2, "Weak": 1.0}),
]
# Bloque 2 · features con el target actual (responde C1/C2/H4)
GRID_FEATURES = [E(name=f"F_{f}", features=f, question=q) for f, q in [
    ("base_noarsenal", "C2"), ("base_nodensity", "C1"), ("base_altbucket", "C1"), ("base_arsenal_env", "C2"),
    ("core6", "C4"), ("base_nospin", "H4"), ("plus_physics", "C4"), ("plus_physics_env", "C2")]]
# Bloque 3 · hiperparámetros (¿se está sobreajustando o subajustando?)
GRID_PARAMS = [E(name=f"P_{p}", params=p, question="B1") for p in ("shallow", "deep", "slow")]


# Bloque 4 · siguiente ronda, según los resultados del primer cribado
GRID_NEXT = [
    E(name="N1_swingcq_arsenalenv",              target="swing_cq", rv="neutral", features="base_arsenal_env", question="C2"),
    E(name="N2_swingcq_arsenalenv_handneutral",  target="swing_cq", rv="neutral", features="base_arsenal_env", hand_neutral=True, question="C2"),
    E(name="N3_swingcq_arsenalenv_nodensity",    target="swing_cq", rv="neutral",
      features="arsenal_env_nodensity", question="C1"),
    E(name="N4_allcq_neutral_arsenalenv",        target="all_cq", rv="neutral", features="base_arsenal_env", question="A1"),
    E(name="N5_allcq_whiff_weak_x1.5",           target="all_cq", rv="neutral", features="base_arsenal_env", question="A2",
      rv_mult={"Whiff": 1.5, "Weak": 1.5}),
    E(name="N6_swingcq_physics_env_handneutral", target="swing_cq", rv="neutral", features="plus_physics_env",
      hand_neutral=True, question="C4"),
]


# Bloque Location+ (rápido: 2 a 7 features). Correr con experiment_name="superestela/B-location/loc-grid", out_dir="runs_location"
GRID_LOCATION = [
    E(name=f"L{i}_{f}", target=t, rv="by_count", features=f, question="B-loc", save_oof=True,
      product_claim="location-plus-significa-algo")
    for i, (t, f) in enumerate([("all8", "loc_only"), ("all8", "loc_count"), ("all8", "loc_count_hand"),
                                ("all8", "loc_count_hand_dist"), ("all_cq", "loc_count_hand_dist")], 1)
]


def make_grid(targets=("swing6",), rvs=("neutral",), features=("base",), params=("base",), **common):
    """Producto cartesiano. Ej: make_grid(targets=["swing6","swing_cq"], rvs=["neutral","by_env"], features=["base","core6"])"""
    out = []
    for t, r, f, p in itertools.product(targets, rvs, features, params):
        c = E(target=t, rv=r, features=f, params=p, **common)
        if SCHEMES[t]["domain"] == "all" and "marginalize" not in common:
            c["marginalize"] = True
        out.append(c)
    return out


# ============================================================================= 5. ENTRENAMIENTO
def _predict(bst, n_trees, X):
    P = bst.predict(xgb.DMatrix(X), iteration_range=(0, n_trees))
    return P.reshape(len(X), -1)


def _fit_curve(Xtr, ytr, gtr, K, params, rounds, es_rounds, val_frac, seed):
    uniq = pd.unique(gtr)
    rng = np.random.default_rng(seed)
    val_g = set(rng.choice(uniq, size=max(1, int(len(uniq) * val_frac)), replace=False))
    is_val = pd.Series(gtr).isin(val_g).to_numpy()
    dtr = xgb.DMatrix(Xtr[~is_val], label=ytr[~is_val])
    dva = xgb.DMatrix(Xtr[is_val], label=ytr[is_val])
    res = {}
    p = dict(params, objective="multi:softprob", num_class=K, eval_metric="mlogloss",
             tree_method="hist", seed=seed)
    bst = xgb.train(p, dtr, num_boost_round=rounds, evals=[(dtr, "train"), (dva, "val")],
                    early_stopping_rounds=es_rounds, evals_result=res, verbose_eval=False)
    n_used = bst.best_iteration + 1
    return bst, n_used, np.array(res["train"]["mlogloss"]), np.array(res["val"]["mlogloss"])


def _controls_draws(same_hand, pool, controls, M, rng):
    """M muestras de (ubicación, conteo) de la liga, condicionadas a la misma lateralidad (same_hand)."""
    n = len(same_hand)
    pools = {v: pool[pool["same_hand"] == v][controls].to_numpy() for v in (0, 1)}
    allp = pool[controls].to_numpy()
    draws = []
    for _ in range(M):
        arr = np.empty((n, len(controls)))
        for v in (0, 1):
            m = same_hand == v
            if m.any():
                p = pools[v] if len(pools[v]) else allp
                arr[m] = p[rng.integers(0, len(p), int(m.sum()))]
        draws.append(pd.DataFrame(arr, columns=controls))
    return draws


def _score_rows(bst, n_trees, Xte, meta, rv, sw, controls, draws, override=None):
    """Devuelve (P media, xRV todos, xRV condicionado a swing). Si hay controles, promedia sobre `draws`."""
    X = Xte if override is None else Xte.assign(**override)
    alt = meta[ALT].to_numpy()
    if not controls:
        P = _predict(bst, n_trees, X)
        RVm = rv.matrix(meta["Balls"].to_numpy(), meta["Strikes"].to_numpy(), alt)
        num_sw, den_sw, num_all = (P * RVm * sw).sum(1), (P * sw).sum(1), (P * RVm).sum(1)
        return P, num_all, num_sw / np.maximum(den_sw, 1e-9)
    Pm, num_all, num_sw, den_sw = 0.0, 0.0, 0.0, 0.0
    for ctrl in draws:
        Xs = X.copy()
        for c in controls:
            Xs[c] = ctrl[c].to_numpy().astype("float32")
        P = _predict(bst, n_trees, Xs)
        RVm = rv.matrix(ctrl["Balls"].to_numpy(), ctrl["Strikes"].to_numpy(), alt)
        Pm = Pm + P
        num_all = num_all + (P * RVm).sum(1)
        num_sw = num_sw + (P * RVm * sw).sum(1)
        den_sw = den_sw + (P * sw).sum(1)
    M = len(draws)
    return Pm / M, num_all / M, num_sw / np.maximum(den_sw, 1e-9)


def _score_hn(bst, n_trees, Xte, meta, rv, sw, controls, draws, override=None, p_same=None):
    """Como _score_rows, pero si p_same no es None promedia same_hand=0/1 con pesos (1-p, p)."""
    if p_same is None:
        return _score_rows(bst, n_trees, Xte, meta, rv, sw, controls, draws, override)
    acc = None
    for v, w in ((0.0, 1 - p_same), (1.0, p_same)):
        ov = dict(override or {}); ov["same_hand"] = v
        r = _score_rows(bst, n_trees, Xte, meta, rv, sw, controls, draws, ov)
        acc = [w * x for x in r] if acc is None else [a + w * x for a, x in zip(acc, r)]
    return tuple(acc)


def multiclass_report(y, P):
    y = y.astype(int)
    K = P.shape[1]
    p = np.clip(P[np.arange(len(y)), y], 1e-9, 1)
    prior = np.bincount(y, minlength=K) / len(y)
    base = -np.log(np.clip(prior[y], 1e-9, 1)).mean()
    ll = -np.log(p).mean()
    return ll, base, 100 * (base - ll) / base


# ============================================================================= 6. EVALUACIÓN (métricas de lanzador)
def _corr(a, b, min_n=10):
    a, b = np.asarray(a, float), np.asarray(b, float)
    m = ~(np.isnan(a) | np.isnan(b))
    if m.sum() < min_n or np.std(a[m]) == 0 or np.std(b[m]) == 0:
        return np.nan
    return float(np.corrcoef(a[m], b[m])[0, 1])


def decile_table(x, y, n=10):
    t = pd.DataFrame({"x": x, "y": y}).dropna()
    if len(t) < n * 20:
        return pd.DataFrame(), np.nan
    t["bin"] = pd.qcut(t["x"], n, labels=False, duplicates="drop")
    g = t.groupby("bin").agg(xrv=("x", "mean"), real=("y", "mean"), n=("x", "size")).reset_index()
    slope = float(np.polyfit(g["xrv"], g["real"], 1)[0]) if len(g) > 2 else np.nan
    return g, slope


def split_half(res, col="stuff", min_n=30):
    d = res[res[col].notna()].copy()
    d["half"] = pd.factorize(d[GAME_COL])[0] % 2
    g = d.groupby([GROUP_COL, PT, "half"])[col].agg(["mean", "size"]).unstack("half").dropna()
    g = g[(g[("size", 0)] >= min_n) & (g[("size", 1)] >= min_n)]
    rows = []
    for pt, gg in g.groupby(level=PT):
        if len(gg) >= 10:
            r = _corr(gg[("mean", 0)], gg[("mean", 1)])
            rows.append({"pitch_type": pt, "n_pitchers": len(gg), "r": r, "r_SB": 2 * r / (1 + r)})
    return pd.DataFrame(rows)


def _pitcher_year(res):
    sw = res[res["is_swing"]]
    a = res.groupby([GROUP_COL, PT, YEAR]).agg(stuff=("stuff", "mean"), n=("stuff", "size")).reset_index()
    b = sw.groupby([GROUP_COL, PT, YEAR]).agg(whiff=("is_whiff", "mean"), rv=("rv_real", "mean"),
                                              xrv_sw=("xrv_sw", "mean"), ns=("is_whiff", "size")).reset_index()
    return a.merge(b, on=[GROUP_COL, PT, YEAR], how="inner")


def next_season(res, min_n=80, min_sw=30):
    t = _pitcher_year(res)
    t = t[(t["n"] >= min_n) & (t["ns"] >= min_sw)].copy()
    for c in ("whiff", "rv", "stuff"):          # centrar por tipo
        t[c + "_c"] = t[c] - t.groupby(PT)[c].transform("mean")
    nxt = t.copy()
    nxt[YEAR] = nxt[YEAR] - 1
    m = t.merge(nxt, on=[GROUP_COL, PT, YEAR], suffixes=("", "_next"))
    return {
        "n_pairs_next": int(len(m)),
        "next_whiff_r_stuff": _corr(m["stuff_c"], m["whiff_c_next"]),
        "next_whiff_r_persist": _corr(m["whiff_c"], m["whiff_c_next"]),
        "next_rv_r_stuff": _corr(m["stuff_c"], m["rv_c_next"]),
        "next_rv_r_persist": _corr(m["rv_c"], m["rv_c_next"]),
    }


def bridge_pitcher_season(res, min_sw=150):
    """A3: xRV (condicionado a swing) de lanzador-temporada contra run value observado, misma temporada y siguiente."""
    sw = res[res["is_swing"]]
    t = sw.groupby([GROUP_COL, YEAR]).agg(xrv=("xrv_sw", "mean"), rv=("rv_real", "mean"), ns=("rv_real", "size")).reset_index()
    t = t[t["ns"] >= min_sw]
    nxt = t.copy()
    nxt[YEAR] -= 1
    m = t.merge(nxt, on=[GROUP_COL, YEAR], suffixes=("", "_next"))
    return {"xrv_vs_observed_r": _corr(t["xrv"], t["rv"]), "n_pitcher_seasons": int(len(t)),
            "xrv_next_season_rv_r": _corr(m["xrv"], m["rv_next"]), "rv_persist_r": _corr(m["rv"], m["rv_next"])}


def altitude_within_pitcher(res, min_n=40, min_sw=20):
    """S6: mismo lanzador y tipo en nivel del mar vs altitud extrema. ¿El Δ Stuff+ ordena el Δ whiff observado?"""
    r = res[res[ALT].isin(["No Altitude", "Extreme Altitude"])]
    a = r.groupby([GROUP_COL, PT, ALT]).agg(stuff=("stuff", "mean"), n=("stuff", "size")).reset_index()
    b = r[r["is_swing"]].groupby([GROUP_COL, PT, ALT]).agg(whiff=("is_whiff", "mean"), ns=("is_whiff", "size")).reset_index()
    t = a.merge(b, on=[GROUP_COL, PT, ALT])
    t = t[(t["n"] >= min_n) & (t["ns"] >= min_sw)]
    w = t.pivot_table(index=[GROUP_COL, PT], columns=ALT, values=["stuff", "whiff"]).dropna()
    if len(w) < 20:
        return {"s6_n": int(len(w))}
    ds = w[("stuff", "Extreme Altitude")] - w[("stuff", "No Altitude")]
    dw = w[("whiff", "Extreme Altitude")] - w[("whiff", "No Altitude")]
    return {"s6_n": int(len(w)), "s6_r_dstuff_dwhiff": _corr(ds, dw),
            "s6_mean_dstuff": float(ds.mean()), "s6_mean_dwhiff_pp": float(100 * dw.mean())}


def evaluate_scored(res, fold_summary, type_report):
    out, tables = {}, {}
    sw = res[res["is_swing"] & res["xrv_sw"].notna() & res["rv_real"].notna()]
    tables["deciles"], out["calib_slope"] = decile_table(sw["xrv_sw"], sw["rv_real"])
    for env, key in (("Extreme Altitude", "calib_slope_extreme"), ("No Altitude", "calib_slope_sea")):
        _, out[key] = decile_table(sw.loc[sw[ALT] == env, "xrv_sw"], sw.loc[sw[ALT] == env, "rv_real"])
    sh = split_half(res)
    tables["split_half"] = sh
    out["splithalf_r_mean"] = float(sh["r_SB"].mean()) if len(sh) else np.nan
    out.update(next_season(res))
    out.update(bridge_pitcher_season(res))
    out.update(altitude_within_pitcher(res))
    for env, g in res.groupby(ALT):
        out[f"stuff_mean_{env.replace(' ', '_')}"] = float(g["stuff"].mean())
        if g["stuff_ref"].notna().any():
            out[f"env_effect_{env.replace(' ', '_')}"] = float((g["stuff_ref"] - g["stuff"]).mean())
    if len(type_report):
        w = type_report["n_train"]
        for c in ("logloss_oof", "improve_pct", "auc_whiff"):
            out[c] = float(np.average(type_report[c].fillna(0), weights=w))
    if len(fold_summary):
        out["n_trees_mean"] = float(fold_summary["n_trees_used"].mean())
        out["val_minus_train_logloss"] = float((fold_summary["val_at_best"] - fold_summary["train_at_best"]).mean())
    return out, tables


# ----------------------------------------------------------------------------- bootstrap por lanzador
def _wcorr(x, y, w):
    m = ~(np.isnan(x) | np.isnan(y)) & (w > 0)
    if m.sum() < 10:
        return np.nan
    x, y, w = x[m], y[m], w[m].astype(float)
    mx, my = np.average(x, weights=w), np.average(y, weights=w)
    cov = np.average((x - mx) * (y - my), weights=w)
    vx, vy = np.average((x - mx) ** 2, weights=w), np.average((y - my) ** 2, weights=w)
    return float(cov / np.sqrt(vx * vy)) if vx > 0 and vy > 0 else np.nan


def _boot_tables(res, min_n=80, min_sw=30, min_sw_bridge=150, min_n_alt=40, min_sw_alt=20):
    t = _pitcher_year(res)
    t = t[(t["n"] >= min_n) & (t["ns"] >= min_sw)].copy()
    for c in ("whiff", "rv", "stuff"):
        t[c + "_c"] = t[c] - t.groupby(PT)[c].transform("mean")
    nxt = t.copy(); nxt[YEAR] -= 1
    nx = t.merge(nxt, on=[GROUP_COL, PT, YEAR], suffixes=("", "_next")).rename(columns={GROUP_COL: "pid"})
    sw = res[res["is_swing"]]
    b = sw.groupby([GROUP_COL, YEAR]).agg(xrv=("xrv_sw", "mean"), rv=("rv_real", "mean"), ns=("rv_real", "size")).reset_index()
    b = b[b["ns"] >= min_sw_bridge]
    bn = b.copy(); bn[YEAR] -= 1
    bt = b.merge(bn, on=[GROUP_COL, YEAR], suffixes=("", "_next")).rename(columns={GROUP_COL: "pid"})
    b = b.rename(columns={GROUP_COL: "pid"})
    r = res[res[ALT].isin(["No Altitude", "Extreme Altitude"])]
    a = r.groupby([GROUP_COL, PT, ALT]).agg(stuff=("stuff", "mean"), n=("stuff", "size")).reset_index()
    w = r[r["is_swing"]].groupby([GROUP_COL, PT, ALT]).agg(whiff=("is_whiff", "mean"), ns=("is_whiff", "size")).reset_index()
    u = a.merge(w, on=[GROUP_COL, PT, ALT])
    u = u[(u["n"] >= min_n_alt) & (u["ns"] >= min_sw_alt)]
    p = u.pivot_table(index=[GROUP_COL, PT], columns=ALT, values=["stuff", "whiff"]).dropna()
    s6 = pd.DataFrame({"pid": p.index.get_level_values(0),
                       "ds": (p[("stuff", "Extreme Altitude")] - p[("stuff", "No Altitude")]).to_numpy(),
                       "dw": (p[("whiff", "Extreme Altitude")] - p[("whiff", "No Altitude")]).to_numpy()})
    return dict(nx=nx, b=b, bt=bt, s6=s6)


_BOOT_METRICS = {
    "next_whiff_r_stuff": ("nx", "stuff_c", "whiff_c_next"),
    "next_rv_r_stuff": ("nx", "stuff_c", "rv_c_next"),
    "xrv_vs_observed_r": ("b", "xrv", "rv"),
    "xrv_next_season_rv_r": ("bt", "xrv", "rv_next"),
    "s6_r_dstuff_dwhiff": ("s6", "ds", "dw"),
}


def bootstrap_metrics(res, res_other=None, n_boot=300, seed=0):
    """IC95% por bootstrap de LANZADORES de las métricas de lanzador. Con res_other devuelve además la
    diferencia pareada (res - res_other) y su IC: es la forma correcta de decir si una versión supera a otra."""
    ta = _boot_tables(res)
    tb = _boot_tables(res_other) if res_other is not None else None
    ids = pd.concat([res[GROUP_COL]] + ([res_other[GROUP_COL]] if res_other is not None else [])).dropna()
    ids = np.sort(pd.unique(ids.astype(str)).astype(object))
    for tabs in [ta] + ([tb] if tb else []):
        for t in tabs.values():
            t["pid"] = t["pid"].astype(str)
    rng = np.random.default_rng(seed)
    cache = {}
    def _vals(tabs, w):
        return {k: _wcorr(tabs[t][x].to_numpy(float), tabs[t][y].to_numpy(float), w[t]) for k, (t, x, y) in _BOOT_METRICS.items()}
    full = lambda tabs: {t: np.ones(len(tabs[t])) for t in tabs}
    est_a = _vals(ta, full(ta)); est_b = _vals(tb, full(tb)) if tb else None
    boots_a, boots_b = [], []
    for _ in range(n_boot):
        cnt = pd.Series(rng.choice(ids, len(ids))).value_counts()
        wa = {t: ta[t]["pid"].map(cnt).fillna(0).to_numpy() for t in ta}
        boots_a.append(_vals(ta, wa))
        if tb:
            wb = {t: tb[t]["pid"].map(cnt).fillna(0).to_numpy() for t in tb}
            boots_b.append(_vals(tb, wb))
    rows = []
    for k in _BOOT_METRICS:
        xa = np.array([b[k] for b in boots_a], float)
        row = {"metric": k, "est": est_a[k], "lo": np.nanpercentile(xa, 2.5), "hi": np.nanpercentile(xa, 97.5)}
        if tb:
            xb = np.array([b[k] for b in boots_b], float); dd = xa - xb
            row.update(est_other=est_b[k], diff=est_a[k] - est_b[k], diff_lo=np.nanpercentile(dd, 2.5),
                       diff_hi=np.nanpercentile(dd, 97.5),
                       sig=bool(np.nanpercentile(dd, 2.5) > 0 or np.nanpercentile(dd, 97.5) < 0))
        rows.append(row)
    return pd.DataFrame(rows).round(3)


def load_oof(name, out_dir="runs"):
    return pd.read_parquet(os.path.join(out_dir, name, "oof.parquet"))


# ============================================================================= 7. FIGURAS
def plot_learning_curves(curves, title="", show=False):
    import matplotlib.pyplot as plt
    types = list(curves["pitch_type"].unique())
    fig, axes = plt.subplots(1, len(types), figsize=(4.2 * len(types), 3.6), squeeze=False)
    for ax, pt in zip(axes[0], types):
        c = curves[curves["pitch_type"] == pt]
        nf = c["fold"].nunique()
        g = c.groupby("iter")[["train_mlogloss", "val_mlogloss"]].agg("mean")
        g = g[c.groupby("iter")["fold"].nunique() == nf]      # promedio solo donde siguen todos los folds
        ax.plot(g.index, g["train_mlogloss"], label="train")
        ax.plot(g.index, g["val_mlogloss"], label="val (pitchers no vistos)")
        for _, f in c.groupby("fold"):
            ax.plot(f["iter"], f["val_mlogloss"], color="gray", alpha=.25, lw=.8)
        ax.set_title(pt); ax.set_xlabel("árboles"); ax.set_ylabel("mlogloss")
    axes[0][0].legend()
    fig.suptitle(title); fig.tight_layout()
    if not show:
        plt.close(fig)
    return fig


def plot_importance(imp, top=12, title="", show=False):
    import matplotlib.pyplot as plt
    types = list(imp["pitch_type"].unique())
    fig, axes = plt.subplots(1, len(types), figsize=(4.2 * len(types), 4), squeeze=False)
    for ax, pt in zip(axes[0], types):
        g = imp[imp["pitch_type"] == pt].nlargest(top, "gain").iloc[::-1]
        ax.barh(g["feature"], g["gain"]); ax.set_title(pt); ax.set_xlabel("gain")
    fig.suptitle(title); fig.tight_layout()
    if not show:
        plt.close(fig)
    return fig


def plot_deciles(dec, slope, title="", show=False):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(4.6, 4))
    if len(dec):
        ax.plot(dec["xrv"], dec["real"], "o-")
        lo, hi = min(dec["xrv"].min(), dec["real"].min()), max(dec["xrv"].max(), dec["real"].max())
        ax.plot([lo, hi], [lo, hi], "--", color="gray")
    ax.set_xlabel("xRV predicho (decil)"); ax.set_ylabel("run value real (decil)")
    ax.set_title(f"{title}\npendiente={slope:.2f}"); fig.tight_layout()
    if not show:
        plt.close(fig)
    return fig


# ============================================================================= 8. MLFLOW
def _dataset_hash(df, dataset_path=None):
    if dataset_path and os.path.exists(dataset_path):
        h = hashlib.sha1()
        with open(dataset_path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 22), b""):
                h.update(chunk)
        return h.hexdigest()[:12]
    s = f"{len(df)}|{','.join(map(str, df.columns[:30]))}|{df.index[:5].tolist()}"
    return hashlib.sha1(s.encode()).hexdigest()[:12] + "*"


def _log_curve_child(client, parent_run_id, exp_id, name, pt, curves_pt, fold_pt, extra_params):
    child = client.create_run(exp_id, tags={"mlflow.parentRunId": parent_run_id, "mlflow.runName": f"{name}/{pt}"})
    rid = child.info.run_id
    now = int(time.time() * 1000)
    ms = []
    for f, c in curves_pt.groupby("fold"):
        for _, r in c.iterrows():
            ms.append(Metric(f"train_mlogloss_f{f}", float(r["train_mlogloss"]), now, int(r["iter"])))
            ms.append(Metric(f"val_mlogloss_f{f}", float(r["val_mlogloss"]), now, int(r["iter"])))
    for i in range(0, len(ms), 900):
        client.log_batch(rid, metrics=ms[i:i + 900])
    ps = [Param(k, str(v)) for k, v in extra_params.items()]
    ps += [Param("n_trees_per_fold", ",".join(map(str, fold_pt["n_trees_used"])))]
    client.log_batch(rid, params=ps)
    client.set_terminated(rid)


def _flat_params(cfg, feats):
    p = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in cfg.items() if k != "name"}
    p["n_features"] = len(feats)
    p["feature_list"] = ",".join(feats)[:5000]
    p["cv_scheme"] = "group_pitcher"
    p["pit_correct"] = False
    p["xgb"] = json.dumps(PARAM_SETS[cfg["params"]])
    p["target_desc"] = SCHEMES[cfg["target"]]["desc"]
    p["rv_desc"] = RV_KINDS[cfg["rv"]]
    return p


# ============================================================================= 9. EXPERIMENTO
def run_experiment(df, cfg, *, experiment_name="superestela/A-target/stuff-grid",
                   tracking_uri="sqlite:///mlflow.db", out_dir="runs", dataset_path=None,
                   use_mlflow=True, verbose=True):
    cfg = {**DEFAULT_CFG, **cfg}
    name = _name(cfg)
    t_start = time.time()
    scheme = SCHEMES[cfg["target"]]
    classes, K = scheme["classes"], len(scheme["classes"])
    cmap = {c: i for i, c in enumerate(classes)}
    sw = swing_class_mask(classes)
    feats = [f for f in FEATURE_SETS[cfg["features"]] if f in df.columns]
    missing = [f for f in FEATURE_SETS[cfg["features"]] if f not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas para features='{cfg['features']}': {missing}. ¿Corriste prepare_extra_features(df)?")
    marg = bool(cfg["marginalize"]) and scheme["domain"] == "all"
    if cfg["marginalize"] and not marg:
        print("  (marginalize ignorado: solo aplica a targets 'all*')")
    controls = LOC_CONTROLS if marg else []
    model_feats = feats + controls
    stuff_from = cfg["stuff_from"]
    if stuff_from == "auto":
        stuff_from = "all" if scheme["domain"] == "all" else "swing"
    ref_ok = cfg["compute_ref"] and ("density_index" in feats)
    params = PARAM_SETS[cfg["params"]]
    rounds = ROUNDS_BY_PARAMS.get(cfg["params"], cfg["rounds"])
    run_dir = os.path.join(out_dir, name)
    os.makedirs(run_dir, exist_ok=True)

    # ---- marco de trabajo
    need = list(dict.fromkeys([GROUP_COL, GAME_COL, PT, ALT, YEAR, "event_type", "delta_run_exp", "has_rv",
                               "Balls", "Strikes", "valid_hand", "ExitSpeed", "in_strike_zone", "same_hand",
                               "PitchUID"] + model_feats + STUFF_CORE))
    d = _decat(df[[c for c in need if c in df.columns]].copy())
    if cfg["pitcher_frac"] < 1:
        ps = np.sort(d[GROUP_COL].dropna().unique())
        keep = np.random.default_rng(cfg["seed"]).choice(ps, int(len(ps) * cfg["pitcher_frac"]), replace=False)
        d = d[d[GROUP_COL].isin(keep)]
    uniq = np.sort(d[GROUP_COL].dropna().unique())
    perm = np.random.default_rng(cfg["seed"]).permutation(len(uniq))
    fold_of = {g: i % cfg["n_folds"] for i, g in enumerate(uniq[perm])}
    d["fold"] = d[GROUP_COL].map(fold_of)
    d["label"] = build_labels(d, cfg["target"])
    d["is_swing"] = d["label"].isin([c for c in classes if c not in TAKE_CLASSES]) if scheme["domain"] == "all" \
        else d["label"].notna()
    d["is_whiff"] = d["label"].isin(WHIFF_CLASSES | {"Whiff"}).astype(float)
    d["rv_real"] = d["delta_run_exp"]
    rv = RV(cfg["rv"], classes, d, d["label"], cfg["rv_mult"])
    base_ok = d["valid_hand"].astype(bool) & d[STUFF_CORE].notna().all(axis=1)
    if marg:
        base_ok &= d[LOC_CONTROLS].notna().all(axis=1)
    types = cfg["pitch_types"] or [p for p, n in d[PT].value_counts().items()
                                   if p not in EXCLUDE_PITCH_TYPES and n >= MIN_ROWS_PER_TYPE]
    rng = np.random.default_rng(cfg["seed"])

    res_parts, curves, folds_rows, imp_rows, shap_rows, rep_rows, cal_rows = [], [], [], [], [], [], []
    for pt in types:
        t0 = time.time()
        sub = d[(d[PT] == pt) & base_ok]
        tm = (sub["label"].notna() & sub["has_rv"].astype(bool)).to_numpy()
        if tm.sum() < 500 or sub[GROUP_COL].nunique() < 5:
            print(f"  [{pt}] saltado ({int(tm.sum())} filas de entrenamiento)")
            continue
        X = sub[model_feats].astype("float32").reset_index(drop=True)
        meta = sub[[ALT, "Balls", "Strikes", "same_hand"]].reset_index(drop=True)
        y = sub["label"].map(cmap).to_numpy(dtype=float)
        g = sub[GROUP_COL].to_numpy()
        fl = sub["fold"].to_numpy()
        n = len(sub)
        P_act = np.full((n, K), np.nan)
        P_use = np.full((n, K), np.nan)
        x_all = np.full(n, np.nan); x_sw = np.full(n, np.nan)
        x_all_ref = np.full(n, np.nan); x_sw_ref = np.full(n, np.nan)
        used = []
        for f in range(cfg["n_folds"]):
            te = fl == f
            tr = (~te) & tm
            if te.sum() == 0 or tr.sum() < 500:
                continue
            ck = (cfg["target"], cfg["features"], cfg["params"], cfg["seed"], cfg["n_folds"], rounds, cfg["es_rounds"],
                  cfg["val_frac"], marg, cfg["pitcher_frac"], tuple(cfg["pitch_types"] or ()), pt, f, len(d))
            if cfg["cache_models"] and ck in _MODEL_CACHE:
                bst, n_used, tr_c, va_c = _MODEL_CACHE[ck]
            else:
                bst, n_used, tr_c, va_c = _fit_curve(X[tr], y[tr].astype(int), g[tr], K, params, rounds,
                                                     cfg["es_rounds"], cfg["val_frac"], cfg["seed"] + f)
                if cfg["cache_models"]:
                    _MODEL_CACHE[ck] = (bst, n_used, tr_c, va_c)
            used.append(n_used)
            for i, (a, b) in enumerate(zip(tr_c, va_c)):
                curves.append((pt, f, i, a, b))
            folds_rows.append(dict(pitch_type=pt, fold=f, n_train=int(tr.sum()), n_test_pitchers=int(len(np.unique(g[te]))),
                                   n_trees_used=n_used, train_at_best=float(tr_c[n_used - 1]),
                                   val_at_best=float(va_c[n_used - 1]), stopped_early=bool(n_used < rounds)))
            for k, v in bst.get_score(importance_type="gain").items():
                imp_rows.append((pt, f, k, v))
            Xte = X[te].reset_index(drop=True)
            mte = meta[te].reset_index(drop=True)
            P_act[te] = _predict(bst, n_used, Xte)            # con la ubicación REAL (habilidad del modelo)
            draws = None
            if marg:
                pool = pd.concat([X.loc[tr, LOC_CONTROLS], meta.loc[tr, ["same_hand"]]], axis=1)
                if len(pool) > 60000:
                    pool = pool.sample(60000, random_state=cfg["seed"])
                draws = _controls_draws(mte["same_hand"].to_numpy(), pool, LOC_CONTROLS, cfg["marg_samples"], rng)
            p_same = float(meta.loc[tr, "same_hand"].mean()) if (cfg["hand_neutral"] and "same_hand" in feats) else None
            Pm, xa, xs = _score_hn(bst, n_used, Xte, mte, rv, sw, controls, draws, None, p_same)
            P_use[te], x_all[te], x_sw[te] = Pm, xa, xs
            if ref_ok:
                _, xa2, xs2 = _score_hn(bst, n_used, Xte, mte, rv, sw, controls, draws, {"density_index": 1.0}, p_same)
                x_all_ref[te], x_sw_ref[te] = xa2, xs2
            if cfg["shap_sample"] and f == 0:
                ix = np.random.default_rng(0).choice(len(Xte), min(cfg["shap_sample"], len(Xte)), replace=False)
                C = bst.predict(xgb.DMatrix(Xte.iloc[ix]), pred_contribs=True, iteration_range=(0, n_used))
                C = np.abs(C).mean(0)[:, :-1]                    # (K, F)
                for ci, cn in enumerate(classes):
                    for fi, fn in enumerate(model_feats):
                        shap_rows.append((pt, cn, fn, float(C[ci, fi])))
        ok = ~np.isnan(P_act).any(axis=1)
        mm = ok & tm
        ll, base, imp = multiclass_report(y[mm], P_act[mm])
        # AUC de whiff (comparable entre targets): P(whiff | swing) del modelo vs whiff observado en swings
        wmask = np.array([c in WHIFF_CLASSES or c == "Whiff" for c in classes])
        swrows = ok & ~np.isnan(P_use).any(axis=1) & sub["is_swing"].to_numpy()
        from sklearn.metrics import roc_auc_score
        pw = P_use[:, wmask].sum(1) / np.maximum((P_use * sw).sum(1), 1e-9)
        yw = sub["is_whiff"].to_numpy()
        try:
            auc = float(roc_auc_score(yw[swrows], pw[swrows]))
        except Exception:
            auc = np.nan
        rep_rows.append(dict(pitch_type=pt, n_train=int(tm.sum()), pitchers=int(sub[GROUP_COL].nunique()),
                             logloss_oof=ll, logloss_base=base, improve_pct=imp, auc_whiff=auc,
                             n_trees_mean=float(np.mean(used)), secs=round(time.time() - t0)))
        obs = np.bincount(y[mm].astype(int), minlength=K) / mm.sum()
        pred = P_act[mm].mean(0)
        for ci, cn in enumerate(classes):
            cal_rows.append((pt, cn, obs[ci], pred[ci], pred[ci] - obs[ci]))
        xu = x_all if stuff_from == "all" else x_sw
        xr = x_all_ref if stuff_from == "all" else x_sw_ref
        r = pd.DataFrame({"xrv_use": xu, "xrv_use_ref": xr, "xrv_sw": x_sw, "p_whiff_sw": pw}, index=sub.index)
        res_parts.append(r)
        if verbose:
            print(f"  [{pt}] {time.time() - t0:.0f}s | logloss {ll:.4f} vs base {base:.4f} ({imp:+.2f}%) | "
                  f"AUC whiff {auc:.3f} | árboles/fold {used}")

    if not res_parts:
        raise RuntimeError("Ningún tipo de pitcheo se entrenó")
    R = pd.concat(res_parts)
    res = d.loc[R.index, [GROUP_COL, GAME_COL, PT, ALT, YEAR, "PitchUID", "fold", "is_swing", "is_whiff", "rv_real"]].join(R)
    # Stuff+ por tipo: 100 - 10 z del xRV
    grp = res.groupby(PT)["xrv_use"]
    mu, sd = grp.transform("mean"), grp.transform("std").replace(0, np.nan)
    res["stuff"] = 100 - 10 * (res["xrv_use"] - mu) / sd
    res["stuff_ref"] = 100 - 10 * (res["xrv_use_ref"] - mu) / sd
    res["is_swing"] = res["is_swing"].astype(bool)

    curves_df = pd.DataFrame(curves, columns=["pitch_type", "fold", "iter", "train_mlogloss", "val_mlogloss"])
    folds_df = pd.DataFrame(folds_rows)
    rep_df = pd.DataFrame(rep_rows)
    imp_df = (pd.DataFrame(imp_rows, columns=["pitch_type", "fold", "feature", "gain"])
              .groupby(["pitch_type", "feature"], as_index=False)["gain"].sum())
    imp_df["gain"] = imp_df["gain"] / cfg["n_folds"]
    imp_df["gain_pct"] = 100 * imp_df["gain"] / imp_df.groupby("pitch_type")["gain"].transform("sum")
    cal_df = pd.DataFrame(cal_rows, columns=["pitch_type", "clase", "observado", "predicho", "dif"])
    metrics, tables = evaluate_scored(res, folds_df, rep_df)
    metrics["n_pitches_scored"] = int(len(res))
    metrics["runtime_s"] = round(time.time() - t_start)
    pitcher_tab = (res.groupby([GROUP_COL, YEAR, PT]).agg(n=("stuff", "size"), stuff=("stuff", "mean"),
                                                         xrv_sw=("xrv_sw", "mean")).reset_index())

    # ---- guardar en disco
    curves_df.to_csv(os.path.join(run_dir, "curves.csv"), index=False)
    folds_df.to_csv(os.path.join(run_dir, "fold_summary.csv"), index=False)
    imp_df.sort_values(["pitch_type", "gain"], ascending=[True, False]).to_csv(os.path.join(run_dir, "importance_gain.csv"), index=False)
    rep_df.to_csv(os.path.join(run_dir, "per_type_report.csv"), index=False)
    cal_df.to_csv(os.path.join(run_dir, "calibration_classes.csv"), index=False)
    tables["deciles"].to_csv(os.path.join(run_dir, "deciles.csv"), index=False)
    pitcher_tab.to_csv(os.path.join(run_dir, "pitcher_table.csv"), index=False)
    rv.table().to_csv(os.path.join(run_dir, "rv_values.csv"))
    if shap_rows:
        pd.DataFrame(shap_rows, columns=["pitch_type", "clase", "feature", "mean_abs_shap"]).to_csv(
            os.path.join(run_dir, "shap_mean_abs.csv"), index=False)
    if cfg["save_oof"]:
        res.drop(columns=["xrv_use_ref"]).to_parquet(os.path.join(run_dir, "oof.parquet"))
    json.dump({**cfg, "features_resolved": feats, "controls": controls}, open(os.path.join(run_dir, "config.json"), "w"), indent=2, default=str)
    json.dump({k: (None if (isinstance(v, float) and np.isnan(v)) else v) for k, v in metrics.items()},
              open(os.path.join(run_dir, "metrics.json"), "w"), indent=2)
    try:
        plot_learning_curves(curves_df, name).savefig(os.path.join(run_dir, "learning_curves.png"), dpi=110)
        plot_importance(imp_df, title=name).savefig(os.path.join(run_dir, "importance.png"), dpi=110)
        plot_deciles(tables["deciles"], metrics.get("calib_slope", np.nan), name).savefig(os.path.join(run_dir, "deciles.png"), dpi=110)
    except Exception as e:  # pragma: no cover
        print("  (figuras omitidas:", e, ")")

    if cfg["fit_final"]:
        _fit_final_models(d, base_ok, types, model_feats, classes, cmap, params, rounds, folds_df, cfg, run_dir)

    # ---- MLflow
    if use_mlflow and HAS_MLFLOW:
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(experiment_name)
        client = MlflowClient()
        exp_id = mlflow.get_experiment_by_name(experiment_name).experiment_id
        with mlflow.start_run(run_name=name) as run:
            mlflow.set_tags({"question": cfg["question"], "hypothesis": cfg["hypothesis"],
                             "report_section": cfg["report_section"], "product_claim": cfg["product_claim"],
                             "status": cfg["status"], "dataset_hash": _dataset_hash(df, dataset_path)})
            mlflow.log_params(_flat_params(cfg, feats))
            mlflow.log_metrics({k: float(v) for k, v in metrics.items() if v is not None and not (isinstance(v, float) and np.isnan(v))})
            for _, r in rep_df.iterrows():
                for k in ("logloss_oof", "improve_pct", "auc_whiff"):
                    mlflow.log_metric(f"{k}__{r['pitch_type']}", float(r[k]))
            mlflow.log_artifacts(run_dir)
            for pt in curves_df["pitch_type"].unique():
                _log_curve_child(client, run.info.run_id, exp_id, name, pt,
                                 curves_df[curves_df["pitch_type"] == pt], folds_df[folds_df["pitch_type"] == pt],
                                 {"pitch_type": pt, "parent": name})
    if verbose:
        print(f"✔ {name} | {metrics['runtime_s']}s | auc_whiff {metrics.get('auc_whiff', np.nan):.3f} | "
              f"slope {metrics.get('calib_slope', np.nan):.2f} | next_whiff_r {metrics.get('next_whiff_r_stuff', np.nan):.3f} | "
              f"s6_r {metrics.get('s6_r_dstuff_dwhiff', np.nan):.3f} | bridge_r {metrics.get('xrv_vs_observed_r', np.nan):.3f}")
    return metrics, dict(res=res, curves=curves_df, folds=folds_df, importance=imp_df, report=rep_df,
                         calibration=cal_df, tables=tables, rv=rv.table())


def _fit_final_models(d, base_ok, types, model_feats, classes, cmap, params, rounds, folds_df, cfg, run_dir):
    os.makedirs(os.path.join(run_dir, "models"), exist_ok=True)
    K = len(classes)
    for pt in types:
        sub = d[(d[PT] == pt) & base_ok]
        tm = (sub["label"].notna() & sub["has_rv"].astype(bool)).to_numpy()
        if tm.sum() < 500:
            continue
        nt = int(folds_df.loc[folds_df["pitch_type"] == pt, "n_trees_used"].mean()) or 100
        p = dict(params, objective="multi:softprob", num_class=K, tree_method="hist", seed=cfg["seed"])
        bst = xgb.train(p, xgb.DMatrix(sub.loc[tm, model_feats].astype("float32"), label=sub.loc[tm, "label"].map(cmap).to_numpy(int)),
                        num_boost_round=max(20, nt))
        bst.save_model(os.path.join(run_dir, "models", f"stuff_{pt}.json"))


# ============================================================================= 10. REJILLA y COMPARACIÓN
def run_grid(df, grid, *, screen=True, skip_done=True, experiment_name="superestela/A-target/stuff-grid",
             tracking_uri="sqlite:///mlflow.db", out_dir="runs", dataset_path=None, use_mlflow=True):
    """Itera la lista de configuraciones. screen=True usa 3 tipos (Four-Seam, Slider, Changeup) y 50% de lanzadores
    para descartar rápido; después se repiten los 2-3 mejores con screen=False."""
    rows = []
    done = set()
    if skip_done and use_mlflow and HAS_MLFLOW:
        try:
            mlflow.set_tracking_uri(tracking_uri)
            old = mlflow.search_runs(experiment_names=[experiment_name], output_format="pandas")
            if len(old):
                old = old[old["status"] == "FINISHED"]
                done = set(old["tags.mlflow.runName"].dropna())
        except Exception:
            pass
    for i, cfg in enumerate(grid, 1):
        c = {**DEFAULT_CFG, **cfg}
        if screen:
            c["pitch_types"] = c["pitch_types"] or ["Four-Seam", "Slider", "Changeup"]
            c["pitcher_frac"] = min(c["pitcher_frac"], 0.5)
            c["name"] = (c.get("name") or _name(c)) + "__screen"
        nm = _name(c)
        if nm in done:
            print(f"[{i}/{len(grid)}] {nm}: ya existe en MLflow, se omite")
            continue
        print(f"[{i}/{len(grid)}] {nm}")
        try:
            m, _ = run_experiment(df, c, experiment_name=experiment_name, tracking_uri=tracking_uri, out_dir=out_dir,
                                  dataset_path=dataset_path, use_mlflow=use_mlflow)
            rows.append({"run": nm, "target": c["target"], "rv": c["rv"], "features": c["features"], "params": c["params"], **m})
        except Exception as e:
            print(f"  ✖ falló: {type(e).__name__}: {e}")
            rows.append({"run": nm, "error": str(e)})
        pd.DataFrame(rows).to_csv(os.path.join(out_dir, "summary.csv"), index=False)
    return pd.DataFrame(rows)


COMPARE_COLS = ["tags.mlflow.runName", "params.target", "params.rv", "params.features", "params.params",
                "metrics.improve_pct", "metrics.auc_whiff", "metrics.calib_slope", "metrics.calib_slope_extreme",
                "metrics.splithalf_r_mean", "metrics.next_whiff_r_stuff", "metrics.next_rv_r_stuff",
                "metrics.s6_r_dstuff_dwhiff", "metrics.xrv_vs_observed_r", "metrics.xrv_next_season_rv_r",
                "metrics.n_trees_mean", "metrics.val_minus_train_logloss", "metrics.runtime_s"]


def compare_runs(experiment_name="superestela/A-target/stuff-grid", tracking_uri="sqlite:///mlflow.db",
                 sort_by="metrics.next_whiff_r_stuff"):
    mlflow.set_tracking_uri(tracking_uri)
    r = mlflow.search_runs(experiment_names=[experiment_name], output_format="pandas")
    if "tags.mlflow.parentRunId" in r.columns:
        r = r[r["tags.mlflow.parentRunId"].isna()]
    cols = [c for c in COMPARE_COLS if c in r.columns]
    out = r[cols].rename(columns=lambda c: c.split(".", 1)[-1])
    key = sort_by.split(".", 1)[-1]
    if key not in out.columns or out[key].isna().all():
        key = "auc_whiff" if "auc_whiff" in out.columns else out.columns[0]
    return out.sort_values(key, ascending=False).reset_index(drop=True).round(3)
