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

docker compose up -d               # api :8000, MLflow :5000, Postgres :5433
curl localhost:8000/health
```

## El repositorio

| Ruta | Qué es |
|---|---|
| `packages/core/` | Física y método. Funciones puras, sin datos del reto. **Es la frontera de IP** (`docs/04` §5.1) y una prueba la vigila |
| `packages/contracts/` | Los esquemas ejecutables entre datos y producto. **Empieza por aquí** |
| `packages/models/` | Entrenamiento. Toca el dataset |
| `packages/api/` | FastAPI: sirve scores y el simulador |
| `packages/web/` | Next.js |
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

> **Pendiente, para el día que entre el equipo.** `main` está protegida: CI verde
> obligatorio, sin force-push, sin borrar la rama, y los administradores incluidos.
> Pero el número de revisiones requeridas está en **0**, porque hoy hay una sola
> persona en el repositorio y una revisión que nadie puede dar es un candado sin
> llave. **Al invitar al equipo, súbelo a 1:**
>
> ```bash
> gh api -X PATCH repos/luisferdev11/superestela/branches/main/protection/required_pull_request_reviews \
>   -F required_approving_review_count=1
> ```
>
> Está escrito aquí y no en la cabeza de nadie porque una protección a medias que
> todos creen completa es peor que no tenerla. Sincronización lunes, miércoles y viernes. Los contratos con el equipo de
datos y su cadencia están en [`docs/07`](docs/07-INGENIERIA-Y-EQUIPO.md) §1.

El calendario hacia la entrega del **15 de octubre** está en
[`docs/08`](docs/08-PLAN-DE-ARRANQUE.md).
