# ADR 0008 · El plantel de Diablos se aproxima, y se dice

**Fecha:** 28 de septiembre de 2026 · **Estado:** aceptada. Tras el Q&A del 30 de septiembre, **P6 y P8 quedan como pantallas demostrativas** (§ «Resultado del Q&A»)

## Contexto

P6 (Despliegue) y P8 (Plantel) hablan de «nuestro plantel». El dataset viene anonimizado y **sin
equipo**: no hay forma de saber qué lanzadores son de Diablos. La pregunta está en el Q&A con el club
(prioritaria 4), pero las pantallas se construyen antes.

`docs/10` T5 ofrecía tres salidas: mostrar a los 296 con un filtro pendiente, aproximar el plantel, o
dejar las pantallas como mockup. **No inventar la lista** era la condición.

## Decisión

**Se aproxima el plantel con los lanzadores que lanzan en casa**, decidido con el usuario el 28 de
septiembre («aproximar por apariciones en Harp Helú»).

- **Regla:** los 14 lanzadores con mayor **proporción** de sus lanzamientos en altitud extrema en la
  temporada más reciente (2026), entre los que tienen al menos 150 lanzamientos ahí. La proporción se
  cuenta sobre altitud extrema más nivel del mar. Vive en `packages/web/src/domain/roster.ts`
  (`approximateRoster`, `ROSTER_SIZE`, `MIN_HOME_PITCHES`).
- **Por qué la proporción y no el conteo.** Se probaron tres reglas sobre 2026:

  | Regla | Abridores | Relevistas | Proporción en altitud extrema |
  |---|---|---|---|
  | Más lanzamientos en altitud extrema | 11 | 3 | 52% a 89% |
  | Mayor proporción, mínimo 100 | 4 | 10 | 78% a 100% |
  | **Mayor proporción, mínimo 150** | **6** | **8** | **75% a 92%** |

  Contar lanzamientos favorece al abridor, que lanza más. La proporción no depende del rol: quien
  juega la mitad de sus juegos en casa lanza ahí la mayoría. Con mínimo 100 entra quien tiene 100%
  porque no se le vio de gira, que no es lo mismo que ser de casa.
- **Cada pantalla lo declara**, arriba y con la regla, no en un pie de página.
- **Cada lanzador entra con su última temporada con score.** Uno sin ninguna temporada con score
  está en el plantel pero no en el tablero, y el Plantel lo muestra con su «muestra insuficiente».

## Límites que se aceptan

- **«Altitud extrema» agrupa cinco parques**, así que la lista mezcla equipos. Era la pregunta 1 del
  Q&A, y la respuesta lo confirmó (abajo).
- **Un visitante frecuente puede colarse**, y un lesionado de Diablos puede quedar fuera.
- **14 y 150 son decisiones de producto**, no reglas de la liga. Se cambian en una línea.

## Consecuencias

- P6 y P8 existen y se pueden ensayar.
- **Cuando el club entregue su lista de IDs**, `approximateRoster` se reemplaza por esa lista, se
  quita el aviso y este ADR pasa a «sustituida». Las pantallas no cambian.
- Lo que justifica el tablero —cuánto cambia el orden entre casa y gira— se calcula sobre la
  cohorte completa del Radar, no sobre el plantel aproximado, para que no dependa de esta decisión.

## Resultado del Q&A (30 de septiembre)

- **«Extreme Altitude» son cinco parques:** Puebla, Ciudad de México, Aguascalientes, Querétaro y León
  ([`reference/categorias-altitud.md`](../reference/categorias-altitud.md)). La regla de proporción
  encuentra a quien lanza la mayor parte en altitud extrema, pero eso incluye a los lanzadores de casa
  de los cinco equipos, no solo de Diablos.
- **No habrá lista del club.** Diablos sabe quién es cada ID anonimizado, pero evalúa a todos y no va a
  compartir su plantel.
- **Por eso P6 y P8 quedan como pantallas demostrativas:** muestran cómo se usaría el tablero con un
  plantel real, y el aviso de las dos pantallas lo dice (#60). La regla y este ADR se quedan.
  `approximateRoster` se reemplaza por una lista solo si un club la entrega.
