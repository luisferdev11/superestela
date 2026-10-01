# Matriz de trazabilidad

> Generado por `report/build.py` desde `report/claims.toml`. No se edita a mano.

24 de 30 afirmaciones tienen corrida. Las marcadas en rojo no se pueden escribir en el documento hasta que exista la corrida que esperan.

| Afirmación | § | De dónde sale | Valor | Estado |
| :--- | :--- | :--- | :--- | :--- |
| A nivel del mar la liga anota 4.84 carreras por 9 entradas | §1 | `evidence.json` → `run_environment → No Altitude → ra9` | 4.84 | ✅ |
| En altitud extrema anota 7.55 | §1 | `evidence.json` → `run_environment → Extreme Altitude → ra9` | 7.55 | ✅ |
| La altitud extrema suma 56% de carreras | §1 | `evidence.json` → `run_environment → altitude_effect → ra9_pct` | 56.0 | ✅ |
| El dataset tiene 635,002 lanzamientos | §2 | `evidence.json` → `audit → n_pitches` | 635002 | ✅ |
| Dentro del mismo lanzador, la recta pierde 3.77 pulgadas de IVB en altitud extrema | §2 | `evidence.json` → `within_pitcher → Four-Seam → ivb → delta_mean` | −3.77 | ✅ |
| El 100% de los lanzadores medidos pierde ride | §2 | `evidence.json` → `within_pitcher → Four-Seam → ivb → pct_pitchers_losing` | 100.0 | ✅ |
| El spin no cambia: +1 rpm en promedio | §2 | `evidence.json` → `within_pitcher → Four-Seam → spin → delta_mean` | 1.01 | ✅ |
| Los que más ride tienen más pierden: correlación −0.518 | §2 | `evidence.json` → `within_pitcher → Four-Seam → heterogeneity → corr_sea_ivb_vs_delta` | −0.518 | ✅ |
| El Índice de Densidad, la razón de arrastre medida desde la pelota, es 0.858 en altitud extrema | §3 | `evidence.json` → `density → Extreme Altitude → per_game_mean` | 0.858 | ✅ |
| En altitud media, el índice es 0.903 | §3 | `evidence.json` → `density → Medium Altitude → per_game_mean` | 0.903 | ✅ |
| El efecto Magnus cae a 0.754 de su valor a nivel del mar | §3 | `evidence.json` → `translator → magnus_ratio_measured` | 0.7543 | ✅ |
| El índice de densidad está validado contra la densidad física del aire | §3 | sin corrida todavía | espera D4 (docs/05) | 🔴 no va en el documento |
| Ajustar el run value directo no aprende casi nada: R² 0.003 | §4 | `evidence.json` → `stuff_plus_v0 → oof_r2` | 0.00283 | ✅ |
| El whiff sí se aprende: AUC 0.637 fuera de pliegue | §4 | `evidence.json` → `target_learnability → P(whiff \| swing) → oof_auc` | 0.6371 | ✅ |
| La habilidad se repite de un año a otro: el whiff, con r = 0.556 | §4 | `evidence.json` → `season_stability → skill_persistence_whiff` | 0.556 | ✅ |
| Los modelos por componente superan al ajuste directo del run value | §4 | sin corrida todavía | espera A1 (equipo de datos) | 🔴 no va en el documento |
| Stuff+ en altitud extrema significa calidad de pitch, con 100 como promedio del entorno | §5 | sin corrida todavía | espera A1–A3, F1–F2 y la confirmación de la escala con Diablos | 🔴 no va en el documento |
| H1, menos densidad reduce el break: confirmada | §6 | `evidence.json` → `hypotheses → H1_low_density_reduces_break → verdict` | CONFIRMED | ✅ |
| H2, los pitches de diferencial de velocidad ganan: refutada | §6 | `evidence.json` → `hypotheses → H2_speed_differential_pitches_gain → verdict` | REFUTED | ✅ |
| H3, la rola vale más en la altura: confirmada con matiz | §6 | `evidence.json` → `hypotheses → H3_groundballs_more_valuable → verdict` | CONFIRMED_WITH_NUANCE | ✅ |
| H4, el spin rate no basta: confirmada | §6 | `evidence.json` → `hypotheses → H4_spin_rate_insufficient → verdict` | CONFIRMED | ✅ |
| Lo que sobrevive la altitud es el poco ride: correlación +0.531 entre \|IVB\| y Stuff+ perdido | §6 | sin corrida todavía | espera su cálculo en analysis/evidence.py (hoy solo está en docs/01 §8.5) | 🔴 no va en el documento |
| El modelo del Simulador pasa las compuertas que deciden si se muestra | §7 | `simulator_validation.json` → `stuff_plus_shown` | sí | ✅ |
| Y no le gana al modelo nulo del reto, el run value por conteo (S7) | §7 | `simulator_validation.json` → `gates → id=S7 → passed` | no | ✅ |
| Un cambio de Stuff+ vale carreras | §7 | sin corrida todavía | espera A3 (equipo de datos) | 🔴 no va en el documento |
| El modelo generaliza a lanzadores y temporadas nuevas | §7 | sin corrida todavía | espera F4–F5 y el holdout de Diablos (postemporada 2026) | 🔴 no va en el documento |
| La física traduce el IVB de la recta con error de 0.92 pulgadas en holdout | §8 | `evidence.json` → `translator → by_pitch → Four-Seam → ivb → holdout_rmse_physics_in` | 0.92 | ✅ |
| Sin traducir, el error sería de 3.88 pulgadas | §8 | `evidence.json` → `translator → by_pitch → Four-Seam → ivb → holdout_rmse_naive_in` | 3.88 | ✅ |
| El resultado casi no se repite: las carreras permitidas, con r = 0.216 | §4 | `evidence.json` → `season_stability → result_persistence_ra9` | 0.216 | ✅ |
| Se midieron 268 lanzadores con la recta en los dos entornos | §2 | `evidence.json` → `within_pitcher → Four-Seam → n_pitchers` | 268 | ✅ |
