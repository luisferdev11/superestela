# 17 · La demo en línea: un Space de Hugging Face

Para que el jurado pruebe SuperEstela sin instalar nada. Gratis (CPU basic), detrás de usuario y
contraseña. Decidido el 20 de octubre: el equipo confirmó que se puede publicar.

## Cómo está armado

Un solo contenedor (`deploy/hf-space/Dockerfile`):

| Pieza | Dónde | Notas |
|---|---|---|
| Web (Next.js, build de producción) | `:7860`, el único puerto que expone el Space | Pide usuario y contraseña si existe `SUPERESTELA_BASIC_AUTH` (`src/proxy.ts`) |
| API (FastAPI) con los modelos | `:8000`, interno | 2 workers, ~465 MB en total |

**El Space público solo tiene el `Dockerfile`, `start.sh` y el README.** El código se clona del repo
privado y los modelos se bajan del Release `models-1.1.0` durante el build, con `GH_TOKEN` como
secreto. `fetch_models.py` comprueba el sha256 contra `models.lock.json` y carga cada modelo. No
entran `data/`, `mlFlow/` ni `notebooks/`.

## Medido en local (20 oct)

- Sin contraseña, 401; con ella, 200.
- Traductor con un archivo de 19 MB (24 lanzadores): 2.4 s a través de la contraseña.
- 15 usuarios a la vez moviendo el Simulador (150 peticiones): mediana 0.11 s, p95 0.17 s.

## Cómo se publica

1. Crear el Space: SDK **Docker**, plantilla **Blank**, **CPU basic**, público.
2. En *Settings → Variables and secrets*:
   - secreto `GH_TOKEN`: token *fine-grained* de GitHub, solo lectura (**Contents: Read**) de este repo;
   - secreto `SUPERESTELA_BASIC_AUTH`: `usuario:contraseña`;
   - variable `GIT_REF` (opcional): la rama o etiqueta a desplegar; por defecto `main`.
3. Subir `deploy/hf-space/` a la raíz del repo del Space:
   `hf upload <usuario>/superestela deploy/hf-space . --repo-type space`.

Para actualizar la demo después de un merge: *Settings → Factory rebuild*.

## Lo que hay que saber

- Comparte la URL directa (`https://<usuario>-superestela.hf.space`), no la página del Space: el
  diálogo de contraseña no siempre aparece dentro del marco de huggingface.co.
- El Space se duerme tras unas 48 h sin visitas y tarda uno o dos minutos en despertar: ábrelo antes
  de que lo prueben.
- Probar el contenedor en local está en el encabezado del `Dockerfile`.
