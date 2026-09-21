# ADR 0005 · La temporada entra en la llave

**Fecha:** 20 de septiembre de 2026 · **Estado:** aceptada

## Contexto

Hasta ahora el producto trataba a cada lanzador como una sola cosa: un Stuff+, un impuesto, un rol, promediando sus tres temporadas posibles. El equipo lo cuestionó con un caso concreto: *un lanzador pudo lanzar en 2024, irse en 2025 —fichaje a otra liga, lesión, lo que sea— y volver en 2026.*

El caso existe y se puede contar. Sobre los **1,050 lanzadores** con trayectoria utilizable:

| Temporadas | Lanzadores |
|---|---|
| Solo una | **619** (59%) |
| Dos consecutivas | 251 |
| Las tres | 152 |
| **2024 y 2026, sin 2025** | **28** |

Y no es solo cuestión de contar bien. **La forma se degrada como predictor cuando hay hueco.** La correlación del IVB de la recta entre temporadas consecutivas es 0.78–0.83; entre 2024 y 2026 cae a **0.674**. Además el 11% de los lanzadores mueve más de 2″ de IVB entre temporadas, que es más de la mitad de lo que cuesta la altitud (3.77″). Promediar 2024 con 2026 no describe a nadie.

## Decisión

**La llave del Contrato B es `(pitcher_id, season)`.** Cada fila es un lanzador en una temporada.

**`environment` sale de la llave y de la fila.** Era incoherente: la fila ya trae `stuff_plus_hh` **y** `stuff_plus_sea`, o sea que es una fila de *comparación entre entornos*, no la observación de uno. Con `environment` en la llave, cada fila habría duplicado la comparación.

**`n_pitches` se parte en `n_pitches_hh` y `n_pitches_sea`.** El umbral aplica a cada entorno por separado, y con un solo conteo no había manera de verificarlo desde la entrega: una entrega con 900 lanzamientos a nivel del mar y 40 en altitud no contiene ninguna comparación, y un `n_pitches` de 940 lo escondía.

**El umbral baja de 150 a 100 lanzamientos en cada entorno.** No es una concesión: 100 es `MIN_PITCHES_FOR_SCORE`, la regla de producto que el contrato declaraba desde el primer día y que `analysis/evidence.py` estaba ignorando al usar 150. Alinear las dos cosas al separar por temporada deja **370 pares lanzador-temporada de 296 lanzadores distintos**, que son *más* lanzadores que los 286 de la cohorte anterior.

> **Dos denominadores, y hay que nombrarlos.** 379 pares pasan el umbral contando todo lo que trae trayectoria; 370 lo pasan contando solo los seis tipos principales con forma completa, que es lo que el modelo puntúa. Las tarjetas siguen el segundo, y `evidence.json` publica los dos con nombre distinto para que nadie los mezcle.

**El Radar muestra la última temporada jugada de cada candidato; la Ficha muestra todas.** La temporada es una columna visible, no un pie de página: de los 296 lanzadores con score, **95** tienen 2024 como su última temporada, **134** el 2025 y solo **67** el 2026.

## Consecuencias

- El rol se calcula por lanzador-temporada ([ADR 0004](0004-rol-de-dos-categorias.md)).
- `pitcher_00069`, el ejemplo canónico de las pantallas, califica **solo en 2025**; las vistas pasan a decir `pitcher_00069 · 2025`. Y con la muestra de una sola temporada **su Impuesto deja de ser significativo**: pasa a mostrarse como *no concluyente*, que es la regla funcionando, no un defecto.
- La cohorte cambia, así que las cifras derivadas de sus percentiles cambian con ella: las Trampas de Altitud pasan de 44 a **58** sobre 370 tarjetas.
- `pitcher_00986`, la mitad del par de la lámina 3 del deck, **deja de calificar**: tenía 824 lanzamientos a nivel del mar y 76 en altitud en 2025, y 41/197 en 2026. Ninguna de las dos temporadas llega a 100 en ambos entornos. El par se eligió de nuevo dentro de una misma temporada, que además cierra la objeción obvia a la lámina.
