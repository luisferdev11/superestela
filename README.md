# SuperEstela

**Stuff+ para la Liga Mexicana de Beisbol, con la altitud dentro del modelo.**

Un lanzamiento que domina en Monterrey no es el mismo lanzamiento en la Ciudad de
México. La densidad del aire cae a **0.858** de su valor a nivel del mar, y con ella
el break: una recta pierde **3.77 pulgadas** de IVB, medido dentro del mismo lanzador.
SuperEstela mide ese efecto por lanzador y lo convierte en decisiones de fichaje.

El contexto completo está en [`docs/00-PRODUCTO.md`](docs/00-PRODUCTO.md).

---

## Arrancar

```bash
git clone git@github.com:luisferdev11/superestela.git
cd superestela

# Toolchain. uv trae su propio Python, no hace falta instalarlo aparte.
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync --all-extras

# Los hooks. Esto es toda la incorporación a las convenciones.
uv tool install pre-commit
pre-commit install --install-hooks
```

El dataset **no está en el repositorio y nunca lo estará**. Colócalo en `data/`:

```
data/stuff_model_df.parquet
```

## Correr

```bash
uv run pytest                      # pruebas
uv run ruff check . && uv run mypy packages/
uv run python analysis/evidence.py # regenera toda la evidencia, ~3 min

uv run python scripts/check_pendientes.py   # qué falta para la entrega

cd packages/web && pnpm install && pnpm dev # la app, en :3000/radar

docker compose up -d               # api :8000, MLflow :5000, Postgres :5433
curl localhost:8000/health
```

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
| `packages/models/` | Entrenamiento. Toca el dataset |
| `packages/api/` | FastAPI: sirve scores y el simulador |
| `packages/web/` | Next.js. La P1 está completa — [su README](packages/web/README.md) tiene lo que cuesta redescubrir |
| `analysis/evidence.py` | El baseline v0. Reproduce cada cifra citada en los documentos |
| `docs/` | Producto, evidencia, diseño, negocio, protocolo científico, ingeniería |

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

El calendario hacia la entrega del **15 de octubre**, y la lista viva de
pendientes con su criterio de hecho, están en
[`docs/08`](docs/08-PLAN-DE-ARRANQUE.md). Lo que una máquina puede verificar lo
verifica `scripts/check_pendientes.py`.
