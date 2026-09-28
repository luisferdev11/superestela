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

De aquí en adelante, producto **no construye pantallas nuevas con scores** hasta que ustedes
entreguen. La razón es que el equipo tiene que poder defender en la entrevista el modelo que se
entrega, y eso solo pasa si lo construye quien lo va a explicar.

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
| P1 Radar | Stuff+ HH y nivel del mar por lanzador-temporada, Impuesto de Altitud | En `main`, sobre v0 |
| P4 Simulador | Stuff+ de un pitch que nadie lanzó, en los dos entornos, con Δ | En `main`, sobre el puente |
| P3 Traductor | Stuff+ HH proyectado de un lanzador de fuera | **Espera a A3** |
| P2 Ficha | Stuff+ por pitch y arsenal; SHAP cuando llegue A1 | **Espera a A3** |
| P5 Plan | Stuff+ ponderado por uso, antes y después | **Espera a A3** |
| P6–P8 | Stuff+ por entorno y rol | Esperan a A3 y al Q&A |
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
| 15 oct | Entrega |

La escala es un cambio MAJOR del modelo y obliga a reescalar el Radar. Si cambia, tiene que ser
antes del 12.

---

## 7. Qué hace producto mientras tanto

Lo que no toca scores: el copy de cumplimiento en la app, la preparación del Q&A, `report/build.py`,
la ficha ejecutiva, el Decision Log y el deck. Si necesitan algo de producto para avanzar (un
endpoint, un cambio al contrato, una tabla del reporte), se pide en un issue y se hace.
