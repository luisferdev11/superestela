"""Fit the v0 bridge on the real data and run the simulator's acceptance gates.

    uv run python analysis/simulator_gates.py              # ~1 min
    uv run python analysis/simulator_gates.py --publish    # also updates the record

Writes the fitted model and its verdict side by side in artifacts/, which is
never committed: stuff_plus_v0_bridge.joblib and
stuff_plus_v0_bridge.validation.json. The API reads the verdict next to the
model it loads, so a model is shown only if the gates judged that very fit, on
that machine. With --publish the verdict is also written to
analysis/outputs/simulator_validation.json, the record that docs/09 section 5.1
and the web's provenance line cite; publish only when the model or the gates
changed, or every run would leave that file dirty with nothing but a new hash. The gates, their reasons and thresholds
are docs/09 section 5; they apply unchanged to any model that answers through
the scoring contract, A3 included (ADR 0007).

Physics gates F1-F5 need no model. Score gates S1-S4 decide display; S5-S7
are reported whatever they say.
"""

import json
import os
import subprocess
import sys

import evidence as E
import numpy as np
import pandas as pd

from core.atmosphere import SEA_LEVEL_PRESSURE_PA, air_density, isa_pressure
from core.density import DENSITY_INDEX_EXTREME, DENSITY_INDEX_SEA_LEVEL
from core.spin import Bounds, Envelope, assess_plausibility
from core.trajectory import approach
from core.translate import BREAK_ERROR_IN, break_scaling_factor
from models.scoring import to_arm_side, verdict_path
from models.stuff.v0_bridge import PITCH_TYPES, BridgeModel, fit_bridge

ARTIFACT = os.path.join(E.ROOT, "artifacts", "stuff_plus_v0_bridge.joblib")
# The verdict for the model in artifacts/, read by the API. Never committed.
VERDICT = verdict_path(ARTIFACT)
# The published record, committed; written only with --publish.
VALIDATION = os.path.join(E.OUT, "simulator_validation.json")
DISPLAY_GATES = ("S1", "S2", "S3", "S4")
SEED = 7

# The weather range docs/09 section 2.4 compares against: a Mexico City game
# at 15-25 C and 50% humidity, against a sea-level park at 29 C and 75%.
CDMX_ALTITUDE_M = 2240.0
CDMX_TEMPERATURES_C = (15.0, 25.0)
F3_TOLERANCE = 0.03

# Shapes no pitcher throws, which the plausibility detector must catch (F4).
IMPOSSIBLE = [
    ("Four-Seam", 91.6, 22.0, 9.0, 1500.0, "22 in of ride on 1,500 rpm"),
    ("Four-Seam", 91.6, -6.0, 9.0, 2300.0, "a four-seam that drops like a curve"),
    ("Curveball", 78.0, 15.0, 9.0, 2500.0, "a curveball that rides"),
    ("Changeup", 99.0, 7.0, 14.0, 1800.0, "a changeup at 99 mph"),
]


def canonical(df):
    """Raw vendor columns to the bridge's canonical frame, horizontals on the arm side."""
    d = df[df.AutoPitchType.isin(PITCH_TYPES) & df.PitcherThrows.isin(["Right", "Left"])]
    d = d.dropna(subset=[*E.STUFF_FEATURES, "pitcher_anon_id"])
    hb, side, axis = to_arm_side(d.PitcherThrows, d.HorzBreak, d.RelSide, d.SpinAxis)
    return pd.DataFrame(
        {
            "pitch_type": d.AutoPitchType.astype(str),
            "pitcher_hand": d.PitcherThrows.astype(str),
            "release_speed": d.RelSpeed,
            "spin_rate": d.SpinRate,
            "spin_axis": axis,
            "ivb": d.InducedVertBreak,
            "horizontal_break": hb,
            "extension": d.Extension,
            "release_height": d.RelHeight,
            "release_side": side,
            "density_index": d.density_index,
            "is_same_side": (d.PitcherThrows == d.BatterSide).astype(float),
            "pitcher_id": d.pitcher_anon_id.astype(str),
            "year": d.year.astype(int),
            "environment": d.altitude_category,
            "run_value": E.run_value(d),
            "is_swing": d.is_swing,
            "is_whiff": d.is_whiff,
            "count": d.Balls.astype(int).astype(str) + "-" + d.Strikes.astype(int).astype(str),
            "speed_drop": d.SpeedDrop,
            "vaa": d.VertApprAngle,
            "plate_height": d.PlateLocHeight,
        },
        index=d.index,
    )


def gate(gid, name, value, threshold, passed, note=""):
    return {
        "id": gid,
        "name": name,
        "value": value,
        "threshold": threshold,
        "passed": bool(passed),
        "note": note,
    }


def pitcher_means(frame, keys, min_n):
    cols = [
        "release_speed",
        "spin_rate",
        "spin_axis",
        "ivb",
        "horizontal_break",
        "extension",
        "release_height",
        "release_side",
    ]
    g = frame.groupby(keys)
    means = g[cols].mean().assign(n=g.size(), swings=g.is_swing.sum(), whiffs=g.is_whiff.sum())
    return means[means.n >= min_n]


# ---------------------------------------------------------------- physics
def physics_gates(frame, evidence, simulator):
    k = break_scaling_factor(DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME)
    m = pitcher_means(frame, ["pitch_type", "pitcher_id", "environment"], min_n=40)
    rmse, coverage, counts = {}, {}, {}
    for pt, (ivb_se, hb_se) in BREAK_ERROR_IN.items():
        p = m.loc[pt].unstack("environment")
        p = p.dropna(subset=[("ivb", E.SEA), ("ivb", E.EXT)])
        for axis, se in (("ivb", ivb_se), ("horizontal_break", hb_se)):
            err = p[(axis, E.EXT)] - k * p[(axis, E.SEA)]
            rmse[f"{pt}/{axis}"] = [round(float(np.sqrt((err**2).mean())), 3), se]
            coverage[f"{pt}/{axis}"] = round(float((err.abs() <= se).mean()), 3)
            counts[f"{pt}/{axis}"] = int(err.notna().sum())
    # A band may be wider than the error, never narrower (rounding to 0.01 in).
    f1 = all(v[0] <= v[1] + 0.01 for v in rmse.values())
    # Coverage of a one-sigma band is 68.3% for normal errors, and its sampling
    # error is binomial: 25 cutters give +-9 points, 328 four-seams +-2.6. The
    # first version fixed 60-76% for every sample size; docs/09 section 5 says
    # why it changed. Both verdicts are written out.
    f2_fixed = all(0.60 <= v <= 0.76 for v in coverage.values())
    f2_bands = {}
    for key in coverage:
        n = counts[key]
        half = 2 * np.sqrt(0.683 * 0.317 / n)
        f2_bands[key] = [round(0.683 - half, 3), round(0.683 + half, 3)]
    f2 = all(f2_bands[k][0] <= v <= f2_bands[k][1] for k, v in coverage.items())

    sea = air_density(SEA_LEVEL_PRESSURE_PA, 29.0, 0.75)
    physical = sorted(
        air_density(isa_pressure(CDMX_ALTITUDE_M), t, 0.5) / sea for t in CDMX_TEMPERATURES_C
    )
    magnus = evidence["density"][E.EXT]["magnus_ratio"]
    drag = evidence["density"][E.EXT]["density_ratio"]
    lo, hi = physical[0] - F3_TOLERANCE, physical[1] + F3_TOLERANCE

    plaus = simulator["plausibility"]
    caught = []
    for pt, velo, ivb, hb, spin, label in IMPOSSIBLE:
        e = plaus[pt]
        env = Envelope(
            e["mean"],
            e["inverse_covariance"],
            e["threshold_squared_distance"],
            {n: Bounds(b["low"], b["high"]) for n, b in e["bounds"].items()},
        )
        out = assess_plausibility(velo, ivb, hb, spin, env)
        caught.append(
            {
                "case": label,
                "flagged": not out.is_plausible,
                "squared_distance": round(out.squared_distance, 1),
            }
        )
    fpr = {pt: e["flagged_share_of_real_pitches"] for pt, e in plaus.items()}

    s = frame.dropna(subset=["speed_drop", "vaa", "plate_height"]).sample(50_000, random_state=SEED)
    vaa = [
        approach(
            r.release_speed, r.speed_drop, r.ivb, r.extension, r.release_height, r.plate_height
        ).vaa
        for r in s.itertuples()
    ]
    vaa_rmse = float(np.sqrt(np.mean((np.array(vaa) - s.vaa.to_numpy()) ** 2)))

    return [
        gate(
            "F1",
            "physics translation error on the signed shape, every qualifying pitcher",
            rmse,
            "rmse <= the band the screen shows",
            f1,
            "value per axis: [rmse, band]. The first run failed: bands measured on |HB| over a "
            "20% holdout understated slider and curveball HB, so the bands were re-measured "
            "(core/translate.py), not the gate relaxed",
        ),
        gate(
            "F2",
            "share inside the +-1 band",
            {"coverage": coverage, "accepted_range": f2_bands, "passed_fixed_60_76": f2_fixed},
            "0.683 +- 2 binomial standard errors for the sample",
            f2,
            "above 0.76 the band is conservative (heavy tails inflate the rmse), below 0.60 it "
            "is too narrow; only the second misleads a coach",
        ),
        gate(
            "F3",
            "measured Magnus ratio against textbook air density",
            {
                "magnus_ratio": magnus,
                "drag_index": drag,
                "physical_range": [round(v, 3) for v in physical],
            },
            f"magnus within physical range +- {F3_TOLERANCE}",
            lo <= magnus <= hi,
            "the drag index is reported, not gated: docs/09 section 2.4 argues it is not density",
        ),
        gate(
            "F4",
            "plausibility: false positives on real pitches, and impossible shapes caught",
            {"false_positive_share": fpr, "impossible": caught},
            "every type < 0.02 and every impossible case flagged",
            all(v < 0.02 for v in fpr.values()) and all(c["flagged"] for c in caught),
        ),
        gate(
            "F5",
            "kinematic VAA against the dataset's VertApprAngle",
            round(vaa_rmse, 3),
            "rmse <= 0.5 deg",
            vaa_rmse <= 0.5,
        ),
    ]


# ---------------------------------------------------------------- score
def score_gates(model: BridgeModel, frame, oob):
    rng = np.random.default_rng(SEED)
    stuff = lambda f: model.stuff_plus(f)[0]  # noqa: E731
    ff = frame[(frame.pitch_type == "Four-Seam") & (frame.environment == E.SEA)]
    base = ff.sample(300, random_state=SEED)
    lift = stuff(base.assign(release_speed=base.release_speed + 1.0)) - stuff(base)

    right = frame[frame.pitcher_hand == "Right"].sample(300, random_state=SEED)
    mirrored = right.assign(pitcher_hand="Left")  # arm-side frame: nothing else moves
    mirror = np.abs(stuff(mirrored) - stuff(right))

    jumps = []
    for _, row in ff.sample(50, random_state=SEED + 1).iterrows():
        for col, grid in (
            ("release_speed", np.arange(88.0, 98.01, 0.1)),
            ("ivb", np.arange(10.0, 24.01, 0.1)),
        ):
            sweep = pd.DataFrame([row] * len(grid)).assign(**{col: grid})
            jumps.extend(np.abs(np.diff(stuff(sweep))))
    p99 = float(np.percentile(jumps, 99))

    radar = radar_consistency(model, frame)

    finite = np.isfinite(oob)
    f = frame[finite].assign(oob=oob[finite])
    f = f.assign(stuff=100 - 10 * (f.oob - model.scale.mean_xrv) / model.scale.sd_xrv)
    deciles = f.groupby(pd.qcut(f.stuff, 10, labels=False)).run_value.mean()
    calib = float(pd.Series(range(10)).corr(pd.Series(-deciles.to_numpy()), method="spearman"))

    natural = natural_experiment(model, frame, rng)

    count_mean = f.groupby("count").run_value.transform("mean")
    rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))  # noqa: E731
    null, raw = rmse(f.run_value, count_mean), rmse(f.run_value, f.oob)
    combined = rmse(f.run_value, count_mean + f.oob - f.oob.mean())

    return [
        gate(
            "S1",
            "+1 mph on 300 real sea-level four-seams",
            {
                "mean_delta": round(float(lift.mean()), 3),
                "violation_share": round(float((lift < 0).mean()), 3),
            },
            "mean > 0 and violations <= 0.10",
            lift.mean() > 0 and (lift < 0).mean() <= 0.10,
        ),
        gate(
            "S2",
            "a right-hander's pitch mirrored to a left-hander",
            round(float(mirror.mean()), 4),
            "mean |delta| <= 1",
            mirror.mean() <= 1.0,
            "zero by construction in the arm-side frame; this checks the "
            "pipeline does not leak the hand",
        ),
        gate(
            "S3",
            "Stuff+ jump per slider step (0.1 mph, 0.1 in) on 50 four-seams",
            {"p99": round(p99, 3), "max": round(float(np.max(jumps)), 3)},
            "p99 <= 1.5",
            p99 <= 1.5,
        ),
        gate(
            "S4",
            "simulator score of a real arsenal pitch against the Radar's number",
            radar,
            "r >= 0.9 and mean |delta| <= 3",
            radar["r"] >= 0.9 and radar["mean_abs_delta"] <= 3,
        ),
        gate(
            "S5",
            "calibration: Stuff+ deciles against observed run value, pitcher holdout",
            {
                "spearman": round(calib, 3),
                "run_value_by_decile": [round(float(v), 4) for v in deciles],
            },
            "spearman >= 0.8",
            calib >= 0.8,
        ),
        gate(
            "S6",
            "natural experiment: simulated delta against observed whiff delta",
            natural,
            "correlation > 0 with the 95% interval above zero",
            natural["ci95"][0] > 0,
        ),
        gate(
            "S7",
            "against the challenge's null model, run value by count",
            {
                "rmse_null_count": round(null, 5),
                "rmse_model": round(raw, 5),
                "rmse_count_plus_model": round(combined, 5),
            },
            "rmse_model < rmse_null_count",
            raw < null,
            "rmse_count_plus_model is reported too: whether the physics adds anything on top "
            "of the count, which is the fairer reading for a physics-only score",
        ),
    ]


def radar_consistency(model, frame):
    """Score each Radar arsenal pitch's mean shape the way the simulator will."""
    with open(os.path.join(E.OUT, "mockup_data.json")) as fh:
        cards = json.load(fh)["pitchers"]
    means = pitcher_means(frame, ["pitcher_id", "year", "pitch_type", "environment"], min_n=1)
    rows, radar = [], []
    for c in cards:
        for a in c["arsenal"]:
            for env, key, rho in (
                (E.SEA, "stuff_plus_sea", 1.0),
                (E.EXT, "stuff_plus_hh", DENSITY_INDEX_EXTREME),
            ):
                idx = (c["pitcher_id"], c["season"], a["pitch"], env)
                if a.get(key) is None or idx not in means.index:
                    continue
                rows.append(
                    {**means.loc[idx].to_dict(), "pitch_type": a["pitch"], "density_index": rho}
                )
                radar.append(a[key])
    sim = model.stuff_plus(pd.DataFrame(rows))[0]
    radar = np.array(radar)
    return {
        "n": len(radar),
        "r": round(float(np.corrcoef(sim, radar)[0, 1]), 3),
        "mean_abs_delta": round(float(np.mean(np.abs(sim - radar))), 3),
    }


def natural_experiment(model, frame, rng, min_n=50, min_swings=30):
    """The same arm in two airs: does the simulated loss rank the observed one?"""
    m = pitcher_means(frame, ["pitch_type", "pitcher_id", "environment"], min_n=min_n)
    m = m[m.swings >= min_swings].unstack("environment").dropna(subset=[("n", E.EXT), ("n", E.SEA)])
    sea = m.xs(E.SEA, axis=1, level="environment").reset_index()
    k = break_scaling_factor(DENSITY_INDEX_SEA_LEVEL, DENSITY_INDEX_EXTREME)
    at_sea = model.stuff_plus(sea.assign(density_index=1.0))[0]
    high = model.stuff_plus(
        sea.assign(
            ivb=sea.ivb * k,
            horizontal_break=sea.horizontal_break * k,
            density_index=DENSITY_INDEX_EXTREME,
        )
    )[0]
    simulated = high - at_sea
    whiff = (
        m[("whiffs", E.EXT)] / m[("swings", E.EXT)] - m[("whiffs", E.SEA)] / m[("swings", E.SEA)]
    ).to_numpy()
    r = float(np.corrcoef(simulated, whiff)[0, 1])
    boot = []
    for _ in range(1000):
        i = rng.integers(0, len(whiff), len(whiff))
        boot.append(np.corrcoef(simulated[i], whiff[i])[0, 1])
    return {
        "n_pitcher_pitches": len(whiff),
        "r": round(r, 3),
        "ci95": [
            round(float(np.percentile(boot, 2.5)), 3),
            round(float(np.percentile(boot, 97.5)), 3),
        ],
        "mean_simulated_delta": round(float(simulated.mean()), 2),
        "mean_observed_whiff_delta": round(float(whiff.mean()), 4),
    }


def main():
    df = E.load()
    df = df[df.altitude_category.notna()].dropna(
        subset=["vx0", "vy0", "vz0", "ax0", "ay0", "az0", "pitcher_anon_id", "game_anon_id"]
    )
    frame = canonical(E.add_physics(df))
    with open(os.path.join(E.OUT, "evidence.json")) as fh:
        evidence = json.load(fh)
    with open(os.path.join(E.OUT, "simulator.json")) as fh:
        simulator = json.load(fh)
    E.log(f"Canonical frame: {len(frame):,} pitches")

    sha = subprocess.run(
        ["git", "rev-parse", "--short=7", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    E.log("Fitting the v0 bridge (20 bags by pitcher) ...")
    model, oob = fit_bridge(frame, model_id=f"0.1.0+{sha}", n_bags=20, seed=SEED)
    os.makedirs(os.path.dirname(ARTIFACT), exist_ok=True)
    model.save(ARTIFACT)

    gates = physics_gates(frame, evidence, simulator) + score_gates(model, frame, oob)
    shown = all(g["passed"] for g in gates if g["id"] in DISPLAY_GATES)
    for g in gates:
        E.log(f"  {g['id']} {'PASS' if g['passed'] else 'FAIL'}  {g['name']}: {g['value']}")
    E.log(f"Stuff+ shown in the simulator: {shown}")

    record = {
        "model_id": model.model_id,
        "uses_arsenal": model.uses_arsenal,
        "scale": model.scale.description,
        "display_gates": list(DISPLAY_GATES),
        "stuff_plus_shown": shown,
        "gates": gates,
    }
    targets = [VERDICT, VALIDATION] if "--publish" in sys.argv else [VERDICT]
    for path in targets:
        with open(path, "w") as fh:
            json.dump(record, fh, indent=2, ensure_ascii=False, allow_nan=False)
            fh.write("\n")
        E.log(f"Wrote {os.path.relpath(path, E.ROOT)}")


if __name__ == "__main__":
    main()
