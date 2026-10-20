# 15 · Integración de los modelos finales de datos (Stuff+ `FINAL_v1` y Location+ `L3`)

**Fecha:** 19 de octubre de 2026 · **Rama:** `feat/final-models` · **Fuente:** rama de datos
`feat/stuff-plus-mlflow`, commit `19966f3`.

> **En una línea:** los dos modelos ya corren dentro del producto, por la API y por la costura única
> (ADR 0010), y reproducen el cálculo de datos. Location+ coincide casi exacto con datos. Stuff+
> todavía **no se publica en pantallas**: con un solo booster por tipo no tiene banda y falla dos
> compuertas de suavidad. Las dos cosas se resuelven con lo mismo: los **5 boosters por fold** que le
> pedimos a datos.

## 1. Qué entregó datos

| Pieza | Stuff+ `FINAL_v1` | Location+ `L3_loc_count_hand` |
|---|---|---|
| Qué predice | 7 resultados de un swing: Whiff, Foul, Weak (<71 mph), Out, Single, XBH, HomeRun | 8 resultados de cualquier lanzamiento: Ball, StrikeCalled, Whiff, Foul, Out, Single, XBH, HomeRun |
| Variables | 13: forma al soltar (espejada al lado del brazo), `same_hand` y 3 diferenciales contra la recta principal | 5: altura y lado en el plato (vista del cátcher, sin espejar), bolas, strikes, `same_hand` |
| Modelos | 6 boosters XGBoost, uno por tipo | 6 boosters XGBoost, uno por tipo |
| Valor en carreras | Uno por clase (`rv_values.csv`) | **Por clase y conteo** (tabla 8×4×3) |
| Escala | 100 − 10·(xRV − μ_tipo)/σ_tipo, con μ y σ fuera de fold (`xrv_media_desviacion_por_pitch.csv`) | La misma fórmula; **μ y σ no se entregaron** |
| Neutral a la mano | Sí: promedia los dos lados del bateador con el peso del entrenamiento | No: el enfrentamiento es parte de dónde debe ir el pitch |

Tipos cubiertos: Four-Seam, Sinker, Slider, Changeup, Curveball y Cutter. **No hay Splitter ni
Sweeper**: la API responde `unsupported_pitch_type`.

### Por qué `FINAL_v1` y no otro candidato

Todos los candidatos tienen el estado `candidate` en MLflow y las seis etiquetas obligatorias. Las
métricas siguientes comparan runs con targets distintos (el log-loss no sirve para eso):

| Run | Target | Calibración | Split-half | r whiff siguiente | r carreras siguientes* | Experimento natural (S6) |
|---|---|---|---|---|---|---|
| **FINAL_v1** | swing_cq | **0.830** | **0.956** | **0.296** | **−0.132** | **0.193** |
| FIN_B_all8 | all8 | 0.785 | 0.951 | 0.248 | −0.108 | 0.176 |
| FIN_C_allcq | all_cq | 0.824 | 0.954 | 0.260 | −0.114 | 0.185 |

\* `delta_run_exp` es desde el lado del bateador: más negativo = mejor. La r de las propias carreras
consigo mismas al año siguiente es 0.12, así que el Stuff+ anticipa las carreras tan bien como ellas
mismas.

`FINAL_v1` gana en las cinco métricas. La API devuelve esta comparación y la razón de la selección en
`stuffModel.selection` y `stuffModel.candidates`.

## 2. Los cuatro choques con el producto y cómo se resolvieron

1. **Arsenal.** `FINAL_v1` mide cada pitch contra la recta principal del lanzador en esa temporada y
   ese entorno. El contrato rechazaba `uses_arsenal=True`.
   - Se portó `_fb_diffs` a `models/features/arsenal.py`. La familia de rectas es Four-Seam, Sinker,
     TwoSeam y OneSeam, **sin Cutter**, distinta de `core.arsenal`; sin recta, la referencia es la más
     rápida.
   - `PitchInput` tiene ahora `speed_diff`, `ivb_diff` y `hb_diff` opcionales.
   - El arnés, la evidencia, las compuertas, el Traductor y el Simulador los calculan **antes de
     filtrar filas**, como en el entrenamiento. Sin arsenal, el pitch no se puntúa: nunca se rellena
     con cero. En el Simulador sale la razón nueva `missing_arsenal` (modo laboratorio).
2. **Escala por tipo.**
   - `ScaleSpec.by_type` guarda (μ, σ) por tipo y `implied_xrv()` invierte Stuff+ a xRV con el tipo
     correcto.
   - Lo usan S5/S7 (`simulator_gates.py`) y el impuesto proyectado (`arsenal_batch.py`).
   - Con v0 (sin `by_type`) da exactamente lo mismo que antes.
3. **Bandas.** El contrato exige ≥2 draws.
   - `runs.read_run` acepta `models/folds/stuff_<tipo>_f<k>.json`: con ellos, cada fold es un draw y
     su dispersión es la banda.
   - Hoy solo hay el booster final: `has_bands=false`, la API devuelve `se: null` y las pantallas no
     lo muestran.
4. **Location+ no tenía costura.**
   - Tiene su propio modelo (`models/location/final.py`), su propia validación y su propio vector.
   - La tabla 8×4×3 y μ/σ por tipo se reconstruyeron del dataset con la lógica de datos portada
     (`models/outcomes.py`).
   - **Su μ/σ sale del modelo final, no fuera de fold.** Cuando lleguen los folds se recalcula.

## 3. Cómo se usa

```bash
uv run python scripts/build_final_models.py     # artifacts/data-runs → artifacts/*.joblib
uv run python scripts/verify_final_models.py --notebook ../superestela-datos/notebooks/experimentos_stuff.py
SUPERESTELA_MODEL=artifacts/stuff_plus_final_v1.joblib \
SUPERESTELA_LOCATION_MODEL=artifacts/location_plus_l3.joblib \
  uv run uvicorn api.main:app --app-dir packages --port 8000
```

`artifacts/data-runs/` se llena copiando de la rama de datos `models/`, `config.json`,
`rv_values.csv`, `metrics.json` y `pitcher_table.csv` de cada run, más `runValues.csv` y
`SOURCE_COMMIT`. Nada de eso entra a git (CONVENTIONS §8.4).

**`POST /api/v1/pitches/score`** recibe lanzamientos con los nombres del front (`releaseSpeed`,
`plateSide`, `balls`…) y opcionalmente el `arsenal` o `pitcherId`/`year`/`environment`.

- Cada modelo valida **sus** columnas:
  - Stuff+ necesita las 10 de forma + arsenal.
  - Location+ necesita `pitchType`, `pitcherHand`, `batterHand`, `plateHeight`, `plateSide`, `balls`
    y `strikes`.
- Si ningún lanzamiento trae una columna obligatoria, responde 422 con el modelo y las columnas.
- Si solo le falta a algunos, cada uno trae `status: missing_features` y `missing: [...]`.
- Las seis variables opcionales de análisis (`altOrd`, `totalBreak`, `movePerRpm`, `vaaEst`,
  `locAbsSide`, `locDistCenter`) vienen aparte, en `analysis`. Ningún score las lee.

## 4. Verificación (con cifras reales)

| Prueba | Resultado | ¿Pasa? |
|---|---|---|
| Valores en carreras reconstruidos vs `rv_values.csv` de datos (ambos runs) | diferencia máx. 1e-16 | ✅ |
| Diferenciales contra la recta vs `_fb_diffs` de datos, 635 002 filas | diferencia 0.0, 0 NaN distintos | ✅ |
| Location+ por (lanzador, año, tipo) vs `L3/pitcher_table.csv` | r 0.989; \|Δ\| medio 0.13; 8 569/8 569 grupos; mismas 624 674 filas | ✅ |
| Stuff+ por (lanzador, año, tipo) vs `FINAL_v1/pitcher_table.csv` | r 0.923 (n≥100); \|Δ\| medio 1.69; medias 99.54 vs 99.50 | ⚠️ r < 0.95 |
| Log-loss del booster final con nuestras variables vs el de entrenamiento de datos | Four-Seam 1.477 vs 1.469 (validación 1.506); los 6 tipos dentro de 0.01 del de entrenamiento; mismas filas de entrenamiento | ✅ |
| API real vs cálculo directo, 1 296 lanzamientos de un zurdo | diferencia 0.0 en Stuff+ y Location+ | ✅ |
| Casos de error en la API real: columna ausente, Splitter, sin arsenal | 422 con `plateSide`; `unsupported_pitch_type`; `missing_arsenal` con lo que falta | ✅ |
| pytest 216 (31 nuevas), mypy estricto, ruff, web 183 | todo verde | ✅ |

**Sobre la r de 0.92 de Stuff+:**

- No es un error de implementación. El log-loss en entrenamiento coincide tipo por tipo; si las
  variables estuvieran mal, saldría peor que el de validación, y sale igual al de entrenamiento.
- La brecha es la diferencia entre las predicciones **fuera de fold** de datos y las del modelo final,
  que ya vio a cada lanzador. En un modelo con poca señal (mejora de 1.2% sobre la base) esa
  diferencia pesa más que en Location+ (mejora de 28%).
- La prueba definitiva necesita los boosters por fold.
- Hay 4 447 lanzamientos con la recta indefinida (sin entorno o sin lanzador). Datos los puntuó con
  NaN y nosotros los dejamos sin score.

### Compuertas con `FINAL_v1` (diagnóstico, no publicado)

Se corrió `regenerate.py --model` con una copia del modelo con el booster duplicado (dos draws
iguales, solo para medir). Las salidas se revirtieron.

| Compuerta | v0 (publicado) | FINAL_v1 | Lectura |
|---|---|---|---|
| S1 · +1 mph sube el Stuff+ | ✅ 9.3% violaciones | ❌ 16.7% | Un solo árbol da escalones |
| S2 · zurdo espejado | ✅ 0.0 | ✅ 0.0 | |
| S3 · saltos por paso de 0.1 | ✅ p99 1.23 | ❌ p99 1.84 | Igual que S1 |
| S4 · Simulador vs Radar | ✅ r 0.951 | ✅ r 0.914 | |
| S5 · calibración por deciles | ✅ 0.033 → −0.010 | ✅ 0.046 → −0.018 | Separa más |
| S6 · experimento natural | ✅ r 0.144 | ✅ r 0.223 | Mejor |
| S7 · contra el nulo por conteo | ❌ 0.21732 | ❌ 0.21696 (cuenta+modelo mejor que el nulo) | Mejor que v0 |

S5 y S7 son optimistas con el modelo final (docs/11 §6). S1 y S3 son de **suavidad**: v0 las pasa
porque promedia 20 bolsas, y `FINAL_v1` las pasaría promediando sus 5 folds. Por eso los folds
resuelven las dos cosas que faltan.

Se puntuaron 619 622 tarjetas; 260 se quedaron fuera.

## 5. Qué falta para seguir

1. **Datos: los 5 boosters por fold de `FINAL_v1` y `L3`** en `models/folds/stuff_<tipo>_f<k>.json`.
   Con eso hay bandas, S1/S3 deberían pasar, se recalcula μ/σ OOF de Location+ y la paridad se
   comprueba exacta. Después: `build_final_models.py`, `regenerate.py --model … --publish`, y
   actualizar los 11 tests web que fijan cifras v0 y `report/claims.toml`.
2. **Datos: la base `mlflow.db` actualizada.** La que cargamos es anterior al re-entrenamiento de L3.
3. **Su rama no se fusiona:** sube 95 CSV por lanzador y los modelos (CONVENTIONS §8.4). Los
   artefactos viven en `artifacts/`; el código vive en este PR.
4. **Location+ en pantalla.** Hoy solo llega por la API. Debe presentarse como **descriptivo** («cómo
   ubicó»), no predictivo: split-half 0.53, r con las carreras siguientes ≈ 0, y la altitud no lo
   mueve (99.9 vs 100.05).
5. **Densidad continua (tesis C1).** `FINAL_v1` no lee el índice de densidad: en el Simulador todo el
   Δ por altitud viene de la forma y el «por el entorno» es 0.
6. **Splitter y Sweeper** no tienen modelo.
