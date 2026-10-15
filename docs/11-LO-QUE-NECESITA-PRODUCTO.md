# SuperEstela — Guía de integración para el equipo de datos

> **Reescrita el 1 de octubre de 2026** para que datos integre sus modelos sin depender de producto.
> Reemplaza la versión del 28 de septiembre («Lo que producto necesita del equipo de datos»); lo que
> seguía vigente de ella está aquí.
>
> **No propone modelos, features ni targets.** Eso lo decide el equipo de datos. Aquí está por dónde
> entra cada pieza, cómo se comprueba que entró, y qué falla si algo no cuadra.

---

## 0. En una página

**Las ocho pantallas están construidas** y corren sobre el v0 (P1–P8, `scripts/check_pendientes.py`).
Cuando llega un modelo nuevo, cambian los números; las pantallas no.

**Lo que ustedes entregan es un archivo:** un objeto que cumpla `models.scoring.Scorer`, guardado con
`joblib` en `artifacts/`. Nunca va a git, porque se deriva de datos licenciados. La clase es libre.

**Un solo comando lo lleva a todo el producto** ([ADR 0010](adr/0010-una-sola-entrada-para-el-modelo.md)):

```bash
uv run python scripts/regenerate.py --model artifacts/<suyo>.joblib
```

| Qué recibe su modelo | Por dónde |
|---|---|
| Radar, Ficha, Plan, Despliegue y Plantel | `evidence.py --model` → `mockup_data.json` |
| Simulador y Traductor | La API, con `SUPERESTELA_MODEL=artifacts/<suyo>.joblib` |
| Las compuertas S1–S7 | `simulator_gates.py --model`, que deja el veredicto junto al archivo |
| El holdout de Diablos | `python -m models.score in.csv out.csv --model artifacts/<suyo>.joblib` |
| Las tablas del documento técnico | `python -m report.build` |

Sin `--model`, todo da los números de hoy, sin un byte de diferencia (verificado el 1 de octubre).

---

## 1. La regla

- **Producto** construye las pantallas, la API, los comandos y las compuertas. **Datos** construye el
  modelo: targets, features, pesos, el puente a carreras y la escala.
- El puente v0 (ADR 0007) **no es el modelo que se entrega.** Tiene un R² fuera de muestra de 0.003 y
  no usa el arsenal. Existe para que el Simulador funcione mientras llega el de ustedes.
- La razón: el equipo tiene que poder defender en la entrevista el modelo que se entrega, y eso solo
  pasa si lo construye quien lo va a explicar.
- Si necesitan algo de producto (un campo en el contrato, un endpoint, una tabla del reporte), se
  pide en un issue o en el PR, y se hace.

---

## 2. Integrar un modelo, paso a paso

**1. Rama desde `main`:** `git switch -c feat/<modelo> origin/main` (`CONVENTIONS.md` §6).

**2. El modelo cumple el contrato** (§3) y se guarda: `joblib.dump(modelo, "artifacts/<suyo>.joblib")`.
Que cargue se comprueba así:

```bash
uv run python -c "from models.scoring import load_scorer; print(load_scorer('artifacts/<suyo>.joblib').model_id)"
```

**3. Regenerar con su modelo:**

```bash
uv run python scripts/regenerate.py --model artifacts/<suyo>.joblib
```

En orden: `evidence.py` (las tarjetas), `projection_evidence.py`, `simulator_gates.py` (el veredicto
en `artifacts/<suyo>.validation.json`) y `report.build`. Se detiene en el primer paso que falle.

**4. Verlo en la app.** Una terminal por línea, desde la raíz:

```bash
SUPERESTELA_MODEL=artifacts/<suyo>.joblib uv run uvicorn api.main:app --port 8000
cd packages/web && pnpm build && pnpm start          # http://localhost:3000
```

- El Simulador muestra el Stuff+ solo si su veredicto pasó S1–S4. Si no, dice «modelo en validación».
- La línea de procedencia nombra su `model_id`.

**5. Correr las pruebas:** `uv run pytest`, y en `packages/web`, `pnpm lint && pnpm typecheck && pnpm test`.
Hay **11 tests de la web que van a fallar a propósito** (§6.1): fijan las cifras del v0 de la historia
de `pitcher_00069`. Se actualizan en el mismo PR.

**6. Publicar, cuando el modelo sea el que se presenta:**
`scripts/regenerate.py --model artifacts/<suyo>.joblib --publish`. Eso escribe
`analysis/outputs/simulator_validation.json`, el registro que cita el documento técnico.

**7. El PR:**
- Se commitean `analysis/outputs/*.json`, que son agregados, `report/tables/` y el código del modelo
  en `packages/models/` con sus tests.
- El `.joblib` no se commitea.
- El cuerpo lleva la tabla de compuertas (`CONVENTIONS.md` §6.3) y lo revisa alguien que no sea el
  autor.

---

## 3. El contrato (`packages/models/scoring.py`)

```python
class Scorer(Protocol):
    model_id: str                 # MAJOR.MINOR.PATCH+<sha7>, CONVENTIONS.md 5.3
    uses_arsenal: bool            # hoy debe ser False; ver abajo
    scale: ScaleSpec              # description, mean_xrv, sd_xrv, kind
    pitch_types: tuple[str, ...]  # los tipos con que se entrenó; los demás no reciben score

    def score(self, pitch: PitchInput, arsenal: ArsenalContext | None,
              density_index: float) -> Score: ...          # Score(value, se, model_id)

    def draws(self, pitches: Sequence[PitchInput],
              density_indices: Sequence[float]) -> ndarray: ...  # una fila por draw, ≥ 2
```

**Lo que el producto necesita de él, y por qué:**

- **`draws` es el score.** La API, `models.score` y `stuff_plus_of` reportan la media de los draws como
  Stuff+ y su desviación (ddof=1) como `se`. Devuelvan al menos dos draws, y que su media sea lo que
  devuelve `score`. Si no, la API y el archivo del holdout no coinciden.
- **Ningún número sin banda** (`CONVENTIONS.md` §8.2). Un modelo sin incertidumbre no se puede
  mostrar. Si el suyo no tiene posterior, bolsas o un bootstrap sirven.
- **Draws conjuntos.** El Δ entre nivel del mar y altitud extrema comparte los draws de los dos
  entornos. Sumar los dos `se` exageraría la banda.
- **`density_index` es una entrada continua.** Es la tesis del producto (C1). Si C1 dice que no
  aporta, se dice así y el contrato no cambia.
- **`PitchInput` va del lado del brazo:** lo horizontal es positivo hacia el brazo que lanza, y el eje
  de giro está en el marco del diestro. El producto ya refleja a los zurdos (`to_arm_side`), así que su
  modelo recibe los dos con la misma convención.
- **`ScaleSpec.kind`** es `"league"` (v0) o `"per_environment"`, que es lo que pidió Diablos (§5.2).
  Los textos de la web cambian solos con él. Cualquier otro valor detiene `evidence.py`, porque la web
  lo rechazaría.
- **`uses_arsenal=True` todavía no se puede.** `draws` no recibe el arsenal, y por eso `models.score`
  rechaza un modelo así. Si A1 lo necesita, se extiende el contrato primero, entre los dos equipos
  (ADR 0009).

---

## 4. Qué muestra cada pantalla de su trabajo

| Pantalla | Lo que viene de su modelo | Lo que no cambia con él |
|---|---|---|
| **P1 Radar** | Stuff+ en altitud extrema y a nivel del mar, el Δ, «Sufre en la altura» (p70/p30 sobre el Stuff+) y la cohorte | K−BB% y whiff (medidos), el rol (regla) |
| **P2 Ficha** | Stuff+ por lanzador y por pitch, su rango en la temporada, y la lectura «Fichar / con reservas / no fichar» | Forma, física, tasas y temporadas (medidas) |
| **P5 Plan** | Stuff+ ponderado por uso, antes y después de mover el uso | — |
| **P6 Despliegue y P8 Plantel** | Stuff+ por entorno y el cambio de orden entre casa y gira | El plantel aproximado (ADR 0008) |
| **P4 Simulador** | Stuff+ de un pitch que nadie lanzó, en los dos entornos, con Δ | Forma trasladada, VAA, velocidad al plato y comparables (física y datos) |
| **P3 Traductor** | Stuff+ del arsenal de un lanzador de fuera | La traslación de la forma (física) |
| **P7 Proyección** | — | Es física pura: forma proyectada contra medida |
| **Impuesto de Altitud** (Radar y Ficha) | No viene del Stuff+: usa los pesos fijos de §5.1 | — |

Todas las pantallas leen `analysis/outputs/` en el build (`packages/web/src/sources/`). El Simulador y
el Traductor además preguntan a la API en vivo.

---

## 5. Las otras piezas: dónde entra cada una

| Pieza | Dónde entra hoy | Qué hay que hacer |
|---|---|---|
| **A1** · modelos por componente | El `Scorer` (§3) | Entregarlo como `Scorer`; MLflow con `question=A1` |
| **A2** · pesos de run value | `analysis/evidence.py → RUN_VALUE` | Ver §5.1 |
| **A3** · Stuff+ → carreras | No tiene artefacto | Ver §5.3 |
| **Escala** | `ScaleSpec` del modelo | Ver §5.2 |
| **Location+** | `analysis/outputs/locations.json`, que la Ficha ya lee | Ver §5.4 |
| **Pitching+** | No tiene lugar todavía | Pedirlo: un campo en `mockup_data.json` y su texto |
| **SHAP** (la «Ficha Técnica» del prototipo) | No tiene lugar todavía | Pedirlo cuando A1 exista |
| **C1–C3** · ablaciones | Corridas de MLflow y `report/claims.toml` | Las tablas las genera `report.build` |
| **Lectura de la Ficha** | `packages/web/src/domain/reading.ts`, `verdictOf` | Ver §5.5 |

**RA/9 de la Ficha** (14 oct): `analysis/pitcher_runs.py` escribe `analysis/outputs/pitcher_runs.json`
(carreras permitidas por 9 entradas, por lanzador-temporada y entorno). Es medido, no sale del modelo, y
`scripts/regenerate.py` lo corre. Si datos consigue carreras limpias, se reemplaza por ERA ahí mismo.

### 5.1 A2 · los pesos

`RUN_VALUE` (`analysis/evidence.py`) son pesos sabermétricos clásicos puestos a mano. De ahí salen:

- el target del v0;
- el Impuesto de Altitud, en carreras por 9 entradas, que es el único número en carreras que muestra
  el producto.

Si A2 estima pesos por categoría de altitud, se reemplaza ese diccionario por una función de pesos
por entorno, o el Impuesto se calcula con su xRV. Lo que convenga, se acuerda en el PR.

### 5.2 La escala · 100 por entorno

Diablos pidió 100 **por entorno** («el mismo picheo puede valer 120 a nivel del mar, pero 150 en la
altura»), probablemente también por tipo de pitch. El v0 normaliza sobre toda la liga.

- Es un cambio MAJOR (`CONVENTIONS.md` §5.3): cambia el significado del Δ y de «Sufre en la altura».
- El contrato ya lo soporta: `ScaleSpec(kind="per_environment", description=...)`, y la web ajusta sus
  textos (`es.scale`). Al decidirla, actualicen el punto 4 del ADR 0007.
- Falta la confirmación por correo, con este ejemplo: «¿100 es el promedio de los lanzamientos del
  mismo tipo en la misma categoría de altitud, de modo que un slider promedio en altitud extrema vale
  100 aunque rompa menos que uno promedio a nivel del mar?» (tarea 2 de `docs/08` §0.0).

**Traductor de varios lanzadores** (14 oct): `POST /api/v1/arsenals/score` puntúa cada lanzador de un
archivo en el formato del dataset con su `Scorer` (draws conjuntos en los dos aires). Muestra un
**Impuesto proyectado** que invierte `scale.sd_xrv`; si A2/A3 dan una forma mejor de pasar Stuff+ a
carreras, se cambia en `api/arsenal_batch.py`. Su revisión contra el medido está en
`analysis/projected_tax_check.py`, que corre `scripts/regenerate.py`.

### 5.3 A3 · carreras

Ninguna pantalla imprime carreras desde el Stuff+: el puente no existe mientras A3 no lo muestre. Los
textos del Simulador, el Traductor y el Plan lo dicen. Cuando A3 exista, se
pide el campo y producto lo muestra.

### 5.4 Location+ · `analysis/outputs/locations.json`

La pestaña Arsenal (`/pitchers/<id>/<temporada>/arsenal`) muestra dónde pone sus lanzamientos cada
lanzador en cada entorno.

- Mientras el archivo no exista, cada mapa dice «pendiente: Location+».
- El día que exista, la pantalla lo pinta sin tocar código.
- La forma se valida con Zod (`packages/web/src/sources/locationSource.ts`). Si no coincide, falla con
  el nombre del campo.

```jsonc
{
  "pitcher_00069/2025": {           // la misma llave que arsenals.json
    "sea": {                         // null si no hay muestra en ese entorno
      "n_pitches": 543,
      "mean_plate_height_ft": 2.64,
      "zone_share": 0.424,           // entre 0 y 1
      "whiff_per_swing": 0.264,      // entre 0 y 1
      "grid": [[0.0, 0.1], [0.2, 0.4]],  // densidad por celda; filas de arriba abajo
      "side_range_ft": [-2.0, 2.0],  // vista del cátcher, positivo a su derecha
      "height_range_ft": [0.5, 4.5]
    },
    "hh": { "...": "igual" }
  }
}
```

- Las cifras del ejemplo son las del prototipo y solo ilustran la forma.
- El dataset ya trae `PlateLocHeight`, `PlateLocSide` e `in_strike_zone`.
- `location_grid.json` es de la época del prototipo, no tiene script y no sirve como fuente.
- **Lo deciden ustedes:**
  - el tamaño de la rejilla, el suavizado y el mínimo de muestra;
  - si la ubicación se mide relativa al bateador.

### 5.5 La lectura de la Ficha

«Fichar», «Fichar con reservas» o «No fichar al precio de nivel del mar» salen de una **regla
provisional de producto**, que se declara en pantalla:

- Sufre en la altura → no al precio de nivel del mar.
- La banda entera del Stuff+ en altitud extrema por encima de 100 → fichar.
- Lo demás → con reservas.

Para que deje de ser provisional, A3 tiene que mostrar que el Stuff+ ordena lo que importa, y ustedes
decir qué umbral lo sostiene. Cambiar la regla es cambiar `verdictOf`; la pantalla no se toca. El
corte en 100 supone la escala del v0. Con escala por entorno se revisa junto con §5.2.

---

## 6. Cómo se sabe que entró bien

**Las compuertas** (`analysis/simulator_gates.py`, `docs/09` §5) aplican igual a su modelo:

| Compuerta | Qué exige | Si falla |
|---|---|---|
| S1–S4 | Monotonía en la recta (+1 mph sube el score), espejo por mano, suavidad por paso de slider, y consistencia con el Radar (r ≥ 0.9, \|Δ\| ≤ 3) | El Stuff+ no se muestra en el Simulador ni en el Traductor |
| S5–S7 | Calibración por deciles, el experimento natural, y el baseline nulo del reto (run value por conteo) | Se reporta tal como salga |

- El puente pasa S1–S6 y **falla S7**: el conteo solo le gana a la física sola. **Ese es el número a
  batir.**
- **Con su modelo, S5 y S7 leen sus propias predicciones** sobre el dataset. Solo son fuera de pliegue
  si el modelo se construyó así. Si no, salen optimistas, y el documento técnico lo tiene que decir.
- S4 compara el Simulador contra el Radar. Con `--model` los dos salen del mismo modelo, así que
  comprueba que la tarjeta (la media por pitch) y el pitch medio coincidan. Con el puente dio r = 0.981.

### 6.1 Lo que va a fallar a propósito

| Qué | Por qué | Qué hacer |
|---|---|---|
| **11 tests de la web**: `domain/{arsenal,plan,reading,pitcher,roster}.test.ts`, `components/pitcher/{ArsenalTable,Ficha}.test.tsx` | Fijan las cifras del v0 de la historia de `pitcher_00069` («la recta pasa de 111.0 a 90.4»), la del prototipo y la de `docs/09` §5.2 | Actualizar las cifras en el mismo PR, y la historia si cambió. Con el puente vía `--model` fallaron 11 de 160; los 149 restantes, esquemas incluidos, pasaron |
| **`report.build --check`** | Una afirmación de `report/claims.toml` cita un número que cambió | Actualizar el texto de la afirmación: debe citar el número que se comprueba |
| **Zod `.strict()`** en `mockup_data.json` | Una llave nueva rompe la web | Los datos nuevos solo para Python van en `evidence.json`, que no es estricto; para la web, se pide el campo |
| **Stuff+ fuera de 40–160** | El esquema de la web lo rechaza (`sources/schema.ts`) | Revisar la escala antes de ampliar el rango |

---

## 7. Lo que sigue pendiente de ustedes

| Pieza | Hecho cuando | Detalle |
|---|---|---|
| **A1** | Un `Scorer` en `packages/models/` con tests, que pase S1–S4, y una corrida con `question=A1` | `docs/05` Track A |
| **A2** | Pesos estimados en LMB, con su corrida | §5.1 |
| **A3** | Una corrida con `xrv_vs_observed_r` | §5.3 |
| **C1–C3** | Las ablaciones reportadas | `docs/05` Track C |
| **Escala** | `ScaleSpec.kind` decidido y el ADR 0007 actualizado | §5.2 |
| **Location+ / Pitching+** | Existen, o el documento dice por qué no («qué haríamos con más tiempo» también cuenta) | §5.4 |

`notebooks/` cuenta como exploración. Una pieza se cumple cuando vive en `packages/models/` con
tests (`CONVENTIONS.md` §8.5).

---

## 8. Fechas

| Fecha | Qué |
|---|---|
| 22 oct | Entrega (confirmada) |
| 19 oct | Congelamiento de cifras (propuesto; falta que el equipo lo confirme) |
| 20 oct | Ensayo completo con la app local (propuesto) |

La escala es un cambio MAJOR: si cambia, tiene que ser antes del congelamiento.

---

## 9. Lo que dejó el Q&A (30 de septiembre) para ustedes

Las respuestas completas están en [`docs/10` §5](10-PANTALLAS-RESTANTES.md).

- **El holdout es la postemporada 2026.** Lo corren con `python -m models.score` ([ADR 0009](adr/0009-arnes-de-scoring.md)).
  Falta confirmar qué columnas trae y quién corre el comando (tarea 2 de `docs/08` §0.0).
- **Diablos prioriza whiff, K y K−BB.** En la altura, una bola en juego cuesta más: 7.55 carreras por
  9 entradas contra 4.84 a nivel del mar (`evidence.json → run_environment`).
- **El enfoque que decidió Martín** es que el modelo aprenda eso de los datos, sin un peso puesto a
  mano:
  1. modelos por componente (A1);
  2. el valor de cada evento estimado por categoría de altitud (A2);
  3. xRV = Σ P(evento) × valor del evento.

  Se valida si, en altitud extrema, el Stuff+ correlaciona más con el whiff que a nivel del mar.
- **Su hallazgo:** un solo modelo con `pitch_type` como feature aprende mejor que uno por tipo.
  Producto sugiere normalizar por tipo en la escala, no en el entrenamiento. La decisión es suya.
- **Location+ y Pitching+ son un plus**, después del Stuff+.
- **Fuentes externas:** solo públicas, reproducibles y documentando para qué se usaron.
- **Datos faltantes:** la política de exclusión o imputación va escrita en el documento técnico.
- **«Altitud extrema» son cinco parques** (Puebla, CDMX, Aguascalientes, Querétaro y León), no el Harp
  Helú ([`reference/categorias-altitud.md`](reference/categorias-altitud.md)).
