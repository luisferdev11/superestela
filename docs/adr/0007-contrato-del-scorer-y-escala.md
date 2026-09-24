# ADR 0007 · El Stuff+ se pide por un contrato, y lo llena el mejor modelo que pase las compuertas

**Fecha:** 23 de septiembre de 2026 · **Estado:** aceptada para el contrato y el puente · **propuesta** para la escala, pendiente del equipo de datos

## Contexto

El Simulador (entregable 4 del reto) tiene que dar el **Stuff+ estimado** de un pitch que nadie lanzó:
el coach mueve un slider y espera un número. Hoy **ningún modelo puede hacerlo**. `stuff_plus_v0` vive
dentro de `analysis/evidence.py`, se reentrena en cada pliegue del CV y no se guarda. El modelo final
(A1–A3) no ha empezado, y su puerta es el 1 de octubre.

Hay tres salidas malas:

- **Esperar a A3** deja sin Stuff+ al único entregable que el reto exige por nombre.
- **Una fórmula a mano** es lo que tenía el prototipo, y rompe «ninguna cifra sin corrida».
- **Casar la pantalla con v0** obliga a reescribirla cuando llegue A3, y v0 tiene R² 0.003.

Detalle científico en [`docs/09`](../09-SIMULADOR.md).

## Decisión

**1. Un contrato, `packages/models/scoring.py`.**

```python
class Scorer(Protocol):
    model_id: str            # "stuff_plus_v0_bridge+<sha7>"
    uses_arsenal: bool       # v0: False. A1: True
    scale: ScaleSpec         # how 100 and the sd are defined (point 3)

    def score(self, pitch: PitchInput, arsenal: ArsenalContext | None,
              density_index: float) -> Score: ...   # Score(value, se)
```

- `PitchInput` trae los features físicos del reto (`CONVENTIONS.md` §2.2): `release_speed`, `ivb`,
  `horizontal_break`, `spin_rate`, `spin_axis`, `extension`, `release_height`, `release_side`,
  `pitch_type`, `pitcher_hand`.
- `ArsenalContext` trae la recta primaria y el uso. **Viaja desde el día uno aunque v0 lo ignore**, para
  que A1 lo consuma sin tocar la API ni la pantalla.

**2. v0 como puente, declarado.**
- `packages/models/stuff/v0_bridge.py` mueve el entrenamiento de v0 fuera de `analysis/`, con los mismos
  features.
- Entrena unas 20 bolsas bootstrap por lanzador: `value` es la media y `se` la desviación.
- Guarda las constantes de escala, para que su Stuff+ sea el del Radar.
- La pantalla dice qué modelo contesta y que no usa arsenal.

**3. Compuertas.**
- Un modelo solo se muestra si pasa las compuertas S1–S4 de `docs/09` §5: monotonía en la recta, espejo
  por mano, suavidad por paso de slider y consistencia con el Radar.
- S5–S7 (calibración, experimento natural y baseline nulo del reto) se reportan tal como salgan.
- Las corre `analysis/simulator_gates.py`, que vive junto a `evidence.py` porque necesita el dataset, y quedan en `analysis/outputs/simulator_validation.json`.
- **Aplican igual a A3.** Son también su criterio de aceptación en `model-eval.yml`.

**4. Propuesta de escala para A3 (decide el equipo de datos).**
- El reto: «un número por encima de 100 **siempre** significa mejor que promedio, independientemente del
  pitch type», con 100 = «promedio LMB ajustado por temporada y estadio».
- Hoy v0 normaliza sobre toda la liga, ambos entornos y todos los tipos. Un slider promedio no es 100, y
  el Harp Helú promedia debajo de 100 por construcción.
- La propuesta:
  - `μ` y `σ` **por tipo de pitch y temporada**, calculados sobre pitches a nivel del mar;
  - el efecto del entorno se **reporta como Δ** con su propia banda, en vez de absorberlo en la media.
- Así «>100» significa lo que dice el reto, y el Impuesto de Altitud sigue siendo visible.
- Es un **MAJOR** en la versión del modelo (`CONVENTIONS.md` §5.3), así que exige reescalar el Radar.
  Tiene que decidirse antes del congelamiento del 12 de octubre, no después.

## Consecuencias

- El Simulador se construye ya, sin esperar a A3, y **no se reescribe** cuando A3 llegue: cambia el
  `model_id`.
- Si v0 no pasa S1–S4, el Stuff+ no aparece. La pantalla sigue entregando la física, el mapa y los
  diferenciales. Es un costo aceptado: un número que salta con el slider le quita credibilidad a todo lo
  demás frente al coach.
- El equipo de datos recibe un criterio de aceptación ejecutable antes de escribir A1, no después.
- La escala queda abierta y con fecha. Si datos la rechaza, el reto y `docs/00` §4 explican por qué
  diferimos de su letra.
