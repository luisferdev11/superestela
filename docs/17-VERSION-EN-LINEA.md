# 17 · La versión en línea (GitHub Pages)

**Fecha:** 21 de octubre de 2026 · **URL:** https://luisferdev11.github.io/superestela/

> **En una línea:** un sitio estático con todas las pantallas y los resultados reales del modelo final,
> calculados al publicar. Para recalcular (mover un slider, subir un archivo) se corre en local
> ([`docs/16`](16-CORRER-SUPERESTELA.md)).

## Por qué estática

El Simulador y el Traductor puntúan con el modelo final en una API de Python: ≈0.5 GB de memoria con
los modelos cargados y archivos de hasta 20 MB. Para esta primera entrega nos mantuvimos en capa
gratuita, y ninguna alcanzaba:

| Opción | Por qué no |
|---|---|
| Hugging Face Spaces (Docker) | Desde julio de 2026, Docker y Gradio en CPU piden suscripción PRO. La imagen quedó lista y probada en la rama `feat/hf-space` por si se paga después |
| Render, gratis | 512 MB: la API cabe justa y un archivo grande del Traductor la tumba; se duerme a los 15 minutos |
| Vercel, gratis | Corta las peticiones en ≈4.5 MB, y no corre Python con los modelos |

Decidido por el equipo el 21 de octubre. El sitio es público y sin contraseña (el repositorio sigue
privado): muestra resultados por lanzador, con IDs anonimizados, no los datos.

## Qué funciona

| Pantalla | En línea |
|---|---|
| Radar, Ficha (todas sus pestañas), Plantel, Despliegue, Proyección, Plan | Completas: se generan al compilar |
| Simulador | Cada pitch real de cada lanzador y los pitches base del laboratorio, con la respuesta real del modelo. Mover un slider no recalcula y lo dice |
| Traductor, un lanzador | El ejemplo de validación (pitcher_00069 2025), con la respuesta real del modelo. Editar o subir un archivo no recalcula y lo dice |
| Traductor, varios lanzadores | Abre en un ejemplo calculado con el modelo: 24 lanzadores de la LMB a nivel del mar (`public/examples/arsenals-score.json`) |

Una franja arriba de cada página dice que es la versión estática y enlaza a «Cómo correrlo» (`/correr`).

## Cómo funciona

- **`apiFetch`** (`src/sources/apiClient.ts`): toda llamada del navegador a la API pasa por ahí. En la
  compilación estática lee `precomputed/<huella>.json`, donde la huella sale de la ruta y del cuerpo
  exacto de la petición. Si no existe, responde 503 y la pantalla explica por qué.
- **El grabador** (`src/static/record.test.ts`, solo con `SUPERESTELA_RECORD=1`): arma las peticiones
  con las mismas funciones que usan las pantallas, así que los cuerpos coinciden byte por byte, y guarda
  la respuesta de la API. 2 434 respuestas (9.7 MB); la API rechaza 2 pitches reales fuera de rango,
  igual que en vivo.
- **La compilación** (`packages/web/scripts/build-static.sh`): `output: 'export'` con la ruta base del
  repo. Aparta `src/app/api`, porque un sitio estático no tiene rutas de servidor.
- **El workflow** (`.github/workflows/pages.yml`): en cada merge a `main` instala los modelos del
  Release, levanta la API, graba, compila y publica. Pesa ≈660 MB (cada página de lanzador trae sus
  datos), debajo del límite de 1 GB de Pages.

## Probarla en local

```bash
uv run python scripts/start.py                       # la API en :8000
cd packages/web
SUPERESTELA_RECORD=1 pnpm exec vitest run src/static/record.test.ts
SUPERESTELA_BASE_PATH=/superestela scripts/build-static.sh
mkdir -p /tmp/pages && ln -sfn "$PWD/out" /tmp/pages/superestela
python3 -m http.server 8090 -d /tmp/pages            # http://localhost:8090/superestela/
```

La compilación aparta `src/app/api` mientras corre: no la lances en la misma carpeta donde tienes
`pnpm dev` abierto.
