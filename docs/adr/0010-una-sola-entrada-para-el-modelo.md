# ADR 0010 · Una sola entrada para el modelo de datos: un archivo y un comando

**Fecha:** 1 de octubre de 2026 · **Estado:** aceptada

## Contexto

El ADR 0007 prometía que cualquier modelo que cumpliera el contrato `Scorer` entraría al producto
«sin que producto toque la API ni las pantallas». El 1 de octubre, al preparar la integración con
datos, se revisó de dónde sale cada Stuff+ que se ve en pantalla. La promesa no se cumplía: había
**tres caminos**, y solo uno pasaba por el contrato.

| Camino | Quién lo usaba | Cómo puntuaba |
|---|---|---|
| `analysis/evidence.py → mockup_data.json` | Radar, Ficha, Plan, Despliegue y Plantel | Un modelo propio (`stuff_plus_v0`), sin `Scorer` |
| La API (`/simulate`) | Simulador y Traductor | `BridgeModel.load`, que rechaza cualquier otra clase |
| `python -m models.score` | El holdout de Diablos | El contrato, con cualquier `Scorer` (ADR 0009) |

Además, las compuertas (`analysis/simulator_gates.py`) evaluaban con `model.stuff_plus(frame)`, un
método del puente que no está en el contrato.

Si datos entregaba su modelo ese día, solo lo vería el comando del holdout. Las cinco pantallas que
muestran más números seguirían mostrando v0, sin que nadie lo notara.

## Decisión

**El modelo de datos entra por un solo archivo y llega a todo el producto con un solo comando.**

1. **El archivo:** un objeto que cumpla `models.scoring.Scorer`, guardado con `joblib` en
   `artifacts/`, que nunca se commitea. La clase es libre.
2. **Un solo cargador**, `models.scoring.load_scorer`. Lo usan la API, las compuertas, la evidencia y
   `models.score`, así que un modelo que carga ahí puede mostrarse en todo el producto.
3. **Una sola forma de puntuar un frame:** `models.scoring.stuff_plus_of`. Calcula la media y la
   desviación de los `draws` del contrato, igual que la API y `models.score`, para que un pitch valga
   lo mismo en todas las pantallas.
4. **Un solo comando**, que corre los pasos en orden:

   ```bash
   uv run python scripts/regenerate.py --model artifacts/<suyo>.joblib --publish
   ```

   - `evidence.py --model` puntúa las tarjetas con ese modelo. Son las mismas filas y la misma
     densidad por juego, así que cambian los scores y nada más.
   - `simulator_gates.py --model` lo juzga sin reentrenar nada y deja el veredicto junto al archivo.
   - `report.build` regenera las tablas.
   - La API sirve el modelo con `SUPERESTELA_MODEL`, y solo si su veredicto está al lado.

5. **Sin `--model`, todo da los números de hoy.** Se verificó el 1 de octubre:
   - `evidence.py` regeneró los artefactos sin un byte de diferencia.
   - Con el puente, las compuertas dieron los mismos valores, en las 12, que el registro publicado.
6. **La escala la declara el modelo.** `ScaleSpec.description` llega a `mockup_data.json → scale`. Si
   el modelo trae `scale.kind` (`"league"` o `"per_environment"`), la web cambia sus textos
   (`es.scale[kind]`). Si no lo trae, se asume `"league"`.
7. **La procedencia la dice quien contestó.** La línea del Simulador nombra el `modelId` de la
   respuesta de la API. Solo cuenta compuertas si el registro publicado juzgó a ese mismo modelo.

## Consecuencias

- **Para datos**, integrar es entregar un archivo y correr un comando. La guía paso a paso es
  [`docs/11`](../11-LO-QUE-NECESITA-PRODUCTO.md).
- **S5 y S7 con un modelo externo** leen las predicciones del propio modelo sobre el dataset. Son
  fuera de pliegue solo si el modelo se construyó así. El puente las tiene de sus bolsas. Si su
  modelo no es fuera de pliegue, S5 y S7 salen optimistas, y el documento técnico lo tiene que decir.
- **Lo que este ADR no resuelve:**
  - `Scorer.draws` no recibe el arsenal. Un modelo con `uses_arsenal=True` necesita extender el
    contrato primero (ADR 0009).
  - El Impuesto de Altitud usa pesos lineales fijos (`evidence.py → RUN_VALUE`); ahí entra A2.
  - Location+, Pitching+ y las carreras (A3) no tienen artefacto todavía; `docs/11` dice dónde
    entrarían.
- **`ScaleSpec.kind` es un campo nuevo y opcional.** El puente v0, ya serializado, no lo tiene, y por
  eso se lee con `getattr(..., "kind", "league")`.
