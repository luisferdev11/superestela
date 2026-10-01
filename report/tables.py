"""The technical document's tables, one function each, from the committed artifacts."""

from __future__ import annotations

from collections.abc import Callable

from report.markdown import number, page, signed, table
from report.matrix import Artifacts

ENVIRONMENTS = {
    "No Altitude": "Nivel del mar",
    "Medium Altitude": "Altitud media",
    "Extreme Altitude": "Altitud extrema",
}


# --------------------------------------------------------------------------
# Tables
# --------------------------------------------------------------------------
def audit_table(a: Artifacts) -> str:
    """Section 2: the dataset and the defects found in it."""
    audit = a["evidence.json"]["audit"]
    size = table(
        ["Qué", "Cuántos"],
        [
            ["Lanzamientos", number(audit["n_pitches"], 0)],
            ["Juegos", number(audit["n_games"], 0)],
            ["Lanzadores", number(audit["n_pitchers"], 0)],
            ["Bateadores", number(audit["n_batters"], 0)],
            ["Temporadas", ", ".join(str(s) for s in audit["seasons"])],
        ],
    )
    defects = table(
        ["Campo", "Problema", "Evidencia", "Severidad", "Qué se hizo"],
        [
            [f"`{d['field']}`", d["issue"], d["evidence"], d["severity"], d["action"]]
            for d in audit["defects"]
        ],
        text=5,
    )
    note = "Los defectos se citan como los registra `evidence.py`, en inglés."
    return page("Datos y auditoría", "evidence.json → audit", f"{size}\n\n{defects}\n\n{note}")


def density_table(a: Artifacts) -> str:
    """Section 3: the density index measured from the trajectory, per environment."""
    density = a["evidence.json"]["density"]
    rows = [
        [
            ENVIRONMENTS[env],
            number(d["n"], 0),
            f"{number(d['per_game_mean'], 3)} ± {number(d['per_game_sd'], 3)}",
            number(d["per_game_n"], 0),
            number(d["magnus_ratio"], 3),
        ]
        for env, d in density.items()
    ]
    body = table(
        ["Entorno", "Lanzamientos", "Índice de Densidad (media ± sd)", "Juegos", "Magnus"],
        rows,
    )
    return page("Índice de Densidad por entorno", "evidence.json → density", body)


def run_environment_table(a: Artifacts) -> str:
    """Section 1: how much more the league scores at altitude."""
    run = a["evidence.json"]["run_environment"]
    rows = [
        [
            ENVIRONMENTS[env],
            number(run[env]["innings"], 1),
            number(run[env]["runs"], 0),
            number(run[env]["ra9"], 2),
            number(run[env]["pitches_per_inning"], 2),
        ]
        for env in ENVIRONMENTS
    ]
    effect = run["altitude_effect"]
    note = (
        f"Altitud extrema contra nivel del mar: {signed(effect['ra9_delta'])} carreras por 9 "
        f"entradas ({signed(effect['ra9_pct'], 1)}%)."
    )
    body = table(["Entorno", "Entradas", "Carreras", "RA/9", "Lanzamientos por entrada"], rows)
    return page("Entorno de carreras", "evidence.json → run_environment", f"{body}\n\n{note}")


HYPOTHESES = {
    "H1_low_density_reduces_break": "H1 · Menos densidad reduce el break",
    "H2_speed_differential_pitches_gain": "H2 · Los pitches de diferencial de velocidad ganan",
    "H3_groundballs_more_valuable": "H3 · La rola vale más en la altura",
    "H4_spin_rate_insufficient": "H4 · El spin rate no basta",
}
VERDICTS = {
    "CONFIRMED": "Confirmada",
    "REFUTED": "Refutada",
    "CONFIRMED_WITH_NUANCE": "Confirmada con matiz",
}


def hypotheses_table(a: Artifacts) -> str:
    """Section 6: the verdict on each hypothesis, with the evidence behind it."""
    hyp = a["evidence.json"]["hypotheses"]
    rows = [
        [HYPOTHESES[key], VERDICTS.get(h["verdict"], h["verdict"]), h["evidence"]]
        for key, h in hyp.items()
    ]
    body = table(["Hipótesis", "Veredicto", "Evidencia"], rows, text=3)
    note = (
        "La evidencia se cita como la registra `evidence.py`, en inglés; el documento la redacta."
    )
    return page("Veredicto de hipótesis", "evidence.json → hypotheses", f"{body}\n\n{note}")


def translator_table(a: Artifacts) -> str:
    """Section 8: how well the translator projects shape across environments, on holdout."""
    tr = a["evidence.json"]["translator"]
    rows = []
    for pitch, p in tr["by_pitch"].items():
        for axis, label in (("ivb", "IVB"), ("hb", "HB")):
            m = p[axis]
            rows.append(
                [
                    f"{pitch} · {label}",
                    number(p["n_test"], 0),
                    number(m["holdout_rmse_physics_in"], 2),
                    number(m["holdout_rmse_empirical_in"], 2),
                    number(m["holdout_rmse_naive_in"], 2),
                ]
            )
    body = table(
        [
            "Pitch · eje",
            "Lanzadores en holdout",
            "Error física (in)",
            "Error empírico (in)",
            "Error sin traducir (in)",
        ],
        rows,
    )
    note = f"Factor de Magnus medido: {number(tr['magnus_ratio_measured'], 4)}."
    return page("El Traductor de Altitud", "evidence.json → translator", f"{body}\n\n{note}")


def baseline_table(a: Artifacts) -> str:
    """Section 4: what the v0 baseline learns, against the null model."""
    v0 = a["evidence.json"]["stuff_plus_v0"]
    learn = a["evidence.json"]["target_learnability"]
    model = table(
        ["Modelo", "Validación", "RMSE", "RMSE nulo", "R²"],
        [
            [
                "Stuff+ v0 (run value directo)",
                v0["cv"],
                number(v0["oof_rmse"], 4),
                number(v0["null_rmse"], 4),
                number(v0["oof_r2"], 4),
            ]
        ],
    )
    components = table(
        ["Componente", "n", "Tasa base", "AUC fuera de pliegue"],
        [
            [name, number(c["n"], 0), number(c["base_rate"], 3), number(c["oof_auc"], 3)]
            for name, c in learn.items()
        ],
    )
    return page(
        "El baseline v0 y lo que sí se aprende",
        "evidence.json → stuff_plus_v0, target_learnability",
        f"{model}\n\n{components}",
    )


# The gates in the document's language: what each tests and its threshold (docs/09 section 5).
GATES = {
    "F1": ("Forma proyectada de mar a altitud extrema contra la observada", "RMSE ≤ la banda"),
    "F2": ("Cobertura de la banda de ±1 error estándar", "68.3% ± 2 errores estándar"),
    "F3": ("Razón Magnus medida contra la densidad física", "dentro del rango físico ± 0.03"),
    "F4": ("Detector de plausibilidad", "< 2% de reales marcados; 100% de imposibles"),
    "F5": ("VAA cinemático contra el medido", "RMSE ≤ 0.5°"),
    "S1": ("Monotonía: +1 mph en la recta", "Δ medio > 0; violaciones ≤ 10%"),
    "S2": ("Espejo: el mismo pitch zurdo y derecho", "|Δ| ≤ 1 punto"),
    "S3": ("Suavidad por paso de slider", "p99 ≤ 1.5 puntos"),
    "S4": ("Consistencia con el Radar", "r ≥ 0.9; |Δ| medio ≤ 3"),
    "S5": ("Calibración por deciles, holdout por lanzador", "Spearman ≥ 0.8"),
    "S6": ("Experimento natural: Δ simulado contra Δ whiff observado", "correlación > 0, IC 95%"),
    "S7": ("Contra el modelo nulo del reto, run value por conteo", "RMSE menor"),
}


def gates_table(a: Artifacts) -> str:
    """Section 7: the simulator's acceptance gates, as they came out (docs/09 section 5.1)."""
    val = a["simulator_validation.json"]
    rows = [
        [
            g["id"],
            *GATES[g["id"]],
            "✅" if g["passed"] else "❌",
            "sí" if g["id"] in val["display_gates"] else "",
        ]
        for g in val["gates"]
    ]
    head = (
        f"Modelo `{val['model_id']}` · usa arsenal: {'sí' if val['uses_arsenal'] else 'no'} · "
        f"Stuff+ mostrado: {'sí' if val['stuff_plus_shown'] else 'no'}"
    )
    headers = ["Compuerta", "Qué prueba", "Umbral", "Pasa", "Decide si se muestra"]
    body = table(headers, rows, text=5)
    return page(
        "Compuertas del Simulador", "simulator_validation.json → gates", f"{head}\n\n{body}"
    )


TABLE_BUILDERS: dict[str, Callable[[Artifacts], str]] = {
    "datos.md": audit_table,
    "densidad.md": density_table,
    "entorno-de-carreras.md": run_environment_table,
    "hipotesis.md": hypotheses_table,
    "traductor.md": translator_table,
    "baseline.md": baseline_table,
    "compuertas.md": gates_table,
}
