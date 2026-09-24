"""Evidence the pitch simulator reads: slider ranges, the effectiveness map,
the plausibility envelope and the spin-efficiency sensitivity check.

Called from ``evidence.py`` after ``add_physics``, so every figure the
simulator shows comes from the same run as the rest of the evidence
(CONVENTIONS.md section 8.1). The reasoning behind each output is in
docs/09-SIMULADOR.md; the section is cited next to each function.

Horizontal quantities are normalised to the ARM SIDE: a left-hander's
break, release side and spin axis are mirrored into a right-hander's frame,
so one grid serves both hands. In the raw data a right-hander's arm-side
break and release side are positive, and mirroring the axis is 360 - axis.
"""

import numpy as np
import pandas as pd

SEA, EXT = "No Altitude", "Extreme Altitude"
ENVIRONMENTS = [SEA, EXT]

# Slider ranges and context bands: the 5th-95th percentile, docs/09 section 3.
DISTRIBUTION_QUANTILES = [0.05, 0.5, 0.95]

# Effectiveness map, docs/09 section 3.10. Two inches is the resolution a
# coach reads a movement plot at; below 50 swings a cell's rate is noise.
MAP_BIN_IN = 2.0
MAP_MIN_SWINGS = 50
# A pitcher's pitch in one season needs 40 swings before its whiff rate is
# worth ranking; the map marks the top and bottom 10% of those.
EXTREME_MIN_SWINGS = 40
EXTREME_SHARE = 0.10

# Plausibility, docs/09 section 3.4. Bounds checked one quantity at a time let
# combinations nobody throws through: 22 in of ride on 1,500 rpm passes every
# marginal bound (run of 2026-09-23). So the detector is a Mahalanobis distance
# over the four features that must agree - velocity, IVB, HB and spin - with a
# covariance estimated on the central 95% of pitches, because the tails hold
# tracking errors and mislabelled pitches that would inflate it. The threshold
# is the 98.5th percentile of real pitches, which pins gate F4's false-positive
# rate at 1.5% by construction; what F4 then tests is that impossible shapes
# are caught.
PLAUSIBILITY_FEATURES = ["RelSpeed", "InducedVertBreak", "hb_arm", "SpinRate"]
PLAUSIBILITY_CORE_SHARE = 0.95
PLAUSIBILITY_THRESHOLD_QUANTILE = 0.985
# Per-axis bounds are kept to say WHICH quantity is unusual, not to decide.
ENVELOPE_LOW, ENVELOPE_HIGH = 0.0025, 0.9975

# Ball constants for the lift-coefficient inversion, docs/09 section 3.3.
BALL_MASS_KG = 0.1453  # 5.125 oz, the regulation midpoint
BALL_RADIUS_M = 0.03688  # 9.125 in circumference
FT_TO_M = 0.3048


def with_arm_side(df):
    """Return the known-handed pitches with horizontal quantities on the arm side."""
    d = df[df.PitcherThrows.isin(["Right", "Left"])]
    sign = np.where(d.PitcherThrows == "Right", 1.0, -1.0)
    axis = np.where(sign > 0, d.SpinAxis, (360.0 - d.SpinAxis) % 360.0)
    return d.assign(hb_arm=d.HorzBreak * sign, side_arm=d.RelSide * sign, axis_arm=axis)


def pitch_distributions(d, pitches):
    """Per pitch type and environment, the quantiles that bound the sliders."""
    columns = {
        "release_speed": "RelSpeed",
        "ivb": "InducedVertBreak",
        "horizontal_break": "hb_arm",
        "spin_rate": "SpinRate",
        "spin_axis": "axis_arm",
        "extension": "Extension",
        "release_height": "RelHeight",
        "release_side": "side_arm",
    }
    out = {}
    for pt in pitches:
        out[pt] = {}
        for env in ENVIRONMENTS:
            x = d[(d.AutoPitchType == pt) & (d.altitude_category == env)]
            rec = {"n": len(x)}
            for name, col in columns.items():
                q = x[col].quantile(DISTRIBUTION_QUANTILES)
                rec[name] = {
                    "p5": round(float(q.iloc[0]), 2),
                    "p50": round(float(q.iloc[1]), 2),
                    "p95": round(float(q.iloc[2]), 2),
                }
            out[pt][env] = rec
    return out


def speed_loss(d, pitches):
    """Velocity lost between release and plate, per type and environment.

    The simulator's plate speed and VAA (docs/09 section 3.5) need it, and it
    is the one trajectory quantity the sliders do not set.
    """
    out = {}
    for pt in pitches:
        out[pt] = {}
        for env in ENVIRONMENTS:
            x = d[(d.AutoPitchType == pt) & (d.altitude_category == env)].dropna(
                subset=["SpeedDrop", "RelSpeed"]
            )
            out[pt][env] = {
                "n": len(x),
                "speed_drop_mph": round(float(x.SpeedDrop.mean()), 3),
                "speed_drop_fraction": round(float((x.SpeedDrop / x.RelSpeed).mean()), 5),
                "vaa_deg": round(float(x.VertApprAngle.mean()), 3),
                "plate_height_ft": round(float(x.PlateLocHeight.mean()), 3),
            }
    return out


def _shrinkage_strength(swings, whiffs):
    """Beta-binomial prior strength by the method of moments across cells.

    The between-cell variance of the raw rates is inflated by binomial noise;
    subtracting it leaves the real spread, and kappa is how many swings of
    prior that spread is worth. Clipped so a flat grid does not divide by zero.
    """
    rate = whiffs / swings
    mean = whiffs.sum() / swings.sum()
    noise = float(np.mean(mean * (1 - mean) / swings))
    between = float(np.var(rate)) - noise
    if between <= 0:
        return 1000.0
    return float(np.clip(mean * (1 - mean) / between - 1, 1.0, 1000.0))


def movement_map(d, pitches):
    """Observed whiff per swing over the movement plane, docs/09 section 3.10."""
    out = {}
    for pt in pitches:
        out[pt] = {}
        for env in ENVIRONMENTS:
            x = d[(d.AutoPitchType == pt) & (d.altitude_category == env)]
            x = x.assign(
                ivb_bin=np.floor(x.InducedVertBreak / MAP_BIN_IN) * MAP_BIN_IN + MAP_BIN_IN / 2,
                hb_bin=np.floor(x.hb_arm / MAP_BIN_IN) * MAP_BIN_IN + MAP_BIN_IN / 2,
            )
            g = x.groupby(["ivb_bin", "hb_bin"]).agg(
                n=("is_swing", "size"), swings=("is_swing", "sum"), whiffs=("is_whiff", "sum")
            )
            g = g[g.swings >= MAP_MIN_SWINGS]
            mean = float(g.whiffs.sum() / g.swings.sum())
            kappa = _shrinkage_strength(g.swings.to_numpy(float), g.whiffs.to_numpy(float))
            shrunk = (g.whiffs + kappa * mean) / (g.swings + kappa)
            cells = [
                {
                    "ivb": float(i),
                    "horizontal_break": float(h),
                    "n": int(r.n),
                    "swings": int(r.swings),
                    "whiff_per_swing": round(float(s), 4),
                }
                for (i, h), r, s in zip(g.index, g.itertuples(), shrunk, strict=True)
            ]
            out[pt][env] = {
                "bin_in": MAP_BIN_IN,
                "min_swings": MAP_MIN_SWINGS,
                "mean_whiff_per_swing": round(mean, 4),
                "kappa": round(kappa, 1),
                "cells": cells,
                "extremes": _extremes(x),
            }
    return out


def _extremes(x):
    """The most and least effective pitcher-season versions of this pitch."""
    g = x.groupby(["pitcher_anon_id", "year"]).agg(
        swings=("is_swing", "sum"),
        whiffs=("is_whiff", "sum"),
        ivb=("InducedVertBreak", "mean"),
        horizontal_break=("hb_arm", "mean"),
    )
    g = g[g.swings >= EXTREME_MIN_SWINGS].assign(whiff_per_swing=lambda t: t.whiffs / t.swings)
    k = max(1, int(round(EXTREME_SHARE * len(g))))
    ranked = g.sort_values("whiff_per_swing")

    def rows(frame, tier):
        return [
            {
                "pitcher_id": str(p),
                "season": int(s),
                "tier": tier,
                "ivb": round(float(r.ivb), 2),
                "horizontal_break": round(float(r.horizontal_break), 2),
                "swings": int(r.swings),
                "whiff_per_swing": round(float(r.whiff_per_swing), 4),
            }
            for (p, s), r in zip(frame.index, frame.itertuples(), strict=True)
        ]

    return {
        "n_ranked": len(g),
        "most": rows(ranked.tail(k), "most"),
        "least": rows(ranked.head(k), "least"),
    }


def _squared_distance(x, mean, inverse_covariance):
    centred = x - mean
    return np.einsum("ij,jk,ik->i", centred, inverse_covariance, centred)


def plausibility_envelope(d, pitches):
    """What the league actually throws, per type, and the detector for the rest.

    Movement per rpm is the empirical side of H4: it says whether a shape is
    coherent with its spin without assuming an absolute air density or a
    lift-coefficient fit (docs/09 section 2.5).
    """
    out = {}
    percentiles = np.arange(1, 100)
    for pt in pitches:
        x = d[(d.AutoPitchType == pt) & (d.altitude_category == SEA)].dropna(
            subset=PLAUSIBILITY_FEATURES
        )
        x = x[x.SpinRate > 0]
        values = x[PLAUSIBILITY_FEATURES].to_numpy(float)
        first = _squared_distance(values, values.mean(0), np.linalg.inv(np.cov(values.T)))
        core = values[first <= np.quantile(first, PLAUSIBILITY_CORE_SHARE)]
        mean, inverse = core.mean(0), np.linalg.inv(np.cov(core.T))
        distance = _squared_distance(values, mean, inverse)
        threshold = float(np.quantile(distance, PLAUSIBILITY_THRESHOLD_QUANTILE))

        per_krpm = np.hypot(x.InducedVertBreak, x.hb_arm) / (x.SpinRate / 1000.0)
        bounds = {}
        for name, col in [
            ("release_speed", x.RelSpeed),
            ("ivb", x.InducedVertBreak),
            ("horizontal_break", x.hb_arm),
            ("spin_rate", x.SpinRate),
            ("movement_per_krpm", per_krpm),
        ]:
            lo, hi = col.quantile([ENVELOPE_LOW, ENVELOPE_HIGH])
            bounds[name] = {"low": round(float(lo), 3), "high": round(float(hi), 3)}
        out[pt] = {
            "n": len(x),
            "features": ["release_speed", "ivb", "horizontal_break", "spin_rate"],
            "mean": [round(float(v), 4) for v in mean],
            "inverse_covariance": [[round(float(v), 8) for v in row] for row in inverse],
            "threshold_squared_distance": round(threshold, 3),
            "flagged_share_of_real_pitches": round(float((distance > threshold).mean()), 4),
            "bounds": bounds,
            "movement_per_krpm_percentiles": [
                round(float(v), 3) for v in np.percentile(per_krpm, percentiles)
            ],
        }
    return out


def spin_efficiency_check(d, pitches):
    """How much the absolute spin efficiency depends on its assumptions.

    Inverts the measured Magnus acceleration into a lift coefficient, then into
    a spin factor under two published fits, at three plausible sea-level air
    densities. If the median moves by more than the physics can defend, the
    number is not shown (docs/09 section 2.5).
    """
    x = d[d.altitude_category == SEA].dropna(subset=["magnus_accel", "speed", "SpinRate"])
    x = x[x.SpinRate > 0]
    area = np.pi * BALL_RADIUS_M**2
    accel = x.magnus_accel.to_numpy() * FT_TO_M
    speed = x.speed.to_numpy() * FT_TO_M
    omega = x.SpinRate.to_numpy() * 2 * np.pi / 60
    fits = {
        "sawicki_2003": lambda cl: np.where(cl < 0.15, cl / 1.5, (cl - 0.09) / 0.6),
        "nathan_2008": lambda cl: 0.4 * np.clip(cl, 0, 0.42) / (1 - 2.32 * np.clip(cl, 0, 0.42)),
    }
    out = {"sea_level_density_kg_m3": [1.15, 1.19, 1.225], "median_by_assumption": {}}
    for rho in out["sea_level_density_kg_m3"]:
        lift = 2 * BALL_MASS_KG * accel / (rho * area * speed**2)
        for fit_name, spin_factor in fits.items():
            eff = spin_factor(lift) * speed / BALL_RADIUS_M / omega
            med = pd.Series(eff).groupby(x.AutoPitchType.to_numpy()).median()
            out["median_by_assumption"][f"{fit_name}@{rho}"] = {
                pt: round(float(med[pt]), 3) for pt in pitches if pt in med
            }
    ff = [v["Four-Seam"] for v in out["median_by_assumption"].values()]
    out["four_seam_median_range"] = [round(min(ff), 3), round(max(ff), 3)]
    return out


def simulator_evidence(df, pitches):
    """Everything the simulator reads, keyed by output."""
    d = with_arm_side(df[df.AutoPitchType.isin(pitches)])
    return {
        "arm_side_convention": "right-hander frame: arm side positive; left-handers mirrored",
        "distributions": pitch_distributions(d, pitches),
        "speed_loss": speed_loss(d, pitches),
        "movement_map": movement_map(d, pitches),
        "plausibility": plausibility_envelope(d, pitches),
        "spin_efficiency_check": spin_efficiency_check(d, pitches),
    }
