# Compuertas del Simulador

> Generado por `report/build.py` desde `simulator_validation.json → gates`. No se edita a mano.

Modelo `0.1.0+b126006` · usa arsenal: no · Stuff+ mostrado: sí

| Compuerta | Qué prueba | Umbral | Pasa | Decide si se muestra |
| :--- | :--- | :--- | :--- | :--- |
| F1 | Forma proyectada de mar a altitud extrema contra la observada | RMSE ≤ la banda | ✅ |  |
| F2 | Cobertura de la banda de ±1 error estándar | 68.3% ± 2 errores estándar | ❌ |  |
| F3 | Razón Magnus medida contra la densidad física | dentro del rango físico ± 0.03 | ✅ |  |
| F4 | Detector de plausibilidad | < 2% de reales marcados; 100% de imposibles | ✅ |  |
| F5 | VAA cinemático contra el medido | RMSE ≤ 0.5° | ✅ |  |
| S1 | Monotonía: +1 mph en la recta | Δ medio > 0; violaciones ≤ 10% | ✅ | sí |
| S2 | Espejo: el mismo pitch zurdo y derecho | \|Δ\| ≤ 1 punto | ✅ | sí |
| S3 | Suavidad por paso de slider | p99 ≤ 1.5 puntos | ✅ | sí |
| S4 | Consistencia con el Radar | r ≥ 0.9; \|Δ\| medio ≤ 3 | ✅ | sí |
| S5 | Calibración por deciles, holdout por lanzador | Spearman ≥ 0.8 | ✅ |  |
| S6 | Experimento natural: Δ simulado contra Δ whiff observado | correlación > 0, IC 95% | ✅ |  |
| S7 | Contra el modelo nulo del reto, run value por conteo | RMSE menor | ❌ |  |
