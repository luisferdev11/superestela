# ADR 0009 · El comando que puntúa un archivo es de producto; el modelo que contesta es de datos

**Fecha:** 1 de octubre de 2026 · **Estado:** aceptada

## Contexto

En el Q&A del 30 de septiembre, Diablos dijo que va a evaluar **todos** los modelos contra su propio
holdout, la postemporada 2026 (`docs/10` §5). Para eso necesita correr el nuestro sobre un archivo
que nosotros nunca vimos. Hasta hoy no había cómo: el Stuff+ solo salía pitch por pitch, desde el
Simulador o la API.

Hay dos piezas, y conviene que nunca se confundan:

1. **Un comando** que lee el archivo, lo convierte en la entrada del contrato, pregunta y escribe la
   respuesta.
2. **Un modelo** que decide cuánto vale cada pitch.

Si las dos viven en el mismo lugar, cada cambio de modelo rompe el comando, y nadie sabe qué número
salió de qué modelo.

## Decisión

**1. El comando es de producto y no cambia cuando cambia el modelo.**

```bash
uv run python -m models.score pitches.csv scores.csv [--model artifacts/<modelo>.joblib]
```

- Vive en `packages/models/batch.py` (la lógica) y `packages/models/score.py` (la línea de comandos).
- Recibe un CSV o parquet con las **columnas del dataset**, con sus nombres de origen (`RelSpeed`,
  `InducedVertBreak`, …).
- Escribe **una fila por cada fila de entrada**, en el mismo orden, con estas columnas:
  `pitch_id, stuff_plus, stuff_plus_se, status, density_index, density_source, model_id`.
- Junto a la salida escribe **`<salida>.meta.json`**: qué archivo de modelo contestó, su clase, su
  `model_id` y su hash, si pasó las compuertas, el hash del archivo de entrada y cuántas filas
  recibieron score.
- **Nunca sale un número sin su banda.** Una fila sin score deja `stuff_plus` y `stuff_plus_se`
  vacíos y dice por qué en `status`: `unsupported_pitch_type`, `missing_features`, `unknown_hand` o
  `missing_density`.

**2. El modelo es de datos y entra por el contrato.**

- El modelo es **cualquier objeto que cumpla `models.scoring.Scorer`**, guardado con `joblib`. Hoy es
  el puente v0 que entrena `analysis/simulator_gates.py` (ADR 0007). El modelo final entra igual:
  datos guarda su `Scorer` en `artifacts/` y se pasa con `--model`.
- El comando **no decide nada sobre la calidad del pitch**. Las features, el target, la escala, cómo
  trata el lado del bateador y qué tipos de pitch acepta (`pitch_types`) son del modelo.
- El comando solo hace cuatro cosas:
  - renombra columnas con `contracts/mapping.py`;
  - refleja al lado del brazo con `models.scoring.to_arm_side`, la misma función que usan las
    compuertas;
  - mide la densidad (punto 3);
  - pregunta por `Scorer.draws`. El Stuff+ es la media de los draws y la banda su desviación, igual
    que en la API.

**3. La densidad se mide como en el entrenamiento.**

- Si el archivo trae trayectoria (`vx0` … `az0`) y `game_anon_id`, el índice de densidad es el
  arrastre medio del juego dividido entre el arrastre de referencia a nivel del mar del
  entrenamiento (`evidence.json` → `scoring_reference.reference_game_drag_k`). Así el número
  significa lo mismo que en los datos con que se entrenó: `density_source = trajectory`.
- **Un juego necesita al menos 50 lanzamientos.** Una lectura sola tiene desviación de 0.0765
  alrededor de la media de su juego (`scoring_reference.within_game_pitch_sd`). Con 50, el error de
  la media es 0.011, una cuarta parte de la variación entre juegos (`per_game_sd`, 0.04).
- Con menos de 50, o sin trayectoria, la fila toma la densidad medida de su `altitude_category`
  (`density_source = category`). Si tampoco hay categoría, conserva la lectura ruidosa y lo dice
  (`thin_game`), o se queda sin score (`missing`).

**4. Lo que el comando todavía no hace, dicho.**

- **Un modelo que usa el arsenal se rechaza con un error**, no se puntúa sin él: `Scorer.draws` no
  recibe arsenal todavía. Cuando A1 lo necesite, se extiende el contrato. Eso es un cambio de
  contrato y se acuerda entre los dos equipos.
- **No entrena nada.** Si no hay modelo en `artifacts/`, dice cómo entrenarlo y sale.

## Verificación

- Sobre los 619,648 lanzamientos con trayectoria del dataset, con el mismo filtro del entrenamiento,
  el comando reproduce **exactamente** el Stuff+ y la banda del puente (diferencia máxima 0.0).
- 108 lanzamientos de juegos con menos de 50 toman la densidad de su categoría, por la regla del
  punto 3.
- Al mover el reflejo al contrato, las compuertas dan el mismo veredicto, número por número; solo
  cambia el `model_id`.
- `packages/models/tests/test_batch.py` fija la mecánica sobre datos sintéticos.

## Consecuencias

- Diablos puede correr el modelo sobre su postemporada con un comando documentado en el README.
- **Datos no tiene que tocar el comando.** Su entrega es un `Scorer` en `artifacts/` que pase las
  compuertas. El `model_id` y el `.meta.json` dicen siempre cuál contestó.
- El contrato gana `pitch_types` y se vuelve verificable en tiempo de ejecución
  (`@runtime_checkable`). El puente lo trae por defecto, así que los modelos ya guardados siguen
  cargando.
- `evidence.json` gana `scoring_reference` (`reference_game_drag_k` y `within_game_pitch_sd`), dos mediciones del dataset
  con su procedencia, sin cifras nuevas para la pantalla.
