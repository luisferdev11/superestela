# SuperEstela — Lo que producto necesita del equipo de datos

> Escrito el **28 de septiembre de 2026**. Es para el equipo de datos: qué es suyo, qué contrato
> llenan, cómo se sabe que su modelo sirve y en qué pantalla aparece cada pieza.
>
> **No propone modelos, features ni targets.** Eso lo decide el equipo de datos. Producto deja el
> contrato y los criterios; el cómo es de ustedes.

---

## 1. La regla

La P4 (Simulador) fue la única vez que producto hizo trabajo de datos: construyó el puente v0 con
bolsas y sus compuertas porque el entregable 4 no podía esperar ([ADR 0007](adr/0007-contrato-del-scorer-y-escala.md)).
**Ese puente no es el modelo que se entrega.** Tiene R² fuera de muestra de 0.003 y no usa el
arsenal.

De aquí en adelante la frontera es **modelo contra pantalla**:

- **Producto** construye todas las pantallas, las edita y mejora su UX sobre los artefactos de v0 que
  ya existen (`mockup_data.json`, `arsenals.json`, `evidence.json`, `simulator.json`). No espera a la
  API ni a A3: cuando llegue el modelo final cambian los números, no las pantallas.
- **Datos** construye el modelo que se entrega: targets, features, pesos, el puente a carreras y su
  escala. Producto no hace otro puente ni otro modelo. La razón es que el equipo tiene que poder
  defender en la entrevista el modelo que se entrega, y eso solo pasa si lo construye quien lo va a
  explicar.

---

## 2. Qué es de ustedes

| Pieza | Pregunta | Hecho cuando | Dónde está el detalle |
|---|---|---|---|
| **A1** | ¿Los modelos por componente, agregados a xRV, superan al ajuste directo del run value? | Existe `packages/models/targets/` y una corrida de MLflow con `question=A1` | `docs/05` Track A, `docs/08` §3.1 |
| **A2** | ¿Linear weights clásicos o estimados sobre LMB? | Existe `packages/models/train.py` y su corrida | Ídem |
| **A3** | ¿El xRV correlaciona con el run value observado por lanzador-temporada? Hoy r = −0.08 | Existe `packages/models/evaluate.py` y una corrida con `xrv_vs_observed_r` | Ídem |
| **C1** | ¿El Índice de Densidad continuo aporta sobre las 3 categorías? | Ablación reportada | `docs/05` Track C |
| **C2** | ¿Las features de arsenal aportan, calculadas point-in-time? | Ablación reportada | Ídem |
| **C3** | ¿Cuánto se infla la métrica con fuga de futuro? | Las dos corridas y su diferencia | Ídem |
| **Escala** | ¿Qué es 100? | Decisión escrita antes del 12 oct | [ADR 0007](adr/0007-contrato-del-scorer-y-escala.md) punto 4: está como **propuesta**, no como decisión |
| **Location+ y Pitching+** | El entregable 1 los pide por lanzamiento y hoy no existen | Existen, o `docs/08` dice por qué no | Depende del Q&A del 30 sep |

`notebooks/Algobien.ipynb` (#33) es exploración de targets. Cuenta como avance, pero A1 se cumple
cuando ese trabajo vive en `packages/models/` con tests (`CONVENTIONS.md` §8.5).

---

## 3. El contrato que llenan

Está en `packages/models/scoring.py`. Cualquier modelo que lo cumpla entra al producto **sin que
producto toque la API ni las pantallas**: solo cambia `model_id`.

```python
class Scorer(Protocol):
    model_id: str            # CONVENTIONS.md 5.3
    uses_arsenal: bool       # v0: False. Se espera True desde A1
    scale: ScaleSpec         # cómo se definen el 100 y la desviación

    def score(self, pitch: PitchInput, arsenal: ArsenalContext | None,
              density_index: float) -> Score: ...        # Score(value, se, model_id)

    def draws(self, pitches, density_indices) -> ndarray: ...   # una fila por draw
```

Lo que el producto necesita de ese contrato, y por qué:

- **`se` en cada score.** Ninguna pantalla muestra un número sin banda (`CONVENTIONS.md` §8.2). Un
  modelo sin incertidumbre no se puede mostrar.
- **`draws` conjuntos.** El Δ entre nivel del mar y el Harp Helú comparte los draws de los dos
  entornos; sumar los dos `se` exageraría la banda.
- **`density_index` como entrada continua.** Es la tesis del producto (C1). Si C1 dice que no aporta,
  se dice así y el contrato no cambia.
- **`ArsenalContext`** trae la recta primaria y el uso. Ya viaja desde la API aunque v0 lo ignore.
- **`PitchInput`** usa el marco del brazo: lo horizontal es positivo hacia el brazo que lanza.

---

## 3.1 Lo que la Ficha ya espera de ustedes

La Ficha (P2) se construyó tal como el prototipo. Dos partes se ven en pantalla pero **esperan
trabajo de datos**, y la pantalla lo dice en vez de inventar cifras.

### La ubicación: `analysis/outputs/locations.json`

La pestaña Arsenal (`/pitchers/<id>/<temporada>/arsenal`) muestra dónde pone sus lanzamientos cada
lanzador en cada entorno. Mientras el archivo no exista, cada mapa dice «pendiente: Location+». El
día que exista, la pantalla lo pinta sin tocar código. La app lo valida con Zod
(`packages/web/src/sources/locationSource.ts`): si la forma no coincide, falla con nombre de campo.

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

Las cifras del ejemplo son las del prototipo, solo para ilustrar la forma. El dataset ya trae
`PlateLocHeight`, `PlateLocSide` e `in_strike_zone`. `analysis/outputs/location_grid.json` es de la
época del prototipo, sin script que lo genere y con un solo lanzador: no sirve como fuente.

**Lo que decide el equipo de datos:** el tamaño de la rejilla, el suavizado, el mínimo de muestra y si
la ubicación se mide relativa al bateador. «Lo que dice su ubicación» (si sobrecompensa la altura
con la mira) también queda pendiente: necesita una regla que ustedes respalden.

### El veredicto de «Lectura del sistema»

La Ficha cierra con «Fichar», «Fichar con reservas» o «No fichar al precio de nivel del mar». Hoy lo
decide una **regla provisional de producto**, declarada en pantalla
(`packages/web/src/domain/reading.ts`):

- Trampa de Altitud → no al precio de nivel del mar.
- Banda completa del Stuff+ en altitud extrema por encima de 100 → fichar.
- Lo demás → con reservas.

La regla se apoya en v0. Para que el veredicto deje de ser provisional hace falta que A3 muestre que
el Stuff+ ordena lo que importa (carreras, o el target que se acuerde en el Q&A), y que ustedes
digan qué umbral lo sostiene. Si cambian la regla, basta con cambiar `verdictOf`: la pantalla no se
toca.

## 4. Cómo se sabe que el modelo sirve

Las compuertas de `analysis/simulator_gates.py` (`docs/09` §5). **Aplican igual a su modelo** que al
puente:

| Compuerta | Qué exige | Si falla |
|---|---|---|
| S1–S4 | Monotonía en la recta, espejo por mano, suavidad por paso, consistencia con el Radar | El Stuff+ no se muestra |
| S5–S7 | Calibración, experimento natural y el baseline nulo del reto | Se reporta tal como salga |

Hoy el puente pasa S1–S6 y **falla S7**: el conteo solo le gana a la física sola. Ese es el número a
batir. Se corre con `uv run python analysis/simulator_gates.py` y deja el veredicto junto al modelo
en `artifacts/`.

Falta `model-eval.yml`, que correría esto en cada PR de modelo (`docs/08` §3.3). Es de ingeniería,
no de datos: lo puede hacer producto si ustedes lo prefieren.

---

## 5. Dónde aparece cada pieza

Para que se vea por qué importa cada una:

| Pantalla | Qué muestra de su trabajo | Estado |
|---|---|---|
| P1 Radar | Stuff+ en altitud extrema y nivel del mar por lanzador-temporada, Impuesto de Altitud | En `main`, sobre v0 |
| P4 Simulador | Stuff+ de un pitch que nadie lanzó, en los dos entornos, con Δ | En `main`, sobre el puente |
| P3 Traductor | Stuff+ en altitud extrema proyectado de un lanzador de fuera | En PRs (#67–#71), sobre el puente |
| P2 Ficha | Stuff+ por pitch y arsenal; ubicación (§3.1); SHAP cuando llegue A1 | Construida sobre v0; la ubicación y el veredicto esperan (§3.1) |
| P5 Plan | Stuff+ ponderado por uso, antes y después | En `main`, sobre v0 |
| P6 y P8 | Stuff+ por entorno y rol | En `main`; demostrativas, con el plantel aproximado (ADR 0008) |
| P7 Proyección | Forma proyectada por pitch | Datos en `main` (#57), pantalla en #58 |
| Documento técnico | Las tablas de A1–A3 y C1–C3 | Se congela el 12 oct |

Ninguna pantalla imprime carreras: el puente Stuff+ → carreras no existe mientras A3 no lo muestre.

---

## 6. Fechas

| Fecha | Qué |
|---|---|
| 30 sep, 17:00 | Q&A con Diablos: escala, target, estadios, Location+ y Pitching+ |
| **1 oct** | **Puerta A3.** Si no hay un xRV que correlacione con el run value observado, se recorta alcance de producto, no de validación (`docs/08` §2) |
| 12 oct | Congelamiento: ningún número cambia después |
| 13 oct | Ensayo de los 10 minutos |
| 22 oct | Entrega (era el 15) |

La escala es un cambio MAJOR del modelo y obliga a reescalar el Radar. Si cambia, tiene que ser
antes del 12.

---

## 7. Qué hace producto mientras tanto

Las pantallas que faltan (`docs/10`), sobre v0, más lo que no es pantalla: `report/build.py`, la
ficha ejecutiva, el Decision Log y el deck. Si una pantalla necesita un número que todavía no existe,
se les pregunta antes de calcularlo; nunca se inventa. Si ustedes necesitan algo de producto (un
endpoint, un cambio al contrato, una tabla del reporte), se pide en un issue y se hace.

---

## 8. Después del Q&A (30 de septiembre) · lo que cambió para ustedes

Las respuestas completas están en [`docs/10` §5](10-PANTALLAS-RESTANTES.md). Para datos, en orden:

### 8.1 Prioridad 1 · un scorer que ellos puedan correr

**Diablos va a evaluar todos los modelos contra su propio holdout: la postemporada 2026.** Lo que mide
es que el modelo generalice. Sin algo que corra sobre sus datos, no hay entrega.

- **Qué es:** un comando que recibe un archivo con las mismas columnas del dataset y devuelve Stuff+
  por lanzamiento, con su banda.
- **Contrato:** `packages/models/scoring.py` (`Scorer`), el mismo que ya llena el puente v0.
- **Hecho cuando:** el README documenta el comando, y alguien que no lo escribió lo corre sobre un
  CSV de prueba y obtiene un archivo con `stuff_plus` y `stuff_plus_se` por fila.
- **Actualización del 1 de octubre: el comando ya existe** y lo construyó producto: `python -m
  models.score` (#61–#63, [ADR 0009](adr/0009-arnes-de-scoring.md)). Hoy contesta el puente v0.
  **Lo que les toca es el modelo, no el comando:** un objeto que cumpla `Scorer`, guardado con
  `joblib` en `artifacts/`, que pase las compuertas. Entra con `--model` y el `model_id` de cada fila
  dice cuál contestó. Si su modelo usa el arsenal, hay que extender `Scorer.draws`, y eso se acuerda
  entre los dos equipos.

### 8.2 El target · el enfoque que decidió Martín

En la altura, una bola en juego cuesta más: 7.55 carreras por 9 entradas contra 4.84 a nivel del mar
(`evidence.json` → `run_environment`). Por eso Diablos prioriza el whiff y el ponche. El enfoque
decidido es que el modelo lo aprenda de los datos, sin un peso puesto a mano:

1. Modelos por componente (A1): P(swing), P(whiff | swing), P(strike cantado), P(en juego) y la
   calidad del contacto, con el índice de densidad como feature.
2. **El valor de cada evento, estimado por categoría de altitud** (A2). Como evitar una bola en juego
   vale más en la altura, el whiff gana peso solo.
3. xRV = Σ P(evento) × valor del evento en ese entorno.
4. **Validación:** en altitud extrema, el Stuff+ debe correlacionar más con el whiff que a nivel del
   mar. Si pasa, la idea quedó demostrada en vez de supuesta.

**Hallazgo de Martín:** el modelo entrenado sin separar por tipo de pitch aprende mejor que los
modelos por tipo (MLflow, `p_chase`). Es lo esperado: más datos y estructura compartida. La sugerencia
de producto es un solo modelo con `pitch_type` como feature, y la normalización por tipo en la escala
(§8.3), no en el entrenamiento. La decisión es suya.

### 8.3 La escala · 100 por entorno

Emilio: «ese sería por estadio […] el mismo picheo puede valer 120 a nivel del mar, pero 150 en la
altura». O sea, **100 es el promedio de cada entorno**, y probablemente de cada tipo de pitch.

- Hoy el v0 normaliza sobre toda la liga, y el ADR 0007 proponía normalizar a nivel del mar con la
  altitud como Δ. **Ninguna de las dos es lo que pidió.**
- Es un cambio MAJOR (`CONVENTIONS.md` §5.3): reescala el Radar y cambia el significado del Δ y de la
  Trampa. **Tiene que decidirse antes del 12.**
- **Confirmar por correo** con este ejemplo: «¿100 es el promedio de los lanzamientos del mismo tipo
  en la misma categoría de altitud, de modo que un slider promedio en altitud extrema vale 100 aunque
  rompa menos que uno promedio a nivel del mar?»
- Al decidirla, actualicen el punto 4 del ADR 0007.

### 8.4 Location+ y Pitching+ · después del scorer

Se evalúa sobre todo Stuff+; los otros dos son un plus, y Emilio dijo que «salen y nacen de Stuff+».
Van **después** de 8.1. La pestaña Arsenal de la Ficha ya espera la ubicación por `locations.json`
(§3.1). Si no alcanza el tiempo, van en la sección **«qué haríamos con más tiempo»**, que también
cuenta.

### 8.5 Reglas que quedaron claras

- **Fuentes externas:** solo públicas, reproducibles, y documentando para qué se usaron.
- **Datos faltantes:** son normales en las métricas de batazo. La política de exclusión o imputación
  va escrita en el documento técnico, porque también se evalúa.
- **«Altitud extrema» son cinco parques** (Puebla, CDMX, Aguascalientes, Querétaro y León), no el
  Harp Helú. Ver [`reference/categorias-altitud.md`](reference/categorias-altitud.md).
