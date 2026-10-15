# SuperEstela — Decision Log

> **Borrador del 1 de octubre de 2026.** El reto pide un «Decision Log auditable» dentro del 25% de
> Aplicabilidad real (`docs/00` §9). Este documento tiene dos partes:
>
> 1. **El registro que lleva el producto**: cada recomendación que el sistema emite y lo que el club
>    hizo con ella. Aquí está su especificación. Que la app lo escriba es trabajo de después del
>    congelamiento del 12 de octubre, decidido así el 1 de octubre.
> 2. **El registro de las decisiones del proyecto**: lo que decidimos al construirlo, con la evidencia
>    que lo sostiene, la alternativa que se descartó y quién decidió.
>
> Ninguna cifra de este documento se escribe a mano: cada una cita su artefacto.

---

## 1. El registro de recomendaciones

### 1.1 Para qué

`docs/03` §7 lo fija con tres razones, y se mantienen:

- **Auditabilidad:** el club puede preguntar después «¿el modelo ayudó?» y tener respuesta.
- **Cierre del ciclo:** cada fichaje se compara contra lo que se predijo.
- **Responsabilidad:** el sistema **recomienda** y el cuerpo técnico **decide**. El rail de la app lo
  dice en cada pantalla.

### 1.2 Cuándo se escribe un registro

Solo donde la app emite una recomendación, no donde muestra un dato:

| Módulo | Recomendación que emite | De dónde sale |
|---|---|---|
| Ficha · «Lectura del sistema» | `Fichar` / `Fichar con reservas` / `No fichar al precio de nivel del mar` | `domain/reading.ts`, `verdictOf` |
| Plan de Desarrollo | Mover N puntos de uso de un pitch a otro, si ayuda | `domain/plan.ts`, `shiftUsage` y `shiftHelps` |
| Tablero de Despliegue | El orden por rol para el entorno de la serie | `domain/roster.ts` |
| Traductor | Stuff+ proyectado de un arsenal de fuera | `POST /api/v1/simulate` |

### 1.3 Los campos

El esquema de `docs/03` §7, con la fuente concreta de cada campo en lo que ya existe:

| Campo | Qué guarda | Fuente hoy |
|---|---|---|
| `decision_id` | UUID | se genera al registrar |
| `decided_at` | UTC (`CONVENTIONS.md` §5.1: `_at`) | reloj del servidor |
| `model_id` | Versión del modelo que contestó | `Scorer.model_id`; el v0 es `0.1.0+<sha7>` |
| `scale` | Cómo se define el 100 | `mockup_data.json → scale` |
| `module` | `ficha` · `plan` · `deployment` · `translator` | la pantalla |
| `pitcher_id`, `season` | A quién se refiere | la URL |
| `inputs_hash` | Hash de lo que entró al modelo | `models.score` ya calcula el de un archivo (ADR 0009) |
| `prediction` | Stuff+ con su banda, en los dos entornos | la tarjeta, o la respuesta de la API |
| `recommendation` | Lo que dijo el sistema, con la regla que lo produjo | `verdictOf` y la regla declarada en pantalla |
| `human_decision` | Lo que hizo el club: `aceptada` · `rechazada` · `modificada` | **lo captura una persona** |
| `decided_by`, `rationale` | Quién y por qué, en texto libre | **lo captura una persona** |
| `realized_outcome` | Lo que pasó después: K−BB%, whiff y Stuff+ medidos en la temporada siguiente | se llena con el tiempo, desde la evidencia nueva |
| `tenant_id` | El club | `CONVENTIONS.md` §5.1 |

**Por qué `realized_outcome` usa K−BB% y whiff, y no carreras:** el puente de Stuff+ a carreras no
existe todavía (A3), y Diablos dijo en el Q&A que eso es lo que mira primero. La habilidad se repite
de un año a otro mucho más que el resultado (`report/claims.toml` → `skill-persists`).

### 1.4 Cómo se ve un registro

**Ejemplo de formato, no una decisión real.** Los valores del modelo salen de la tarjeta de
`pitcher_00069` en 2025; los campos humanos quedan vacíos, porque nadie los ha capturado.

```json
{
  "decision_id": "(se genera)",
  "decided_at": "(al registrar)",
  "model_id": "0.1.0+<sha7>",
  "scale": "league",
  "module": "ficha",
  "pitcher_id": "pitcher_00069",
  "season": 2025,
  "prediction": { "stuff_plus_hh": "tarjeta → stuff_plus_hh ± stuff_plus_hh_ci95",
                  "stuff_plus_sea": "tarjeta → stuff_plus_sea ± stuff_plus_sea_ci95" },
  "recommendation": "no fichar al precio de nivel del mar · regla: Trampa de Altitud",
  "human_decision": null,
  "decided_by": null,
  "rationale": null,
  "realized_outcome": null
}
```

### 1.5 Qué falta para que la app lo escriba

- `POST /api/v1/decisions` y `GET /api/v1/decisions?pitcherId=…` en la API, con Pydantic y sus tres
  tests por endpoint (`CONVENTIONS.md` §7.4).
- Persistencia: SQLite en local y Postgres en `docker-compose.yml`, que ya levanta uno en `:5433`.
- En la Ficha, un botón «registrar decisión» debajo de la lectura del sistema, con los tres campos
  humanos.
- Una vista de solo lectura del registro, filtrable por lanzador y módulo.

Si no alcanza antes de la entrega, va en «qué haríamos con más tiempo» del documento técnico
(`docs/13` §10), y este documento queda como su especificación.

---

## 2. El registro de las decisiones del proyecto

Cada decisión vive en su ADR, con el razonamiento completo y quién la tomó. Esto es el índice
auditable: qué se decidió, contra qué y con qué evidencia.

| # | Fecha | Decisión | Alternativa descartada | Evidencia |
|---|---|---|---|---|
| [0001](adr/0001-toolchain-pinning.md) | 18 sep | Fijar el toolchain (`uv.lock`), aunque las cifras del v0 se movieron al hacerlo | Volver al entorno viejo para conservar las cifras | La reproducibilidad gana: las cifras se regeneran, no se copian |
| [0002](adr/0002-generated-fixtures.md) | 18 sep | Los fixtures se generan desde una semilla | Versionar un parquet de prueba | El reglamento prohíbe redistribuir datos; un fixture generado no los contiene |
| [0003](adr/0003-metricas-de-producto.md) | 18 sep | El Impuesto de Altitud en carreras por 9 entradas, y «no concluyente» si no es significativo; sin Sello | Carreras por 100 lanzamientos; mostrar el Sello | Nueve entradas es la unidad que el béisbol ya lee |
| [0004](adr/0004-rol-de-dos-categorias.md) | 20 sep | El rol tiene dos categorías | Tres, con «relevista tardío» | Abrir el juego es bimodal (469 abren menos del 10% de sus juegos, 119 más del 90%); la entrada de los relevistas no separa un tercer grupo |
| [0005](adr/0005-eje-de-temporada.md) | 20 sep | La llave es lanzador y temporada | Un promedio de carrera | Quien se ausentó un año y volvió son dos mediciones |
| [0006](adr/0006-gobierno-con-el-equipo-dentro.md) | 21 sep | Una revisión obligatoria por PR, con CODEOWNERS | Sin revisión obligatoria | Hasta que entró el equipo no había quién revisara |
| [0007](adr/0007-contrato-del-scorer-y-escala.md) | 23 sep | El Stuff+ se pide por un contrato y se muestra solo si pasa compuertas | Esperar al modelo final; una fórmula a mano | Las compuertas S1–S4 (`report/tables/compuertas.md`) |
| [0008](adr/0008-plantel-aproximado.md) | 28 sep | El plantel se aproxima por proporción de lanzamientos en altitud extrema | Inventar la lista; dejar P6 y P8 como mockup | Tres reglas probadas sobre 2026, en el ADR |
| [0009](adr/0009-arnes-de-scoring.md) | 1 oct | El comando que puntúa un archivo es de producto; el modelo es de datos | Que cada modelo traiga su script | Reproduce el puente exactamente sobre el dataset |
| [0010](adr/0010-una-sola-entrada-para-el-modelo.md) | 1 oct | El modelo de datos entra por un archivo y un comando, y llega a las ocho pantallas, la API, las compuertas y el holdout | Que cada consumidor cargue su modelo (había tres caminos) | Sin `--model` la salida no cambia un byte; con el puente por `--model`, la cadena completa corrió y S4 dio r = 0.981 |

### 2.1 Reglas de producto que no tienen ADR propio

| Regla | Valor | Por qué | Dónde vive |
|---|---|---|---|
| Mínimo para tener Stuff+ | 100 lanzamientos en cada entorno | Debajo, la banda no distingue a nadie | `contracts/schemas.py → MIN_PITCHES_FOR_SCORE` |
| Mínimo para K%, BB% y K−BB% | 50 turnos | Con 50, un K% de 20 todavía carga ±11 puntos | `MIN_PLATE_APPEARANCES_FOR_RATE` (#72) |
| Mínimo para el whiff | 50 swings | La misma lógica que los turnos | `MIN_SWINGS_FOR_RATE` (#72) |
| Lectura de la Ficha | Trampa: no al precio de nivel del mar · banda entera arriba de 100: fichar · lo demás: con reservas | Es provisional y se declara en pantalla | `domain/reading.ts` |
| Delta grande | −10 puntos o menos se marca | Viene del prototipo | `domain/emphasis.ts → LARGE_DELTA` |
| Para quién es el Traductor | Para el lanzador que no está en nuestros datos; entra por su export de TrackMan, y un solo lanzador real queda como validación | Con tres ejemplos del dataset repetía la Proyección de la Ficha; su caso es el entregable 3c. Decidido el 1 de octubre | `docs/10` T2, #83 |
| Dónde se lee un export de TrackMan | En la API de Python, no en el navegador | Las columnas del proveedor solo se renombran en `contracts/mapping.py` (`CONVENTIONS.md` §2.1); leerlo en TypeScript duplicaría el mapeo | `packages/api/arsenal_file.py` |
| Nombre de la «Trampa de Altitud» | «Sufre en la altura» en pantalla; los identificadores (`altitude_trap`) no cambian | El equipo no entendía «Trampa». La regla es la misma: p70 del Stuff+ a nivel del mar y p30 del Δ. Decidido el 14 de octubre | `i18n/es.ts`, `CONVENTIONS.md` §2.2 |
| Cómo se ordena y se filtra el Radar | Clic en el encabezado (otro clic invierte; los `null` siempre al final); un menú por filtro con un solo valor; el tipo de pitch abarca todo el arsenal (≥25 en altitud extrema) y la tabla muestra el Stuff+ de ese pitch | Los chips de varios valores confundían, y el filtro por pitch principal dejaba fuera a quien tira un buen slider de segundo pitch. El impuesto ordena solo los concluyentes (ADR 0003). Decidido el 14 de octubre | `domain/{tableSort,ranking,filters}.ts` |
| El «±» en pantalla | Siempre la banda al 95%, nunca el error estándar; cada pantalla lo dice | Hasta el 1 de octubre el Radar, la Ficha y el Despliegue mostraban la banda y el Simulador, el Traductor y la Proyección el error estándar: el mismo signo valía la mitad en unas pantallas que en otras. Decidido el 1 de octubre | La guía del Radar; cada pantalla que muestre un «±» |
| Densidad por juego | 50 lanzamientos o más | Con 50 el error de la media es una cuarta parte de la variación entre juegos | `models/batch.py`, ADR 0009 |

### 2.2 Lo que decidió el Q&A con Diablos (30 de septiembre)

El detalle está en `docs/10` §5. Lo que cambió decisiones:

| Respuesta | Decisión que tomamos |
|---|---|
| «Extreme» son cinco parques | Nombre híbrido: «altitud extrema» en cifras y tablas, «Harp Helú» solo en narrativa (#60) |
| 100 por entorno | Los textos del Δ quedan listos para las dos escalas (#75); datos decide antes del 12 |
| Su holdout es la postemporada 2026 | Un comando reproducible que puntúa un archivo (ADR 0009) |
| Miran whiff, K y K−BB | Las tasas, en el Radar y la Ficha (#72, #73) |
| La física es complemento | La P3 bajó de prioridad, y aun así se construyó (#67–#71) |
| No habrá lista del plantel | P6 y P8 quedan demostrativas, y lo dicen (#60) |
