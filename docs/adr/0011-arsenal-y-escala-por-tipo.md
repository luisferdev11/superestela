# ADR 0011 · El contrato del scorer acepta arsenal y escala por tipo

**Fecha:** 19 de octubre de 2026 · **Estado:** propuesta

## Contexto

El modelo final de Stuff+ de datos (`FINAL_v1`, docs/15) usa dos cosas que el contrato `Scorer`
(ADR 0007, 0009, 0010) no admitía:

- **Diferenciales contra la recta principal** del lanzador (velocidad, IVB y quiebre) en cada
  temporada y entorno. El arnés rechazaba `uses_arsenal=True` con un `NotImplementedError` que
  pedía este ADR.
- **Una escala por tipo de pitch:** 100 es el pitch promedio *de su tipo*. `ScaleSpec` tenía un solo
  (μ, σ), y las compuertas y el impuesto proyectado lo usaban para invertir Stuff+ a xRV.

## Decisión

1. **`PitchInput` gana `speed_diff`, `ivb_diff` y `hb_diff`, opcionales.**
   - Quien llama los calcula con `models.features.arsenal`, un port de `_fb_diffs` de datos:
     - la familia de rectas es Four-Seam, Sinker, TwoSeam y OneSeam;
     - la referencia es la más usada, o la más rápida si no hay recta;
     - se calcula sobre todas las filas antes de filtrar.
   - `None` significa «sin arsenal»: el modelo rechaza el pitch, **nunca lo lee como cero**.
2. **`uses_arsenal=True` se acepta:**
   - En lote, el archivo debe traer `pitcher_anon_id`, `year` y `altitude_category`.
   - El Simulador lo saca del `arsenal` de la petición. Sin él, responde la razón `missing_arsenal`.
3. **`ScaleSpec.by_type`** guarda (μ, σ) por tipo. `mean_xrv`/`sd_xrv` quedan como valores agregados.
   Toda inversión Stuff+→xRV pasa por `implied_xrv(scale, tipo, valor)` o su equivalente vectorizado.
4. **Location+ no entra al contrato `Scorer`.** Responde otra pregunta, con otras variables (plato,
   conteo, manos), así que tiene su propio modelo y su propia validación (`models/location/final.py`).

## Consecuencias

- v0 sigue idéntico: `by_type=None` y `uses_arsenal=False` recorren el mismo camino que antes.
- Un modelo con un solo booster da un solo draw:
  - la costura no lo muestra en pantallas;
  - la API lo devuelve con `se: null`;
  - las bandas llegan con los boosters por fold (docs/15 §5).
- El cambio de escala es MAJOR: el modelo es `1.0.0+19966f3`.
