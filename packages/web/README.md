# `packages/web` — la aplicación

Next.js App Router + TypeScript, Tailwind 4, pnpm 10, Vitest.
Nació el 21 de septiembre de 2026 (PRs #10 a #17).

```bash
cd packages/web
pnpm install --frozen-lockfile
pnpm dev                                  # http://localhost:3000/radar
pnpm lint && pnpm typecheck && pnpm test  # lo que corre el job `web` de CI
```

Es un **proyecto pnpm autónomo**, no un workspace: `ci.yml` espera
`packages/web/pnpm-lock.yaml`, así que no hay `pnpm-workspace.yaml` en la raíz.

---

## De dónde salen los datos, y por qué así

La app lee **`analysis/outputs/mockup_data.json` y `evidence.json`** con
`fs.readFile`, desde el servidor. **El archivo real, no una copia.**

- Una copia sería una cuarta fuente de verdad que se queda atrás en silencio.
  Leyendo el archivo real, el test de contrato se vuelve un **detector de
  deriva** entre el equipo de datos y producto.
- No la API, porque `packages/api/` solo tiene `/health` y las rutas de scoring
  llegan con el modelo. `docs/08` presupuesta ese cambio para la **semana 4**.
- No un import estático: son 727 KB, y con `fs` + `import 'server-only'` que un
  componente cliente los toque es un error de compilación, no una revisión.

La frontera vive en `src/sources/` y está diseñada para que el cambio a la API
sea **un archivo nuevo y ningún componente tocado**:

| Archivo | Qué es |
|---|---|
| `paths.ts` | Lo único que sabe dónde viven los artefactos |
| `schema.ts` | Zod, el gemelo en TypeScript de `contracts/schemas.py`. Es `strict()` |
| `adapter.ts` | El único lugar donde `snake_case` se vuelve `camelCase` |
| `mockupSource.ts` | `server-only` + parseo |

> La carpeta se llama `sources/` y no `data/` porque **la regla `data/` del
> `.gitignore` no está anclada** y se traga cualquier carpeta con ese nombre a
> cualquier profundidad. Renombrar cuesta nada; abrirle un hueco a la regla que
> mantiene el dataset fuera de git, mucho.

---

## Ninguna cifra se escribe en el JSX

Todo lo que la pantalla muestra se **deriva** al renderizar y un test lo compara
contra `evidence.json`, que es la corrida que lo respalda. Es `CONVENTIONS.md`
§8 hecho máquina: si alguien re-corre `analysis/evidence.py` y las cifras se
mueven, CI lo dice antes que el deck.

```bash
uv run python analysis/evidence.py   # ~3 min
cd packages/web && pnpm test         # los tests de cohorte deben seguir verdes
```

Si fallan, las cifras se movieron y hay que aplicarlas en los **tres** lugares
del `README` de la raíz: la evidencia, los documentos y el prototipo.

---

## Cuatro trampas que ya costaron tiempo

1. **`packageManager` en `package.json` rompe el CI.** `pnpm/action-setup` lanza
   `Multiple versions of pnpm specified` si el input `version` y
   `packageManager` no son idénticos *como cadena*, y `ci.yml` pasa `version: 10`.
   El pin local va por `engines` + corepack.
2. **`import.meta.dirname` no existe en el bundle de Next.** Compila y revienta
   al recolectar la página. Las rutas a archivos se anclan a `process.cwd()`,
   que es `packages/web` tanto en Next como en Vitest.
3. **`new URL(..., import.meta.url)` dentro de un test** lo reescribe el plugin
   de React como si fuera un asset del bundle. Usar `path.join`.
4. **`next dev` escribe `AGENTS.md` y `CLAUDE.md` aquí, solo**, cada vez que
   arranca (`node_modules/next/dist/server/lib/generate-agent-files.js`). Están
   commiteados para que el árbol quede limpio; borrarlos solo los recrea.

---

## El prototipo es la referencia de la interfaz, no solo de los tokens

**https://claude.ai/artifact/AysYSEs8pq1Aq4baGMjpAD**

Antes de escribir código de una pantalla, **leer su `.dc.html` y enumerar sus
elementos**. La P1 se construyó dos veces por no hacerlo: primero la tabla sola,
y después el rail, los filtros, dos columnas y la leyenda que el prototipo ya
tenía.

Los tokens se transcribieron una vez a `src/design/tokens.json`, con la fecha y
el origen escritos en el archivo. De ahí en adelante **el repositorio es la
fuente de los valores** y el prototipo la referencia visual. `pnpm tokens`
regenera el CSS, y un test falla si alguien lo edita a mano.

Al aterrizar una pantalla nueva, cambiar su `null` por la ruta en
`src/domain/navigation.ts`: el rail se entera solo.

---

## Las reglas que el código sostiene, no la disciplina

| Regla | Cómo se sostiene |
|---|---|
| Ningún score sin su banda | `MetricValue` recibe un `Metric = { value, se }`, un objeto. No existe la forma de pasar uno sin el otro, y un `@ts-expect-error` en el test falla el `typecheck` si alguien lo vuelve opcional |
| Debajo de 100 lanzamientos, «muestra insuficiente» | El test lee `MIN_PITCHES_FOR_SCORE` de `packages/contracts/schemas.py` y compara. No se re-teclea |
| «No concluyente» no es un número | El adaptador convierte el impuesto no significativo en `null`. El test comprueba que la salida **no contiene ningún dígito** |
| El español vive en un archivo | Un test recorre `components/` y `app/` y falla si encuentra texto acentuado fuera de los comentarios |
| Los tokens son una sola fuente | El test regenera el CSS en memoria y lo compara con el commiteado |

---

## Estructura

```
src/
├── app/            rutas. `radar/` es la P1
├── components/     chrome/ · metric/ · chip/ · radar/
├── domain/         PURO: sin React, sin I/O. Cohorte, orden, filtros, formato
├── sources/        la frontera con los datos
├── design/         tokens.json, la fuente única
└── i18n/           el único archivo con español
```

`domain/` separado de `components/` no es estética: es `CONVENTIONS.md` §4
regla 6 («no business logic in components»), y es lo que hace que los tests no
necesiten montar React.
