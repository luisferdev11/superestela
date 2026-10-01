# SuperEstela

**Stuff+ para la Liga Mexicana de Beisbol, con la altitud dentro del modelo.**

Un lanzamiento que domina en Monterrey no es el mismo lanzamiento en la Ciudad de
México. El efecto Magnus, que es lo que mueve la pelota, cae a **0.754** de su valor
a nivel del mar, y con él el break: una recta pierde **3.77 pulgadas** de IVB, medido
dentro del mismo lanzador.
SuperEstela mide ese efecto por lanzador y lo convierte en decisiones de fichaje.

El contexto completo está en [`docs/00-PRODUCTO.md`](docs/00-PRODUCTO.md).

---

## Arrancar, una sola vez

```bash
git clone git@github.com:luisferdev11/superestela.git
cd superestela

# Python. uv trae su propio Python, no hace falta instalarlo aparte.
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync --all-extras            # --all-extras trae ruff, mypy y pytest; sin eso fallan los hooks

# Los hooks. Esto es toda la incorporación a las convenciones.
uv tool install pre-commit
pre-commit install --install-hooks

# La web: Node 22 y pnpm 10.
cd packages/web && pnpm install && cd ../..
```

El dataset **no está en el repositorio y nunca lo estará**. Colócalo en `data/`:

```
data/stuff_model_df.parquet
```

Con el dataset en su lugar, genera la evidencia y el modelo del Simulador. Solo hace falta una vez, y
de nuevo cuando cambie `analysis/`:

```bash
uv run python analysis/evidence.py          # ~1 min: reescribe analysis/outputs/, que ya está en git
uv run python analysis/simulator_gates.py   # ~1 min: entrena el modelo y corre sus compuertas
```

`simulator_gates.py` deja el modelo y su veredicto en `artifacts/`, que **no va a git** porque se
deriva de datos licenciados. No modifica ningún archivo versionado. Si cambias el modelo o las
compuertas y quieres publicar el resultado nuevo en `analysis/outputs/simulator_validation.json`,
corre `simulator_gates.py --publish`.

## Levantar la app

Dos terminales, desde la raíz del repo:

```bash
# 1 · la API (FastAPI): el Simulador le pide el Stuff+
uv run uvicorn api.main:app --port 8000

# 2 · la web (Next.js)
cd packages/web && pnpm dev
```

Abre **http://localhost:3000**. Te lleva al Radar, y el Simulador está en `/simulador`. La web busca
la API en `http://localhost:8000`; si la corres en otro puerto, arranca la web con
`SUPERESTELA_API_URL=http://localhost:<puerto> pnpm dev`.

**Con Docker, en lugar de la terminal 1:** `docker compose up -d` levanta la API en `:8000`, MLflow en
`:5000` y Postgres en `:5433`. Monta `analysis/outputs/` y `artifacts/`, así que antes hay que haber
corrido los dos comandos de arriba. `docker compose down` los apaga.

### Si algo no jala

| Síntoma | Causa | Qué hacer |
|---|---|---|
| El Simulador dice «la API del Simulador no respondió» | La API no está arriba, o está en otro puerto | Revisa la terminal 1, o usa `SUPERESTELA_API_URL` |
| «Modelo no disponible» en lugar del Stuff+ | No hay modelo en `artifacts/` | `uv run python analysis/simulator_gates.py` y reinicia la API |
| «Este modelo no pasó por las compuertas» | El modelo de `artifacts/` no es el que juzgaron las compuertas | Lo mismo: vuelve a correr las compuertas y reinicia la API |
| `Address already in use` | El puerto está ocupado, a veces por un `docker compose` viejo | `docker compose down`, o cambia el puerto |
| Un commit rechazado por `ruff` o `mypy` «not found» | Faltan las herramientas de desarrollo | `uv sync --all-extras` |
| Un commit rechazado por commitlint | El asunto debe ir en inglés y todo en minúsculas | `feat(web): add the translator screen` |
| `next dev` modifica `packages/web/AGENTS.md` | Next lo reescribe solo al arrancar | Ya está commiteado; no hay que hacer nada |

## Correr el modelo con sus datos

Para puntuar un archivo de lanzamientos que no está en el dataset, por ejemplo la postemporada:

```bash
uv run python -m models.score pitches.csv scores.csv
```

- **Entrada:** un CSV o parquet con las columnas del dataset y sus nombres de origen
  ([`docs/reference/stuff_plus_data_dictionary.csv`](docs/reference/stuff_plus_data_dictionary.csv)).
  - Obligatorias: `AutoPitchType`, `PitcherThrows`, `RelSpeed`, `SpinRate`, `SpinAxis`,
    `InducedVertBreak`, `HorzBreak`, `Extension`, `RelHeight`, `RelSide`.
  - Para medir la densidad del aire por juego, como en el entrenamiento: `vx0`, `vy0`, `vz0`, `ax0`,
    `ay0`, `az0` y `game_anon_id`, **con todos los lanzamientos de cada juego**. Sin ellas, o en un
    juego con menos de 50 lanzamientos, se usa la
    densidad medida de su `altitude_category`.
- **Salida:** una fila por cada fila de entrada, con `pitch_id`, `stuff_plus`, `stuff_plus_se`,
  `status`, `density_index`, `density_source` y `model_id`.
  - Una fila sin score lo deja vacío y dice por qué en `status`. Nunca sale un número sin su banda.
- **Procedencia:** junto a la salida queda `scores.csv.meta.json` con el modelo que contestó, si pasó
  las compuertas, los hashes del modelo y de la entrada, y el conteo por `status`.

**El comando y el modelo son piezas distintas** ([ADR 0009](docs/adr/0009-arnes-de-scoring.md)):

| | Qué es | De quién | Cuándo cambia |
|---|---|---|---|
| `python -m models.score` | El comando: lee, renombra, mide la densidad, pregunta y escribe | Producto | Casi nunca |
| `artifacts/*.joblib` | El modelo: cualquier objeto que cumpla `models.scoring.Scorer` | Datos | Con cada modelo |

Por defecto contesta el **puente v0** (`artifacts/stuff_plus_v0_bridge.joblib`, que entrena
`analysis/simulator_gates.py`). **No es el modelo final**: su modelo base, el v0, tiene R² 0.003 (`evidence.json → stuff_plus_v0`), y está ahí para que el
comando exista antes que el modelo (ADR 0007). El modelo final entra con `--model`, sin tocar el
comando, y el `model_id` de cada fila dice siempre cuál contestó.

## Comandos del día a día

```bash
uv run pytest                                  # pruebas de Python
uv run ruff check . && uv run mypy packages/   # lint y tipos
cd packages/web && pnpm lint && pnpm typecheck && pnpm test   # lo mismo para la web
uv run python scripts/check_pendientes.py      # qué falta para la entrega
```

## Ramas

**Todo sale de `main` y todo vuelve a `main`.** Una rama por cambio (`feat/…`, `fix/…`, `docs/…`,
`chore/…`), y un PR de menos de 400 líneas.

Si una pantalla necesita varios PRs encadenados, **no se fusiona ninguno de arriba hasta que el de
abajo haya entrado a `main`**, y cada uno se reapunta a `main` justo cuando le toca. Si se fusionan
uno sobre otro, GitHub los marca como fusionados pero `main` no recibe nada: ya nos pasó con la cadena
del Simulador (#22–#31), y hubo que abrir el #32 para llevarla a `main`. Para comprobar que algo llegó,
se mira el contenido de `main`, no el estado del PR.

## El prototipo

Las pantallas y el deck **no viven en este repositorio**. Viven en un Artifact de tipo Design:

**https://claude.ai/artifact/AysYSEs8pq1Aq4baGMjpAD**

Diez pantallas de aplicación y trece láminas de deck, con datos reales de `analysis/outputs/mockup_data.json`. Es la referencia para construir `packages/web/`: el HTML de cada pantalla ya tiene la estructura, los tokens de color y las cifras.

> **Regla que cuesta recordar y cuesta más olvidar:** cada cambio de métrica o de cifra se aplica en **tres** lugares — la evidencia (`analysis/evidence.py`), los documentos (`docs/`) y el prototipo. Si el prototipo se queda atrás, el deck enseña números que ninguna corrida respalda, y eso es justo lo que prohíbe `CONVENTIONS.md` §8.

---

## El repositorio

| Ruta | Qué es |
|---|---|
| `packages/core/` | Física y método. Funciones puras, sin datos del reto. **Es la frontera de IP** (`docs/04` §5.1) y una prueba la vigila |
| `packages/contracts/` | Los esquemas ejecutables entre datos y producto. **Empieza por aquí** |
| `packages/models/` | El contrato del Stuff+ (`scoring.py`), el puente v0 y el comando que puntúa un archivo (`score.py`, ADR 0009) |
| `packages/api/` | FastAPI: sirve scores y el simulador |
| `packages/web/` | Next.js. El Radar (P1) y el Simulador (P4) están completos — [su README](packages/web/README.md) tiene lo que cuesta redescubrir |
| `analysis/evidence.py` | El baseline v0. Reproduce cada cifra citada en los documentos |
| `analysis/simulator_gates.py` | Entrena el modelo del Simulador y corre sus compuertas ([`docs/09`](docs/09-SIMULADOR.md) §5) |
| `docs/` | Producto, evidencia, diseño, negocio, protocolo científico, ingeniería. [`docs/08`](docs/08-PLAN-DE-ARRANQUE.md) es la lista viva de pendientes y [`docs/10`](docs/10-PANTALLAS-RESTANTES.md) el plan de las pantallas que faltan |

## Las reglas que no se negocian

1. **Ningún dato entra a git.** Un hook rechaza `.parquet`, `.csv` y `.xlsx` en
   cualquier ruta. Redistribuir el dataset viola el reglamento del reto.
2. **Ningún número sin su corrida.** Toda cifra en la UI, el deck o el reporte
   se remonta a una corrida de MLflow o a `analysis/evidence.py`.
3. **Ningún score sin su banda.** `stuff_plus_se` es obligatorio, y el esquema
   —no la disciplina— es quien lo exige.
4. **Debajo de 100 lanzamientos se dice "muestra insuficiente"**, nunca un
   número con una banda enorme.

Todo lo demás está en [`CONVENTIONS.md`](CONVENTIONS.md), que gana sobre los
defaults de cualquier herramienta o agente.

## Cómo trabajamos

Una rama por tarea, PR obligatorio, CI verde para fusionar, y una revisión por PR
—no por control, sino porque es como cuatro personas se quedan en el mismo
código.

`main` está protegida y la protección está **completa**: CI verde obligatorio,
sin force-push, sin borrar la rama, los administradores incluidos, y **una
revisión aprobatoria requerida**. El último candado se cerró el 21 de septiembre,
el día que el equipo entró al repositorio; hasta entonces estuvo en 0, porque una
revisión que nadie puede dar es un candado sin llave. El motivo está en
[`docs/adr/0006`](docs/adr/0006-gobierno-con-el-equipo-dentro.md).

`enforce_admins` está activo, así que esto **aplica a todos, sin excepción**. Si
tu PR se queda esperando, es porque le falta una aprobación, no porque algo esté
roto.

Quién revisa qué lo dice [`.github/CODEOWNERS`](.github/CODEOWNERS): `models/` y
`contracts/` los revisa datos, el resto producto.

Sincronización lunes, miércoles y viernes. Los contratos con el equipo de
datos y su cadencia están en [`docs/07`](docs/07-INGENIERIA-Y-EQUIPO.md) §1.

El calendario hacia la entrega del **22 de octubre**, y la lista viva de
pendientes con su criterio de hecho, están en
[`docs/08`](docs/08-PLAN-DE-ARRANQUE.md). Lo que una máquina puede verificar lo
verifica `scripts/check_pendientes.py`.
