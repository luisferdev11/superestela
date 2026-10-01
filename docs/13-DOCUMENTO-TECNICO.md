# SuperEstela — Documento técnico (esqueleto)

> **Borrador del 1 de octubre de 2026.** El documento final tiene de 6 a 10 páginas y se escribe
> **contra cifras congeladas a partir del 12 de octubre** (`docs/08`). Esto es su estructura:
>
> - qué va en cada sección y cuántas páginas le tocan;
> - qué tabla de `report/tables/` la sostiene;
> - qué afirmaciones de `report/claims.toml` puede hacer, y cuáles todavía no.
>
> **Regla de redacción:** ninguna cifra se escribe a mano. Cada número del texto es una afirmación de
> `report/claims.toml`, y `python -m report.build` falla si deja de coincidir con su artefacto
> (`docs/05` §4.3). Una afirmación marcada 🔴 en `report/tables/trazabilidad.md` **no entra** hasta
> que tenga su corrida.

El orden y el presupuesto siguen `docs/05` §5. Las secciones en negrita son las que nos separan de
los demás equipos; si hay que recortar, se recorta de las otras.

| § | Sección | pp | Tablas | Afirmaciones (`claims.toml`) | Estado |
|---|---|---|---|---|---|
| 1 | Marco: sabermetría, física y el entorno de la LMB | 1 | `entorno-de-carreras.md` | `ra9-sea`, `ra9-extreme`, `ra9-effect` | ✅ redactable |
| 2 | Datos, auditoría y el diseño within-pitcher | 1 | `datos.md` | `n-pitches`, `within-pitcher-*`, `spin-unchanged`, `best-lose-more` | ✅ redactable |
| **3** | **El Índice de Densidad: derivación y validación** | 1 | `densidad.md` | `density-*`, `magnus-extreme` · 🔴 `density-validated` (D4) | 🟡 falta D4 |
| 4 | Modelado: target, arquitectura, ablaciones | 2 | `baseline.md` + las de A1–A3 | `v0-r2`, `whiff-learnable`, `skill-persists` · 🔴 `components-beat-direct` | 🔴 espera a datos |
| **5** | **La escala Stuff+: definición formal y calibración** | 1 | (de datos) | 🔴 `scale-meaning` | 🔴 espera la escala |
| **6** | **Veredicto de hipótesis, con H2 refutada** | 1 | `hipotesis.md` | `h1`–`h4` · 🔴 `low-ride-survives` | ✅ salvo el +0.531 |
| 7 | Validación: lanzador, temporada y parque | 1.5 | `compuertas.md` | `gates-display`, `gate-s7` · 🔴 `stuff-to-runs`, `generalizes` | 🟡 |
| **8** | **El Traductor de Altitud** | 1 | `traductor.md` | `translator-*` | ✅ redactable |
| 9 | Fronteras declaradas | 0.5 | — | las 🔴 de la matriz | ✅ |
| 10 | Qué haríamos con más tiempo | 0.5 | — | — | ✅ (abajo) |

Las dos secciones que no están en `docs/05` §5 salen del Q&A:

- **El Perfil Físico Ideal** es el entregable 2 del reto. Va como subsección de §6 (abajo) y como
  lámina del deck.
- **La política de datos faltantes** va en §2, porque Diablos dijo que también se evalúa.

---

## §2 · Política de datos faltantes

Diablos explicó tres cosas: los faltantes son normales en las métricas de batazo, ya quitaron los
parques con radar mal calibrado y hay temporadas incompletas. Lo que hacemos, con dónde vive cada
regla:

| Caso | Qué hacemos | Por qué | Dónde |
|---|---|---|---|
| `altitude_category` vacía | Se excluye del análisis por entorno | Sin entorno no hay comparación | `analysis/evidence.py`, filtro en `main` |
| Trayectoria incompleta (`vx0` … `az0`) | Se excluye de todo el análisis | El índice se mide desde la trayectoria; no se imputa | `evidence.py`, `main` |
| Rasgos físicos faltantes en un pitch | Ese pitch no recibe Stuff+, y la salida dice por qué | Un score imputado sería inventado | `models/batch.py`, `status = missing_features` |
| Tipo de pitch fuera de los seis | Sin Stuff+ (`unsupported_pitch_type`), pero cuenta para K y BB | El modelo no lo vio; el ponche sí ocurrió | `models/batch.py`, `evidence.py` |
| Métricas de batazo faltantes | No entran a ningún target del v0 | El v0 usa linear weights por evento, no la velocidad de salida | `evidence.py`, `RUN_VALUE` |
| Muestra chica | No se muestra el número: «muestra insuficiente» | Una banda enorme no informa | `contracts/schemas.py`, mínimos |
| Defectos detectados (HBP en cero, `EffectiveVelo` como texto, `Outs = 3`) | Documentados, con su acción | Auditoría reproducible | `report/tables/datos.md` |

---

## §6.x · El Perfil Físico Ideal (entregable 2)

**La pregunta del reto:** ¿qué perfil físico de pitcher conviene en la altura?

**Lo que ya sostiene la evidencia:**

- **El aire delgado se lleva el break, no la velocidad ni el spin.** Dentro del mismo lanzador, la
  recta pierde ride (`within-pitcher-ivb`), le pasa a todos los medidos (`within-pitcher-all-lose`) y
  el spin no cambia (`spin-unchanged`). Esto es H1 y H4.
- **Pierde más quien más ride tiene** (`best-lose-more`, correlación sobre los lanzadores medidos).
  La tabla por cuartiles de IVB está en `evidence.json → within_pitcher → Four-Seam → heterogeneity`.
- **El pitch de diferencial de velocidad no gana** (H2, refutada). El que mejor aguanta es la curva
  (`hypotheses → H2`).
- **La rola sube en la altura para todos los tipos, pero las carreras también suben** (H3, con matiz).
- **Hipótesis, por validar: en la altura lo que más pesa es abanicar.** La K−BB% de la liga cae de nivel del mar a altitud
  extrema (`evidence.json → league_outcomes`; falta su afirmación en `claims.toml`). Es lo que
  Diablos dijo que mira primero.

**El perfil, en una frase para la lámina:** poco ride que perder, break que no depende del aire y
capacidad de abanicar. Por eso la tesis comercial de `docs/00` §8: comprar curvas, cutters y perfiles
de ride bajo, y no sobrepagar el ride alto.

**Lo que falta antes de escribirlo como afirmación:**

- 🔴 El **+0.531** de `docs/01` §8.5, que dice que lo que sobrevive es el poco ride y no el tipo de
  pitch, no lo calcula ningún artefacto. Hay que agregarlo a `analysis/evidence.py`, o quitarlo.
- 🔴 La prueba que lo cerraría: el baseline sin variables de tipo de pitch (`docs/01` §8.5).
- 🟡 Con la escala por entorno el perfil se lee igual, pero el número que lo ilustra cambia. Se
  redacta después del 12.

---

## §10 · Qué haríamos con más tiempo

Emilio, de Diablos, dijo en el Q&A que esta sección cuenta. En orden de valor:

1. **Location+ y Pitching+.** El reto los evalúa como un plus que «sale de Stuff+». La pestaña
   Arsenal de la Ficha ya tiene su contrato (`locations.json`) y espera el modelo.
2. **El puente de Stuff+ a carreras (A3).** Sin él, el Impuesto de Altitud se mide, pero un cambio
   de Stuff+ no se puede traducir a carreras ni a dinero.
3. **Densidad por parque.** El dataset agrupa cinco parques en «altitud extrema». Con el ID del
   estadio, el índice de densidad, que ya se mide por juego, separaría el Harp Helú de los otros
   cuatro.
4. **El Decision Log en la app** (`docs/12` §1.5), para cerrar el ciclo recomendación → decisión →
   resultado.
5. **El plantel real de Diablos** en lugar del aproximado (ADR 0008).
6. **Validación del índice de densidad contra el clima de cada juego** (D4), con fuentes públicas,
   que el Q&A permitió si se documentan.
7. **Calibración por entorno de las bandas** (F2 falló por 0.002 del lado conservador).
