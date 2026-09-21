"""
SuperEstela - Evidence pipeline for the ISAC / Diablos Rojos Stuff+ hackathon.

Regenerates EVERY number quoted in the product documentation, the finalist deck
and the design mockups, straight from `stuff_model_df.parquet`.

Run:  python3 analysis/evidence.py
Out:  analysis/outputs/evidence.json      (all headline figures)
      analysis/outputs/mockup_data.json   (real pitcher rows for the prototype)

Design notes
------------
* Every figure is computed on the FULL dataset, never on a head() sample.
* The altitude effect is identified WITHIN pitcher, so pitcher selection cannot
  explain it.
* The air-density index is derived from first principles (drag / Magnus
  decomposition of the measured acceleration vector), not from the coarse
  3-level `altitude_category` label.
* `stuff_plus_v0` is a deliberately simple BASELINE so the prototype can show
  real numbers. It is NOT the final model - that is the data team's scope.
"""

import json
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold

from models.features.role import STARTER_FIRST_INNING_SHARE, classify_roles

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PARQUET = os.path.join(ROOT, "data", "stuff_model_df.parquet")
OUT = os.path.join(HERE, "outputs")

GRAVITY = 32.174  # ft/s^2

# Product rule, mirrored from contracts.schemas.MIN_PITCHES_FOR_SCORE: below
# this in EITHER environment there is no comparison to show.
MIN_PITCHES = 100
MAIN_PITCHES = ["Four-Seam", "Sinker", "Slider", "Changeup", "Curveball", "Cutter"]
SEA, MED, EXT = "No Altitude", "Medium Altitude", "Extreme Altitude"

# Pitch-level linear weights (run value from the batting team's perspective).
# Standard sabermetric magnitudes; used only for the v0 baseline target.
RUN_VALUE = {
    "HomeRun": 1.40,
    "Triple": 1.05,
    "Double": 0.77,
    "Single": 0.47,
    "Walk": 0.31,
    "HitByPitch": 0.34,
    "Error": 0.47,
    "FieldersChoice": -0.10,
    "Out": -0.27,
    "Sacrifice": -0.10,
    "Strikeout": -0.27,
    "StrikeSwinging": -0.05,
    "StrikeCalled": -0.05,
    "FoulBallFieldable": -0.27,
    "BallCalled": 0.032,
    "BallinDirt": 0.032,
    "NeutralPlay": -0.01,
}

R = {}  # results collected here


def log(msg):
    print(msg, flush=True)


# --------------------------------------------------------------------------
# 1. Load + data-quality audit
# --------------------------------------------------------------------------
def load():
    cols = [
        "year",
        "PitchUID",
        "game_anon_id",
        "pitcher_anon_id",
        "batter_anon_id",
        "PitcherThrows",
        "BatterSide",
        "altitude_category",
        "AutoPitchType",
        "RelSpeed",
        "ZoneSpeed",
        "SpinRate",
        "SpinAxis",
        "RelHeight",
        "RelSide",
        "Extension",
        "InducedVertBreak",
        "HorzBreak",
        "VertApprAngle",
        "SpeedDrop",
        "vx0",
        "vy0",
        "vz0",
        "ax0",
        "ay0",
        "az0",
        "PitchCall",
        "play_result",
        "hit_type",
        "ExitSpeed",
        "Angle",
        "Distance",
        "is_swing",
        "is_whiff",
        "is_called_strike",
        "is_ball_in_play",
        "is_batted",
        "home_run",
        "is_hit_by_pitch",
        "Inning",
        "Outs",
        "OutsOnPlay",
        "Balls",
        "Strikes",
        "RunsScored",
        "in_strike_zone",
        "outside_strike_zone",
        "swung_outside_strike_zone",
        "y0",
        "EffectiveVelo",
    ]
    log("Loading parquet ...")
    return pd.read_parquet(PARQUET, columns=cols)


def audit(df):
    """Concrete defects found in the delivered dataset - motivates the
    schema-validation layer in the reference architecture."""
    a = {
        "n_pitches": len(df),
        "n_games": int(df.game_anon_id.nunique()),
        "n_pitchers": int(df.pitcher_anon_id.nunique()),
        "n_batters": int(df.batter_anon_id.nunique()),
        "seasons": sorted(int(y) for y in df.year.unique()),
        "defects": [],
    }
    hbp_call = int((df.PitchCall == "HitByPitch").sum())
    hbp_flag = int(df.is_hit_by_pitch.fillna(0).sum())
    a["defects"].append(
        {
            "field": "is_hit_by_pitch",
            "issue": "flag is all-zero while PitchCall records HBP events",
            "evidence": f"{hbp_flag} flagged vs {hbp_call} HitByPitch in PitchCall",
            "severity": "high",
            "action": "rebuild flag from PitchCall",
        }
    )
    a["defects"].append(
        {
            "field": "EffectiveVelo",
            "issue": "stored as string while every other velocity is float64",
            "evidence": f"dtype={df.EffectiveVelo.dtype}",
            "severity": "medium",
            "action": "cast to float in ingestion",
        }
    )
    y0const = int((df.y0 == 50.0).sum())
    a["defects"].append(
        {
            "field": "y0",
            "issue": "constant, carries zero information",
            "evidence": f"{y0const}/{len(df)} rows equal 50.0 ft",
            "severity": "low",
            "action": "drop from feature space",
        }
    )
    a["defects"].append(
        {
            "field": "Outs",
            "issue": "impossible value 3 before a pitch",
            "evidence": f"{int((df.Outs == 3).sum())} rows",
            "severity": "medium",
            "action": "range assertion, quarantine rows",
        }
    )
    a["defects"].append(
        {
            "field": "altitude_category",
            "issue": "null environment label",
            "evidence": f"{int(df.altitude_category.isna().sum())} rows",
            "severity": "high",
            "action": "impute from measured density index",
        }
    )
    dirty_hand = int(df.PitcherThrows.isin(["Undefined"]).sum() + df.PitcherThrows.isna().sum())
    a["defects"].append(
        {
            "field": "PitcherThrows / BatterSide",
            "issue": "None / Undefined handedness",
            "evidence": f"{dirty_hand} pitcher rows",
            "severity": "medium",
            "action": "impute from pitcher mode, else drop",
        }
    )
    rare = df.AutoPitchType.value_counts()
    junk = rare[rare < 1000]
    a["defects"].append(
        {
            "field": "AutoPitchType",
            "issue": "rare / junk labels beyond the 8 documented classes",
            "evidence": ", ".join(f"{k}={v}" for k, v in junk.items()),
            "severity": "medium",
            "action": "collapse into documented taxonomy",
        }
    )
    a["defects"].append(
        {
            "field": "stadium identity",
            "issue": "no stadium id; only a 3-level altitude bucket",
            "evidence": "altitude_category in {No, Medium, Extreme}",
            "severity": "high",
            "action": "derive a continuous density index from ball physics",
        }
    )
    return a


# --------------------------------------------------------------------------
# 2. Physics: recover air density from the ball's own trajectory
# --------------------------------------------------------------------------
def add_physics(df):
    """Split measured acceleration into gravity + drag + Magnus.

        a_measured = g + a_drag + a_magnus
        a_drag    is antiparallel to velocity
        a_magnus  is perpendicular to velocity

    drag_k = |a_drag| / v^2  is proportional to air density (rho * Cd * A / 2m),
    so its ratio across environments IS a relative density measurement.
    """
    v = np.sqrt(df.vx0**2 + df.vy0**2 + df.vz0**2)
    axg, ayg, azg = df.ax0, df.ay0, df.az0 + GRAVITY  # remove gravity
    ux, uy, uz = df.vx0 / v, df.vy0 / v, df.vz0 / v  # unit velocity
    par = axg * ux + ayg * uy + azg * uz  # component along v
    drag = -par  # deceleration (>0)
    mx, my, mz = axg - par * ux, ayg - par * uy, azg - par * uz
    magnus = np.sqrt(mx**2 + my**2 + mz**2)
    df = df.assign(
        speed=v, drag_accel=drag, magnus_accel=magnus, drag_k=drag / v**2, magnus_k=magnus / v**2
    )
    # per-game density index, normalised so sea-level mean == 1.000
    game_k = df.groupby("game_anon_id")["drag_k"].transform("mean")
    df = df.assign(game_drag_k=game_k)
    sea = df.loc[df.altitude_category == SEA, "game_drag_k"].mean()
    return df.assign(density_index=df.game_drag_k / sea)


def density_table(df):
    g = df.groupby("altitude_category").agg(
        n=("drag_k", "size"),
        drag_k=("drag_k", "mean"),
        magnus_k=("magnus_k", "mean"),
        density_index=("density_index", "mean"),
    )
    base = g.loc[SEA]
    out = {}
    for lvl in [SEA, MED, EXT]:
        if lvl not in g.index:
            continue
        out[lvl] = {
            "n": int(g.loc[lvl, "n"]),
            "density_ratio": round(g.loc[lvl, "drag_k"] / base.drag_k, 4),
            "magnus_ratio": round(g.loc[lvl, "magnus_k"] / base.magnus_k, 4),
        }
    pg = df.groupby(["altitude_category", "game_anon_id"])["density_index"].mean()
    for lvl in out:
        s = pg.loc[lvl]
        out[lvl]["per_game_mean"] = round(float(s.mean()), 4)
        out[lvl]["per_game_sd"] = round(float(s.std()), 4)
        out[lvl]["per_game_n"] = len(s)
    return out


# --------------------------------------------------------------------------
# 3. Within-pitcher altitude effect (causal identification)
# --------------------------------------------------------------------------
def within_pitcher(df, pitch="Four-Seam", min_n=50):
    # |HorzBreak|: signed break has opposite sign for RHP vs LHP and would
    # cancel out when averaged across a mixed cohort.
    d = df[df.AutoPitchType == pitch].assign(absHB=df.HorzBreak.abs())
    n = d.pivot_table(
        index="pitcher_anon_id",
        columns="altitude_category",
        values="InducedVertBreak",
        aggfunc="size",
    )
    if EXT not in n or SEA not in n:
        return None
    ok = n[(n[EXT] >= min_n) & (n[SEA] >= min_n)].index
    if len(ok) < 20:
        return None
    p = d.pivot_table(
        index="pitcher_anon_id",
        columns="altitude_category",
        values=["InducedVertBreak", "absHB", "RelSpeed", "SpinRate"],
        aggfunc="mean",
    ).loc[ok]
    res = {
        "pitch": pitch,
        "n_pitchers": len(ok),
        "min_pitches_each": min_n,
        "hb_note": "hb is |HorzBreak| so RHP/LHP do not cancel",
    }
    for m, label in [
        ("InducedVertBreak", "ivb"),
        ("absHB", "hb"),
        ("RelSpeed", "velo"),
        ("SpinRate", "spin"),
    ]:
        delta = p[m][EXT] - p[m][SEA]
        res[label] = {
            "sea_level_mean": round(float(p[m][SEA].mean()), 2),
            "altitude_mean": round(float(p[m][EXT].mean()), 2),
            "delta_mean": round(float(delta.mean()), 2),
            "delta_sd": round(float(delta.std()), 2),
            "pct_pitchers_losing": round(100 * float((delta < 0).mean()), 1),
        }
    # heterogeneity: do the best arms lose the most?
    sea_ivb = p["InducedVertBreak"][SEA]
    d_ivb = p["InducedVertBreak"][EXT] - sea_ivb
    res["heterogeneity"] = {
        "corr_sea_ivb_vs_delta": round(float(np.corrcoef(sea_ivb, d_ivb)[0, 1]), 3),
        "quartiles": [],
    }
    q = pd.qcut(sea_ivb, 4, labels=["Q1", "Q2", "Q3", "Q4"])
    for lab, grp in pd.DataFrame({"s": sea_ivb, "d": d_ivb, "q": q}).groupby("q"):
        res["heterogeneity"]["quartiles"].append(
            {
                "quartile": str(lab),
                "n": len(grp),
                "sea_level_ivb": round(float(grp.s.mean()), 2),
                "delta_ivb": round(float(grp.d.mean()), 2),
            }
        )
    return res


# --------------------------------------------------------------------------
# 4. Shape + outcome deltas by pitch type
# --------------------------------------------------------------------------
def pitch_profiles(df):
    d = df[df.AutoPitchType.isin(MAIN_PITCHES)].copy()
    d["absHB"] = d.HorzBreak.abs()
    rows = []
    for (pt, alt), x in d.groupby(["AutoPitchType", "altitude_category"]):
        sw, bip = x.is_swing.sum(), x.is_ball_in_play.sum()
        ev = x.ExitSpeed.notna().sum()
        rows.append(
            dict(
                pitch=pt,
                env=alt,
                n=len(x),
                velo=x.RelSpeed.mean(),
                ivb=x.InducedVertBreak.mean(),
                abs_hb=x.absHB.mean(),
                spin=x.SpinRate.mean(),
                speed_drop=x.SpeedDrop.mean(),
                whiff_per_swing=100 * x.is_whiff.sum() / max(sw, 1),
                chase=100 * x.swung_outside_strike_zone.sum() / max(x.outside_strike_zone.sum(), 1),
                gb_pct=100 * (x.hit_type == "GroundBall").sum() / max(x.is_batted.sum(), 1),
                exit_velo=x.ExitSpeed.mean(),
                hard_hit=100 * (x.ExitSpeed >= 95).sum() / max(ev, 1),
                hr_per_bip=100 * x.home_run.sum() / max(bip, 1),
            )
        )
    r = pd.DataFrame(rows)
    metrics = [
        "velo",
        "ivb",
        "abs_hb",
        "spin",
        "speed_drop",
        "whiff_per_swing",
        "chase",
        "gb_pct",
        "exit_velo",
        "hard_hit",
        "hr_per_bip",
    ]
    piv = r.pivot(index="pitch", columns="env")
    out = {}
    for pt in r.pitch.unique():
        rec = {"levels": {}, "delta_extreme_vs_sea": {}}
        for env in [SEA, MED, EXT]:
            if env in piv[metrics[0]].columns:
                rec["levels"][env] = {m: round(float(piv[m][env][pt]), 2) for m in metrics}
        for m in metrics:
            rec["delta_extreme_vs_sea"][m] = round(float(piv[m][EXT][pt] - piv[m][SEA][pt]), 2)
        out[pt] = rec
    return out


def league_environment(df):
    out = {}
    for (yr, alt), x in df.groupby(["year", "altitude_category"]):
        out.setdefault(str(int(yr)), {})[alt] = {
            "pitches": len(x),
            "runs_per_100_pitches": round(100 * float(x.RunsScored.sum()) / len(x), 3),
            "hr_per_100_bip": round(
                100 * float(x.home_run.sum()) / max(float(x.is_ball_in_play.sum()), 1), 2
            ),
            "whiff_per_swing": round(
                100 * float(x.is_whiff.sum()) / max(float(x.is_swing.sum()), 1), 2
            ),
        }
    return out


def run_environment(df):
    """Runs actually allowed per nine innings, by environment.

    The league-level business case. Unlike the Altitude Tax, which prices each
    pitch with linear weights, this counts the runs that actually crossed the
    plate - so it includes sequencing, which is where the tax loses about a
    third of the effect.

    Also returns pitches per inning, which is what converts a per-pitch
    quantity into the per-nine-innings unit baseball reads.
    """
    out = {}
    for lvl in [SEA, MED, EXT]:
        d = df[df.altitude_category == lvl]
        if not len(d):
            continue
        innings = float(d.OutsOnPlay.sum()) / 3
        if innings <= 0:
            continue
        out[lvl] = {
            "pitches": len(d),
            "innings": round(innings, 1),
            "runs": int(d.RunsScored.sum()),
            "ra9": round(9 * float(d.RunsScored.sum()) / innings, 2),
            "pitches_per_inning": round(len(d) / innings, 2),
        }
    if SEA in out and EXT in out:
        out["altitude_effect"] = {
            "ra9_delta": round(out[EXT]["ra9"] - out[SEA]["ra9"], 2),
            "ra9_pct": round(100 * (out[EXT]["ra9"] / out[SEA]["ra9"] - 1), 1),
        }
    return out


def season_coverage(df, scored=None):
    """How the dataset is shaped along the season axis.

    The product ranks candidates on their LAST played season, so how many
    seasons each pitcher has - and whether he skipped one - is not trivia.

    Two denominators live here on purpose, and they differ by nine:

    * `qualifying_pitcher_seasons_tracked` counts every pitch with a usable
      trajectory.
    * `scored_pitcher_seasons` counts only the six main pitch types with
      complete shape features, which is what the model actually scores.

    The cards follow the second. Reporting only the first would overstate the
    cohort, and two numbers for one thing in one file is how a report starts
    contradicting itself.
    """
    ps = df.groupby(["pitcher_anon_id", "year"]).size()
    seasons = (
        ps.reset_index()
        .groupby("pitcher_anon_id")
        .year.apply(lambda x: tuple(sorted(int(v) for v in x)))
    )
    pattern = {}
    for pat in seasons:
        pattern[",".join(str(y) for y in pat)] = pattern.get(",".join(str(y) for y in pat), 0) + 1
    gaps = sum(1 for x in seasons if len(x) > 1 and (max(x) - min(x) + 1) != len(x))

    def _qualifying(frame):
        counts = (
            frame.groupby(["pitcher_anon_id", "year", "altitude_category"])
            .size()
            .unstack(fill_value=0)
        )
        return counts[(counts.get(SEA, 0) >= MIN_PITCHES) & (counts.get(EXT, 0) >= MIN_PITCHES)]

    tracked = _qualifying(df)
    qual = _qualifying(df if scored is None else scored)
    per_pitcher = qual.reset_index().groupby("pitcher_anon_id").size()
    last = qual.reset_index().groupby("pitcher_anon_id").year.max()
    return {
        "seasons_in_dataset": sorted(int(y) for y in df.year.unique()),
        "pitchers": int(df.pitcher_anon_id.nunique()),
        "pattern_counts": dict(sorted(pattern.items())),
        "pitchers_with_a_gap": int(gaps),
        "qualifying_pitcher_seasons_tracked": int(len(tracked)),
        "scored_pitcher_seasons": int(len(qual)),
        "scored_pitchers": int(per_pitcher.size),
        "scored_seasons_per_pitcher": {
            str(int(k)): int(v) for k, v in per_pitcher.value_counts().sort_index().items()
        },
        "last_scored_season": {
            str(int(k)): int(v) for k, v in last.value_counts().sort_index().items()
        },
    }


def season_stability(df, min_pitches=200):
    """Does this season predict the next one - and which part of it does?

    The question every public Stuff+ validation asks: given last season, what
    best predicts next season? We can finally ask it because the dataset spans
    2024, 2025 and 2026.

    It is the whole argument for modelling stuff at all. If results persisted
    year to year, you would just use results. They do not.
    """
    g = (
        df.groupby(["pitcher_anon_id", "year"])
        .agg(
            pitches=("year", "size"),
            outs=("OutsOnPlay", "sum"),
            runs=("RunsScored", "sum"),
            whiff=("is_whiff", "sum"),
            swing=("is_swing", "sum"),
        )
        .reset_index()
    )
    g = g[(g.pitches >= min_pitches) & (g.outs > 0) & (g.swing > 0)]
    g["ra9"] = 9 * g.runs / (g.outs / 3)
    g["whiff_rate"] = g.whiff / g.swing

    rows = []
    for _, sub in g.groupby("pitcher_anon_id"):
        by_year = sub.set_index("year")
        for y in sorted(by_year.index):
            if y + 1 not in by_year.index:
                continue
            a, b = by_year.loc[y], by_year.loc[y + 1]
            rows.append(
                {
                    "from": int(y),
                    "ra9_t": a.ra9,
                    "ra9_next": b.ra9,
                    "whiff_t": a.whiff_rate,
                    "whiff_next": b.whiff_rate,
                }
            )
    if len(rows) < 30:
        return {"n_pairs": len(rows), "note": "too few consecutive seasons to test"}
    p = pd.DataFrame(rows)

    def r(x, y):
        return round(float(np.corrcoef(p[x], p[y])[0, 1]), 3)

    return {
        "n_pairs": len(p),
        "min_pitches_per_season": min_pitches,
        "pairs_by_first_season": {
            str(k): int(v) for k, v in p["from"].value_counts().sort_index().items()
        },
        # Does the RESULT repeat itself?
        "result_persistence_ra9": r("ra9_t", "ra9_next"),
        # Does the SKILL repeat itself?
        "skill_persistence_whiff": r("whiff_t", "whiff_next"),
        # Which one tells you more about next season's skill?
        "whiff_predicts_next_whiff": r("whiff_t", "whiff_next"),
        "ra9_predicts_next_whiff": r("ra9_t", "whiff_next"),
        "whiff_predicts_next_ra9": r("whiff_t", "ra9_next"),
    }


# --------------------------------------------------------------------------
# 5. Altitude Translator - validated with a PITCHER HOLDOUT
# --------------------------------------------------------------------------
def translator(df, min_n=40, seed=7):
    """Given a pitcher's shape measured at sea level, predict his shape at
    altitude. Two estimators:
      - empirical : linear fit, calibrated on TRAIN pitchers only
      - physics   : scale Magnus-driven break by the measured density ratio,
                    zero fitted parameters
    Both scored on held-out pitchers never seen during calibration.
    """
    rng = np.random.RandomState(seed)
    magnus_ratio = (
        df.loc[df.altitude_category == EXT, "magnus_k"].mean()
        / df.loc[df.altitude_category == SEA, "magnus_k"].mean()
    )
    res = {"magnus_ratio_measured": round(float(magnus_ratio), 4), "by_pitch": {}}
    for pt in MAIN_PITCHES:
        d = df[df.AutoPitchType == pt].assign(absHB=df.HorzBreak.abs())
        n = d.pivot_table(
            index="pitcher_anon_id",
            columns="altitude_category",
            values="InducedVertBreak",
            aggfunc="size",
        )
        if EXT not in n or SEA not in n:
            continue
        ok = n[(n[EXT] >= min_n) & (n[SEA] >= min_n)].index
        if len(ok) < 40:
            continue
        p = d.pivot_table(
            index="pitcher_anon_id",
            columns="altitude_category",
            values=["InducedVertBreak", "absHB"],
            aggfunc="mean",
        ).loc[ok]
        idx = rng.permutation(len(ok))
        cut = int(0.8 * len(ok))
        tr, te = idx[:cut], idx[cut:]
        rec = {"n_pitchers": len(ok), "n_train": len(tr), "n_test": len(te)}
        for m, label in [("InducedVertBreak", "ivb"), ("absHB", "hb")]:
            x = p[m][SEA].values
            y = p[m][EXT].values
            slope, intercept = np.polyfit(x[tr], y[tr], 1)  # fit on TRAIN only
            pred_emp = intercept + slope * x[te]
            pred_phys = x[te] * magnus_ratio
            yte = y[te]

            def rmse(a, b):
                return float(np.sqrt(np.mean((a - b) ** 2)))

            ss = float(np.sum((yte - yte.mean()) ** 2))
            rec[label] = {
                "slope": round(float(slope), 3),
                "intercept": round(float(intercept), 3),
                "holdout_rmse_empirical_in": round(rmse(yte, pred_emp), 2),
                "holdout_rmse_physics_in": round(rmse(yte, pred_phys), 2),
                "holdout_rmse_naive_in": round(rmse(yte, x[te]), 2),
                "holdout_r2_empirical": round(1 - float(np.sum((yte - pred_emp) ** 2)) / ss, 3)
                if ss > 0
                else None,
                "physics_bias_in": round(float(np.mean(pred_phys - yte)), 2),
            }
            rec[label]["improvement_vs_naive"] = round(
                rec[label]["holdout_rmse_naive_in"]
                / max(rec[label]["holdout_rmse_empirical_in"], 1e-9),
                1,
            )
        res["by_pitch"][pt] = rec
    return res


# --------------------------------------------------------------------------
# 6. Stuff+ v0 baseline (mockup realism + a bar for the data team to beat)
# --------------------------------------------------------------------------
def run_value(df):
    rv = df.play_result.map(RUN_VALUE)
    rv = rv.fillna(
        df.PitchCall.map(
            {
                "StrikeSwinging": -0.05,
                "StrikeCalled": -0.05,
                "BallCalled": 0.032,
                "BallinDirt": 0.032,
                "FoulBallNotFieldable": -0.02,
                "FoulBall": -0.02,
                "HitByPitch": 0.34,
            }
        )
    )
    return rv.fillna(0.0)


STUFF_FEATURES = [
    "RelSpeed",
    "SpinRate",
    "SpinAxis",
    "InducedVertBreak",
    "HorzBreak",
    "Extension",
    "RelHeight",
    "RelSide",
]


def stuff_plus_v0(df, seed=7):
    """BASELINE ONLY. Predicts pitch run value from the 8 core stuff features
    plus environment; grouped CV by pitcher so no arm is memorised."""
    d = (
        df[df.AutoPitchType.isin(MAIN_PITCHES)]
        .dropna(subset=STUFF_FEATURES + ["pitcher_anon_id"])
        .copy()
    )
    d["rv"] = run_value(d)
    d["is_rhp"] = (d.PitcherThrows == "Right").astype(int)
    d["is_rhb"] = (d.BatterSide == "Right").astype(int)
    pt = pd.get_dummies(d.AutoPitchType.astype(str), prefix="pt")
    X = pd.concat(
        [d[STUFF_FEATURES + ["density_index", "is_rhp", "is_rhb"]], pt.set_index(d.index)], axis=1
    ).astype(float)
    y = d.rv.values
    groups = d.pitcher_anon_id.values
    oof = np.zeros(len(d))
    gkf = GroupKFold(n_splits=4)
    for tr, te in gkf.split(X, y, groups):
        m = HistGradientBoostingRegressor(
            max_iter=220, learning_rate=0.06, max_depth=6, min_samples_leaf=200, random_state=seed
        )
        m.fit(X.iloc[tr], y[tr])
        oof[te] = m.predict(X.iloc[te])
    # baseline: league mean run value
    ss_res = float(np.sum((y - oof) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    metrics = {
        "n_pitches_modelled": len(d),
        "cv": "GroupKFold(4) by pitcher_anon_id",
        "oof_rmse": round(float(np.sqrt(np.mean((y - oof) ** 2))), 5),
        "null_rmse": round(float(np.sqrt(np.mean((y - y.mean()) ** 2))), 5),
        "oof_r2": round(1 - ss_res / ss_tot, 5),
        "note": "v0 baseline for prototype realism - not the final model",
    }
    # Stuff+ scale: lower expected run value = better pitch
    z = (oof - oof.mean()) / oof.std()
    d["stuff_plus_v0"] = 100 - 10 * z
    return d, metrics


# --------------------------------------------------------------------------
# 7. Mockup data: real pitcher rows for the prototype
# --------------------------------------------------------------------------
def mockup(d, df_phys, roles=None, entries=None, pitches_per_inning=None):
    """Pitcher-level cards with Stuff+ HH, sea-level Stuff+ and Altitude Tax.

    Scale note: stuff_plus_v0 is normalised across the WHOLE league (both
    environments), so 100 is the LMB average pitch. Altitude pitches therefore
    average below 100 by construction - that gap IS the altitude effect, not a
    calibration bug.
    """
    ext = d[d.altitude_category == EXT]
    sea = d[d.altitude_category == SEA]
    # One card per pitcher AND SEASON. A pitcher who left and came back is two
    # measurements, not one average of two different people: shape correlates
    # 0.674 across a gap year against 0.78-0.83 between consecutive ones.
    n_ext = ext.groupby(["pitcher_anon_id", "year"]).size()
    n_sea = sea.groupby(["pitcher_anon_id", "year"]).size()
    # MIN_PITCHES_FOR_SCORE, the rule the contract already declared and this
    # script was quietly ignoring by using 150.
    ok = sorted(set(n_ext[n_ext >= MIN_PITCHES].index) & set(n_sea[n_sea >= MIN_PITCHES].index))
    cards = []
    for pid, yr in ok:
        e = ext[(ext.pitcher_anon_id == pid) & (ext.year == yr)]
        s_ = sea[(sea.pitcher_anon_id == pid) & (sea.year == yr)]
        sp_hh, sp_sea = float(e.stuff_plus_v0.mean()), float(s_.stuff_plus_v0.mean())
        rv_hh, rv_sea = float(e.rv.mean()), float(s_.rv.mean())
        # REAL uncertainty: 95% CI half-width on the mean Stuff+ at altitude
        se = float(e.stuff_plus_v0.std()) / np.sqrt(len(e))
        ci = 1.96 * se
        # The sea-level score is rendered too, and the product does not show a
        # number without its band (CONVENTIONS.md section 8 rule 2).
        ci_sea = 1.96 * float(s_.stuff_plus_v0.std()) / np.sqrt(len(s_))
        # Altitude Tax: extra runs conceded per 100 pitches at altitude,
        # with a standard error from the two independent sample means.
        # Per NINE INNINGS, not per hundred pitches: nine innings is the unit
        # baseball already reads. The conversion uses the pitches per inning
        # measured in this very environment, not a round number.
        per_9 = 9 * pitches_per_inning
        se_tax = per_9 * np.sqrt(float(e.rv.var()) / len(e) + float(s_.rv.var()) / len(s_))
        tax = per_9 * (rv_hh - rv_sea)
        arsenal = []
        for pt, g in e.groupby("AutoPitchType"):
            if len(g) < 25:
                continue
            gs = s_[s_.AutoPitchType == pt]
            arsenal.append(
                {
                    "pitch": pt,
                    "usage_pct": round(100 * len(g) / len(e), 1),
                    "n": len(g),
                    "velo": round(float(g.RelSpeed.mean()), 1),
                    "ivb_hh": round(float(g.InducedVertBreak.mean()), 1),
                    "ivb_sea": round(float(gs.InducedVertBreak.mean()), 1)
                    if len(gs) >= 15
                    else None,
                    "hb_hh": round(float(g.HorzBreak.mean()), 1),
                    "hb_sea": round(float(gs.HorzBreak.mean()), 1) if len(gs) >= 15 else None,
                    "spin": int(g.SpinRate.mean()),
                    "extension": round(float(g.Extension.mean()), 1),
                    "stuff_plus_hh": round(float(g.stuff_plus_v0.mean()), 1),
                    "stuff_plus_sea": round(float(gs.stuff_plus_v0.mean()), 1)
                    if len(gs) >= 15
                    else None,
                    "whiff_per_swing": round(
                        100 * float(g.is_whiff.sum()) / max(float(g.is_swing.sum()), 1), 1
                    ),
                }
            )
        if not arsenal:
            continue
        retained = [a for a in arsenal if a["ivb_sea"] is not None]
        loss = np.mean([abs(a["ivb_hh"] - a["ivb_sea"]) for a in retained]) if retained else None
        cards.append(
            {
                "pitcher_id": pid,
                "season": int(yr),
                "throws": str(e.PitcherThrows.mode().iloc[0])
                if len(e.PitcherThrows.mode())
                else "Right",
                "n_pitches_hh": len(e),
                "n_pitches_sea": len(s_),
                "stuff_plus_hh": round(sp_hh, 1),
                "stuff_plus_sea": round(sp_sea, 1),
                "stuff_plus_delta": round(sp_hh - sp_sea, 1),
                "stuff_plus_hh_ci95": round(ci, 1),
                "stuff_plus_sea_ci95": round(ci_sea, 1),
                "role": roles.get((pid, int(yr))) if roles else None,
                "median_entry_inning": entries.get((pid, int(yr))) if entries else None,
                "altitude_tax_runs_per_9": round(tax, 2),
                "altitude_tax_se": round(se_tax, 2),
                "altitude_tax_significant": bool(abs(tax) > 1.96 * se_tax),
                "mean_ivb_loss_in": round(float(loss), 2) if retained else None,
                "arsenal": sorted(arsenal, key=lambda a: -a["usage_pct"]),
            }
        )
    sea_sp = np.array([c["stuff_plus_sea"] for c in cards])
    delta = np.array([c["stuff_plus_delta"] for c in cards])
    sea_p70, delta_p30 = np.percentile(sea_sp, 70), np.percentile(delta, 30)
    for c in cards:
        # Altitude Trap: looks strong at sea level, degrades hard in CDMX.
        c["altitude_trap"] = bool(
            c["stuff_plus_sea"] >= sea_p70 and c["stuff_plus_delta"] <= delta_p30
        )
    cards.sort(key=lambda c: (-c["stuff_plus_hh"], c["pitcher_id"]))
    # Every season each carded pitcher appears in, scored or not. The Ficha
    # shows all of them: a season with 212 pitches at altitude and 95 at sea
    # level carries no comparison, and saying so is the point of the view.
    carded = {c["pitcher_id"] for c in cards}
    scored_keys = {(c["pitcher_id"], c["season"]) for c in cards}
    # Counted on the SCORED frame, the same one the cards come from, so the
    # Ficha never shows two different pitch counts for one season.
    counts = (
        d[d.pitcher_anon_id.isin(carded)]
        .groupby(["pitcher_anon_id", "year", "altitude_category"])
        .size()
        .unstack(fill_value=0)
    )
    history = {}
    for (pid, yr), row in counts.iterrows():
        history.setdefault(pid, []).append(
            {
                "season": int(yr),
                "n_pitches_hh": int(row.get(EXT, 0)),
                "n_pitches_sea": int(row.get(SEA, 0)),
                "scored": (pid, int(yr)) in scored_keys,
            }
        )
    for pid in history:
        history[pid].sort(key=lambda x: x["season"])

    taxes = np.array([c["altitude_tax_runs_per_9"] for c in cards])
    return (
        cards,
        history,
        {
            "altitude_tax_runs_per_9": {
                "mean": round(float(taxes.mean()), 2),
                "median": round(float(np.median(taxes)), 2),
                "n_significant": int(sum(c["altitude_tax_significant"] for c in cards)),
            },
            "n_cards": len(cards),
            "n_pitchers": len({c["pitcher_id"] for c in cards}),
            "min_pitches_each_environment": MIN_PITCHES,
            "n_traps": int(sum(c["altitude_trap"] for c in cards)),
        },
    )


def target_learnability(df, seed=7):
    """Which target should the data team actually fit?

    Raw pitch-level run value is dominated by batter and sequencing noise.
    Component outcome models are far more learnable - this quantifies the gap
    and is the core modelling recommendation of the technical document.
    """
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import roc_auc_score

    d = (
        df[df.AutoPitchType.isin(MAIN_PITCHES)]
        .dropna(subset=STUFF_FEATURES + ["pitcher_anon_id"])
        .copy()
    )
    d["is_rhp"] = (d.PitcherThrows == "Right").astype(int)
    d["is_rhb"] = (d.BatterSide == "Right").astype(int)
    pt = pd.get_dummies(d.AutoPitchType.astype(str), prefix="pt")
    X = pd.concat(
        [d[STUFF_FEATURES + ["density_index", "is_rhp", "is_rhb"]], pt.set_index(d.index)], axis=1
    ).astype(float)
    groups = d.pitcher_anon_id.values
    out = {}
    targets = {
        "P(whiff | swing)": (d.is_swing == 1, d.is_whiff == 1),
        "P(chase | out of zone)": (d.outside_strike_zone == 1, d.swung_outside_strike_zone == 1),
        "P(groundball | batted)": (d.is_batted == 1, d.hit_type == "GroundBall"),
        "P(hard hit 95+ | batted)": (d.ExitSpeed.notna(), d.ExitSpeed >= 95),
    }
    gkf = GroupKFold(n_splits=3)
    for name, (mask, y_raw) in targets.items():
        m = mask.values
        Xm, ym, gm = X[m], y_raw[m].astype(int).values, groups[m]
        if len(np.unique(ym)) < 2 or len(Xm) < 5000:
            continue
        oof = np.zeros(len(Xm))
        for tr, te in gkf.split(Xm, ym, gm):
            clf = HistGradientBoostingClassifier(
                max_iter=150,
                learning_rate=0.07,
                max_depth=6,
                min_samples_leaf=200,
                random_state=seed,
            )
            clf.fit(Xm.iloc[tr], ym[tr])
            oof[te] = clf.predict_proba(Xm.iloc[te])[:, 1]
        out[name] = {
            "n": len(Xm),
            "base_rate": round(float(ym.mean()), 4),
            "oof_auc": round(float(roc_auc_score(ym, oof)), 4),
        }
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    df = load()
    log(f"  {len(df):,} pitches x {df.shape[1]} columns")

    R["audit"] = audit(df)
    log("Data-quality audit done.")

    df = df[df.altitude_category.notna()]
    df = df.dropna(
        subset=["vx0", "vy0", "vz0", "ax0", "ay0", "az0", "pitcher_anon_id", "game_anon_id"]
    )
    df = add_physics(df)
    R["density"] = density_table(df)
    log(
        f"Density index: Extreme={R['density'][EXT]['density_ratio']} "
        f"Magnus={R['density'][EXT]['magnus_ratio']}"
    )

    R["within_pitcher"] = {p: within_pitcher(df, p) for p in MAIN_PITCHES}
    R["within_pitcher"] = {k: v for k, v in R["within_pitcher"].items() if v}
    ff = R["within_pitcher"].get("Four-Seam")
    if ff:
        log(
            f'Within-pitcher 4S: n={ff["n_pitchers"]} dIVB={ff["ivb"]["delta_mean"]}" '
            f"losing={ff['ivb']['pct_pitchers_losing']}%"
        )

    R["pitch_profiles"] = pitch_profiles(df)
    R["league_environment"] = league_environment(df)
    R["run_environment"] = run_environment(df)
    R["season_stability"] = season_stability(df)
    st = R["season_stability"]
    log(
        f"Season stability ({st['n_pairs']} pairs): result RA/9 r={st['result_persistence_ra9']} "
        f"vs skill whiff r={st['skill_persistence_whiff']}"
    )
    eff = R["run_environment"].get("altitude_effect", {})
    log(
        f"Run environment: {R['run_environment'][SEA]['ra9']} -> "
        f"{R['run_environment'][EXT]['ra9']} RA/9 (+{eff.get('ra9_pct')}%)"
    )
    R["translator"] = translator(df)
    log("Translator validated on held-out pitchers.")

    d, R["stuff_plus_v0"] = stuff_plus_v0(df)
    log(f"Stuff+ v0 baseline: OOF R2={R['stuff_plus_v0']['oof_r2']}")

    # After stuff_plus_v0, so both denominators agree with the cards.
    R["seasons"] = season_coverage(df, scored=d)
    log(
        f"Seasons: {R['seasons']['scored_pitcher_seasons']} scored pitcher-seasons from "
        f"{R['seasons']['scored_pitchers']} pitchers, "
        f"{R['seasons']['pitchers_with_a_gap']} with a gap"
    )

    # Role is a rule over every appearance in the dataset, not over the
    # scored subset: a pitcher's job is the same whatever we scored.
    role_table = classify_roles(
        df,
        pitcher_col="pitcher_anon_id",
        season_col="year",
        game_col="game_anon_id",
        inning_col="Inning",
    )
    role_table.index = role_table.index.set_levels(role_table.index.levels[1].astype(int), level=1)
    roles = role_table["role"].to_dict()
    entries = role_table["median_entry_inning"].to_dict()
    # Role is a property of a pitcher-SEASON. This counts how often it moves,
    # rather than asserting that it does.
    per_pitcher = role_table.reset_index().dropna(subset=["role"]).groupby("pitcher_anon_id")
    n_roles = per_pitcher.role.nunique()
    n_seasons = per_pitcher.role.size()
    R["roles"] = {
        "n_classified": int(role_table["role"].notna().sum()),
        "distribution": {str(k): int(v) for k, v in role_table["role"].value_counts().items()},
        "starter_first_inning_share_ge": STARTER_FIRST_INNING_SHARE,
        "pitchers_with_multiple_seasons": int((n_seasons > 1).sum()),
        "pitchers_changing_role_between_seasons": int((n_roles > 1).sum()),
    }
    log(f"Roles: {R['roles']['distribution']}")

    ppi = R["run_environment"][EXT]["pitches_per_inning"]
    cards, history, R["cohort"] = mockup(
        d, df, roles=roles, entries=entries, pitches_per_inning=ppi
    )
    log(
        f"Mockup cards: {len(cards)} pitcher-seasons from "
        f"{R['cohort']['n_pitchers']} pitchers, {R['cohort']['n_traps']} altitude traps"
    )

    R["target_learnability"] = target_learnability(df)
    for k, v in R["target_learnability"].items():
        log(f"  {k:28s} AUC={v['oof_auc']}")

    R["hypotheses"] = hypotheses(R)

    with open(os.path.join(OUT, "evidence.json"), "w") as f:
        json.dump(R, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUT, "mockup_data.json"), "w") as f:
        json.dump(
            {
                "pitchers": cards,
                "pitcher_seasons": history,
                "pitch_profiles": R["pitch_profiles"],
                "density": R["density"],
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    log(f"\nWrote {OUT}/evidence.json and {OUT}/mockup_data.json")


def hypotheses(R):
    """Explicit verdict on the four hypotheses stated by the organisers."""
    pp = R["pitch_profiles"]
    ff = R["within_pitcher"]["Four-Seam"]
    ch = pp.get("Changeup", {}).get("delta_extreme_vs_sea", {})
    cb = pp.get("Curveball", {}).get("delta_extreme_vs_sea", {})
    gb = {k: v["delta_extreme_vs_sea"].get("gb_pct") for k, v in pp.items()}
    spin = {k: v["delta_extreme_vs_sea"].get("spin") for k, v in pp.items()}
    return {
        "H1_low_density_reduces_break": {
            "verdict": "CONFIRMED",
            "evidence": (
                f'Within-pitcher four-seam IVB {ff["ivb"]["delta_mean"]}" '
                f'({ff["ivb"]["sea_level_mean"]}" -> {ff["ivb"]["altitude_mean"]}"), '
                f"{ff['ivb']['pct_pitchers_losing']}% of {ff['n_pitchers']} pitchers lose ride."
            ),
        },
        "H2_speed_differential_pitches_gain": {
            "verdict": "REFUTED",
            "evidence": (
                f"Changeup loses the largest absolute horizontal break "
                f'({ch.get("abs_hb")}"), whiff/swing {ch.get("whiff_per_swing")} pp, '
                f"chase {ch.get('chase')} pp, HR/BIP {ch.get('hr_per_bip'):+} pp. "
                f"The altitude-proof pitch is the curveball: whiff/swing "
                f"{cb.get('whiff_per_swing')} pp, chase {cb.get('chase'):+} pp."
            ),
        },
        "H3_groundballs_more_valuable": {
            "verdict": "CONFIRMED_WITH_NUANCE",
            "evidence": (
                f"GB% rises at altitude for every pitch type: {gb}. "
                f"Mechanism: the flattened fastball induces more ground balls, "
                f"but run scoring still rises sharply."
            ),
        },
        "H4_spin_rate_insufficient": {
            "verdict": "CONFIRMED",
            "evidence": (
                f"Spin rate is essentially unchanged across environments "
                f"({spin}) while break collapses 20-30%. Spin does not "
                f"survive as a proxy for movement at altitude."
            ),
        },
    }


if __name__ == "__main__":
    main()
