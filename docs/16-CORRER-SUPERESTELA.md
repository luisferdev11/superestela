# 16 · Correr SuperEstela en cualquier computadora

**Fecha:** 20 de octubre de 2026 · **Para quién:** el equipo y cualquiera que quiera ver la app completa.

> **En una línea:** clonar, instalar los modelos con un comando verificado y arrancar con otro. Igual
> en Windows, macOS y Linux. No hace falta el dataset.

## Los tres comandos

```bash
uv sync --all-extras                              # una vez: Python y sus paquetes
uv run python scripts/fetch_models.py             # una vez por versión del modelo
uv run python scripts/start.py                    # cada vez: API (:8000) y web (:3000)
```

- **`start.py`** revisa lo que falta y dice cómo conseguirlo, instala los paquetes de la web la primera
  vez, levanta la API y la web, y abre el navegador. Se detiene con Ctrl+C.
- **`start.py --prod`** levanta la versión de la demo: más rápida y sin el botón de desarrollo de Next.
- Requisitos: [uv](https://docs.astral.sh/uv/), Node 22 con pnpm 10, y la CLI de GitHub (`gh`) con
  sesión iniciada en una cuenta del equipo (`gh auth login`).

## Por qué así

Un compañero en Windows no podía usar los modelos que le llegaron por WhatsApp
(`XGBoostError: input stream corrupted`) y la app le decía «Modelo no disponible». Las causas y lo que
las resuelve:

| Problema | Causa | Lo que lo resuelve |
|---|---|---|
| `input stream corrupted` | Los `.joblib` son pickles de Python con buffers binarios de XGBoost: dependen de la máquina y se rompen si un byte cambia en el camino | **Formato portátil** (`models/portable.py`): una carpeta con los boosters en el JSON de XGBoost y un `manifest.json`. Al convertir se comprueba que puntúa exactamente igual que el pickle (`scripts/export_portable.py`) |
| Archivos dañados en un chat | WhatsApp no es un canal para binarios | **Un solo zip en un Release del repo privado** y su SHA-256 en `models.lock.json`, que está en git. `fetch_models.py` rechaza un zip que no coincide, antes de instalar nada |
| «Modelo no disponible» | La API no encontraba el archivo en la ruta que esperaba | `fetch_models.py` instala siempre en `artifacts/models/`, donde la API busca. Si falta, el log y `start.py` dicen qué correr |
| El Simulador no mostraba Stuff+ aunque hubiera modelo | La API pedía el veredicto de compuertas junto al modelo, y ese archivo no viajaba | La API usa el veredicto publicado (`analysis/outputs/simulator_validation.json`, en git) **solo si nombra a ese mismo modelo** |

## Para quien publica un modelo nuevo

```bash
uv run python scripts/export_portable.py      # pickles → carpetas portátiles, verificadas
uv run python scripts/package_models.py       # zip + models.lock.json
gh release create models-<versión> artifacts/superestela-models-<versión>.zip \
  --title "Modelos <versión>" --notes "…"
git add models.lock.json && git commit …      # el lock viaja en el PR del modelo
```

## Límites

- **Los modelos se ajustaron sobre datos con licencia.** Viven en un Release del repositorio
  **privado**, igual que el código. Darle la app al jurado sin que clone el repo (un enlace público)
  es otra decisión: hay que confirmar con el reglamento que mostrar resultados de un modelo desplegado
  no cuenta como redistribuir los datos (`docs/12` §2.1, «se presentan resultados, no los datos»).
- El dataset no hace falta para usar la app: todas las pantallas leen `analysis/outputs/`, que está en
  git. Sí hace falta para regenerar cifras o re-entrenar.
