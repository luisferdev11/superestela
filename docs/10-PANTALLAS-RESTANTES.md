# SuperEstela — Las pantallas que faltan: plan de trabajo

> Escrito el **23 de septiembre de 2026**, al cerrar la P4 (Simulador). Es el plan para la siguiente
> sesión de trabajo, humana o de un agente: **quien lo lea debe poder empezar sin preguntar nada.**
>
> Cada tarea dice qué es, por qué importa, qué entra y qué no, de dónde salen sus datos, qué código
> ya existe para reutilizar y **cómo se sabe que está hecha**. `docs/08` sigue siendo la lista viva
> de pendientes; este documento es el detalle de su carril de producto.

---

## 0. Antes de empezar

### La regla que ordena todo

**Producto no hace trabajo del equipo de datos.** La P4 fue la única excepción: construimos un
modelo puente (v0 con bolsas) y sus compuertas porque el entregable 4 no podía esperar. De aquí en
adelante, A1–A3, C1–C3, los targets y cualquier modelo nuevo son del equipo de datos.

Producto construye pantallas **sobre contratos**. Cuando el modelo final llegue, cambian los
números, no las pantallas.

### «Datos mockeados» no significa datos inventados

Las pantallas se construyen sobre los **artefactos reales** que ya existen, porque salen de corridas
reales de v0:

| Archivo | Qué trae | Lo genera |
|---|---|---|
| `analysis/outputs/mockup_data.json` | 370 tarjetas lanzador-temporada: Stuff+ HH y a nivel del mar, Impuesto, rol, Trampa, arsenal resumido | `analysis/evidence.py` |
| `analysis/outputs/evidence.json` | Densidad, within-pitcher, perfiles por tipo, traductor, hipótesis | `analysis/evidence.py` |
| `analysis/outputs/simulator.json` | Rangos por tipo, mapa de efectividad, envolvente de plausibilidad, bandas de traducción | `analysis/simulator_evidence.py` |
| `analysis/outputs/arsenals.json` | Arsenal completo por lanzador-temporada y entorno: release, eje y HB con signo | `analysis/simulator_evidence.py` |
| `analysis/outputs/simulator_validation.json` | Veredicto de las compuertas y `model_id` | `analysis/simulator_gates.py` |

Si una pantalla necesita un número que no existe, **se calcula primero en `analysis/`**
(`docs/02` §0, `CONVENTIONS.md` §8.1). Nunca va una cifra plausible escrita a mano. Donde de verdad no
hay dato, va un placeholder que diga que no lo hay.

### Estado del repositorio al cerrar esta sesión

- **La P4 vive en una cadena de 10 PRs sin fusionar: #22 → #31**, encadenados sobre **#21**
  (`docs/plan-y-pendientes`). La punta es `feat/web-simulador-mapas` (#31).
- **Hay que fusionarla con `--merge` y sin `--delete-branch`**, después de reapuntar toda la cadena a
  `main`. Si se hace con `--squash --delete-branch`, se cierran los PRs siguientes. Todos necesitan una
  revisión del equipo, porque `main` tiene `enforce_admins` y exige una revisión.
- **Mientras la cadena no esté fusionada, el trabajo nuevo sale de la punta, `feat/web-simulador-mapas`**,
  no de `main`. Si no, las pantallas nuevas no tienen el Simulador, `arsenals.json`, los componentes
  del mapa ni la API.

### Arrancar el entorno

```bash
git fetch && git worktree add -b feat/<nombre> <ruta> origin/feat/web-simulador-mapas
cd <ruta> && ln -s <repo-principal>/data data     # el dataset no está en git (data/ en .gitignore)
uv sync --all-extras                               # sin esto fallan los hooks de pre-commit
cd packages/web && pnpm install --frozen-lockfile

# Evidencia y modelo (si cambió algo en analysis/):
uv run python analysis/evidence.py                 # ~1 min
uv run python analysis/simulator_gates.py          # ~1 min; entrena el puente en artifacts/

# App:
uv run uvicorn api.main:app --port 8765            # la API
SUPERESTELA_API_URL=http://localhost:8765 npx next dev -p 3456   # desde packages/web
```

### Reglas que muerden

- **Commits en inglés y el asunto todo en minúsculas** (commitlint). «NaN» en el asunto lo rechaza.
- **PRs de menos de 400 líneas** (`CONVENTIONS.md` §6.3). Una pantalla sale en 2 o 3 PRs encadenados.
- **Todo el español vive en `packages/web/src/i18n/es.ts`.** Un test falla si hay acentos en
  `components/` o `app/`.
- **Ninguna cifra en el JSX.** Todo se deriva de los artefactos y se aserta en tests contra ellos.
- **Ningún score sin su banda.** `MetricValue` exige `{value, se}`; un Δ también lleva banda
  (`formatSignedMetric`).
- **La lógica vive en `domain/` o en la API, no en los componentes.** Las islas `'use client'` van lo
  más abajo posible del árbol.
- **La API rechaza campos desconocidos** (`extra="forbid"`). Manda solo lo que el esquema pide:
  `pickValues` existe por eso.
- **El `model_id` del artefacto tiene que coincidir con `simulator_validation.json`**, o la API
  contesta `model_not_gated` y no muestra Stuff+. Si reentrenas, vuelve a correr las compuertas.
- **Verifica la interfaz con capturas headless, no con la extensión de Chrome**, que no conecta en
  esta máquina:
  ```bash
  H=$(find ~/.cache/ms-playwright/chromium_headless_shell-1208 -name chrome-headless-shell -type f | head -1)
  $H --no-sandbox --hide-scrollbars --window-size=1440,1600 --virtual-time-budget=10000 \
     --screenshot=out.png http://localhost:3456/<ruta>
  ```
  En la P4, las capturas atraparon dos bugs que los tests no habían visto.
- **Antes de escribir una pantalla, lee su `.dc.html` en el prototipo**
  (https://claude.ai/artifact/AysYSEs8pq1Aq4baGMjpAD) **y enumera sus elementos.** El prototipo es
  referencia de estructura, no de números: varias cifras suyas están desactualizadas.
- `pkill -f "<patrón>"` puede matar su propia shell. Usa un patrón que no se encuentre a sí mismo,
  como `port 876[5]`.

---

## 1. Orden y fechas

| Semana | Fechas | Producto |
|---|---|---|
| 3 | 24 sep – 1 oct | Fusionar la cadena · **P3 Traductor** · **P2 Ficha** |
| 4 | 2 – 8 oct | **P5 Plan** · P6/P7/P8 · la web lee de la API · `report/build.py` |
| 5 | 9 – 15 oct | Congelamiento el **12** · ensayo el **13** · entrega el **15** |

El orden sigue lo que el reto exige por nombre: la P3 cubre el entregable 3 y es el diferenciador;
la P2, el entregable 1; la P5, el entregable 3. P6, P7 y P8 degradan a mockup de alta fidelidad si
falta tiempo (`docs/00` §10).

---

## 2. Tareas

### T1 · Fusionar la cadena de la P4 · **bloquea a las demás**

**Qué:** revisar y fusionar #21 → #31 en orden.
**Por qué:** diez PRs encadenados envejecen rápido. Cada cambio en `main` obliga a actualizar toda la
cadena, y mientras no se fusionen, cualquier trabajo nuevo carga con ellos.
**Cómo:** seguir la memoria de PRs encadenados:
1. Reapuntar todos a `main` con `gh api -X PATCH repos/luisferdev11/superestela/pulls/N -f base=main`.
2. Fusionar en orden con `--merge`, sin `--delete-branch`.
3. Con `strict: true`, poner cada PR al día antes de fusionarlo
   (`gh api -X PUT .../pulls/N/update-branch`).

**Hecho cuando:** `main` contiene `packages/web/src/app/simulador/page.tsx` y
`uv run python scripts/check_pendientes.py` marca P4 ✅ desde `main`.
**No es de producto:** la revisión. La da alguien del equipo.

---

### T2 · P3 · Traductor de Altitud · **la siguiente pantalla**

**Pregunta:** *Este pitcher nunca ha lanzado aquí. ¿Cuánto vale en el Harp Helú?* (`docs/02` P3)

**Por qué primero:** es el diferenciador del producto (`docs/00` §3) y cubre el entregable 3 («cómo
perfilar un prospecto o agente libre»). Además es la más barata: la física, el endpoint y los
componentes visuales ya existen por la P4.

**Qué entra:**
- **Entrada:** el arsenal de un lanzador medido *fuera* del Harp Helú, pitch por pitch: tipo, uso,
  velocidad, IVB, HB, spin, eje, extensión y release. Por captura manual en una tabla editable, más
  un botón «cargar ejemplo» que llene un arsenal real desde `arsenals.json` (entorno nivel del mar).
- **Entorno de origen** elegible: nivel del mar o altitud media, con sus densidades medidas
  (`evidence.json → density`).
- **Salida, las tres cosas juntas que pide `docs/02`:**
  1. la forma proyectada en CDMX por pitch, IVB y HB **con banda**;
  2. el **Stuff+ HH proyectado con banda** por pitch y del arsenal ponderado por uso;
  3. **por qué**: el factor Magnus (0.754) y el Índice de Densidad aplicados, visibles, con una frase
     de física.
- El **mapa de movimiento** con el arsenal completo, antes y después. Reutiliza `MovementMap`.
- **Diferenciales contra la recta** en los dos entornos: el engaño que se pierde.
- Un **aviso de plausibilidad** por pitch (Mahalanobis, ya existe en `core/spin.py`).
- Un enlace «abrir este pitch en el Simulador».

**Qué no entra:**
- Carga de archivo CSV: es opcional, solo si sobra tiempo; la captura manual cubre el caso.
- Ligas de origen distintas de las que medimos: Japón y MLB se extrapolan con la ley de densidad
  (`docs/09` §3.2), y la pantalla debe decir que es extrapolación.
- **Carreras**: el puente Stuff+ → carreras no existe (r = −0.08). No se imprimen.

**Datos y código a reutilizar:**
- API: `POST /api/v1/simulate` ya devuelve forma trasladada, banda, Stuff+ ± se, Δ partido,
  diferenciales y plausibilidad. **Para un arsenal se llama una vez por pitch**, pasando el arsenal
  entero en `arsenal`. `POST /api/v1/translate` sirve si solo se quiere la física.
- Web: `components/simulator/MovementMap.tsx`, `StuffPlusKpis.tsx`, `AltitudePhysics.tsx`,
  `ArsenalContext.tsx`, `useSimulation.ts`, `domain/simulator.ts` (`sliderSpec`, `pickValues`,
  `buildRequest`) y `sources/simulatorSource.ts`.
- Origen distinto del nivel del mar: `translate()` recibe `origin_density`, pero **`/simulate` hoy
  asume que el pitch viene de nivel del mar**. Hay dos opciones: agregar a la API un campo
  `originDensityIndex` (default 1.0) que traslade primero al nivel del mar, o limitar la P3 a origen
  nivel del mar y declararlo. Recomiendo lo primero: es un cambio de ~15 líneas más su test.

**Criterios de aceptación:**
- [ ] `packages/web/src/app/traductor/page.tsx` existe y `check_pendientes` marca P3 ✅.
- [ ] Con «cargar ejemplo» sobre `pitcher_00069` (2025), la recta proyecta **15.6″ ± 0.9″** de IVB y
      el Stuff+ HH coincide con el del Simulador para el mismo pitch (**92.9 ± 4.1**). Mismo pitch,
      mismo número en toda la app.
- [ ] Cada número de salida lleva banda; ninguno sale solo.
- [ ] El factor Magnus y el Índice de Densidad que se muestran salen de `evidence.json`, no del JSX.
      Un test lo aserta.
- [ ] Un pitch fuera de la envolvente muestra el aviso de plausibilidad.
- [ ] Si la API no responde, se ve el estado de error y la tabla de entrada sigue editable.
- [ ] Tests: dominio (validación de la tabla, ponderación por uso) y un componente con la API
      simulada, como `Simulator.test.tsx`.
- [ ] Captura headless revisada contra `Traductor.dc.html` del prototipo.
- [ ] `docs/09` o un `docs/11` breve documenta lo nuevo, en particular si se agrega
      `originDensityIndex`.

---

### T3 · P2 · Ficha de Pitcher

**Pregunta:** *¿Qué tengo enfrente y qué le pasa en la altura?* (`docs/02` P2)

**Por qué:** es a donde apunta cada fila del Radar y cubre el entregable 1 («Stuff+ por pitch,
pitcher y arsenal»). Hoy el Radar no tiene a dónde llevar.

**Qué entra:**
- Ruta `app/pitchers/[pitcherId]/page.tsx`, estática: los 296 lanzadores con score se generan en build
  con `generateStaticParams`. **Lee la guía de rutas dinámicas de Next 16** en
  `node_modules/next/dist/docs/` antes de escribirla (`packages/web/AGENTS.md`).
- **Selector de temporada** con todas las que tenga, y una tabla compacta de sus temporadas con rol.
  El hueco se ve: si tiene 2024 y 2026, no hay promedio (ADR 0005).
- **Encabezado:** Stuff+ HH ± banda, nivel del mar ± banda, Δ, Impuesto de Altitud (o «no
  concluyente»), rol, bandera de Trampa, muestra por entorno, pérdida media de IVB.
- **Arsenal por pitch:** uso, velocidad, IVB y HB en los dos entornos, spin, Stuff+ en los dos
  entornos, whiff.
- **Mapa de movimiento** con los dos entornos superpuestos, medidos, no simulados.
- Un botón **«abrir en el Simulador»** por pitch, que llegue con ese lanzador y ese pitch
  seleccionados. Hoy el Simulador no lee la URL: hay que agregarle un parámetro de consulta, por
  ejemplo `?pitcher=pitcher_00069/2025&pitch=Four-Seam`.
- La fila del Radar enlaza aquí.

**Qué no entra:**
- **La Ficha Técnica con SHAP** (contribución por feature): necesita el modelo final. En su lugar va
  la razón física en lenguaje llano, sin SHAP, y un aviso de que la descomposición llega con A1.
- Las pestañas Proyección y Plan son sus propias tareas (T6 y T4). Aquí solo se enlazan.

**Datos:** `mockup_data.json` (tarjetas y `pitcher_seasons`) y `arsenals.json` (forma con signo y
release). Todo existe; no hace falta correr nada nuevo.

**Criterios de aceptación:**
- [ ] `packages/web/src/app/pitchers/[pitcherId]/page.tsx` existe y `check_pendientes` marca P2 ✅.
- [ ] `/pitchers/pitcher_00069` muestra, para 2025: Stuff+ HH **93.3 ± 0.7**, nivel del mar
      **110.5 ± 0.8**, Δ −17.2, Impuesto **no concluyente**, rol Abridor y Trampa. Las cifras salen
      de `mockup_data.json` y un test lo aserta.
- [ ] Un lanzador con hueco entre temporadas muestra el hueco, no un promedio. Tiene su test, con
      alguno de los 28 que se ausentaron y volvieron.
- [ ] Cada fila del Radar lleva a su Ficha; el rail marca la sección correcta.
- [ ] «Abrir en el Simulador» abre `/simulador` con ese lanzador y pitch ya elegidos, y el Stuff+
      mostrado coincide con el de la Ficha dentro de la tolerancia de la compuerta S4 (|Δ| medio ≤ 3).
- [ ] Un id inexistente da la página 404 de Next, no un error.
- [ ] Captura headless revisada contra `Ficha.dc.html` y `Arsenal.dc.html`.

---

### T4 · P5 · Plan de Desarrollo

**Pregunta:** *¿Qué le arreglo a este pitcher?* (`docs/02` P5)

**Por qué:** cubre el entregable 3 junto con el Traductor. Es la pantalla del pitching coach, que es
quien se sienta en la entrevista de 10 minutos.

**Qué entra:**
- Ruta `app/plan/page.tsx`, con un selector de lanzador. También se llega desde la Ficha.
- **No son tarjetas: son dos o tres frases con plantilla fija** (`docs/02` P5):
  - *Qué se degrada*: cuál pitch pierde más y cuántas pulgadas.
  - *Qué aguanta*: cuál conserva su forma, y por qué físicamente.
  - *Qué cambia*: qué reparto de uso lo compensa, en puntos de Stuff+ HH ponderado.
- Cada frase se arma en `domain/` desde datos; ningún texto con cifras escrito a mano.
- El **cambio de uso** se calcula como el Stuff+ HH ponderado del arsenal con los usos actuales contra
  los propuestos. Es aritmética sobre las cifras por pitch que ya existen; no hace falta un modelo nuevo.
- Enlace a «probar el cambio en el Simulador».

**Qué no entra:**
- **Carreras por cada 9 entradas en la frase de «qué cambia».** `docs/02` lo pide, pero el puente
  Stuff+ → carreras no existe (r = −0.08, `docs/05`), así que se imprime solo Stuff+. Esta
  discrepancia con `docs/02` hay que corregirla en el propio `docs/02` en el mismo PR.
- Recomendaciones de mecánica («sube el brazo»): no las sostiene ningún dato.

**Datos:** `mockup_data.json` (arsenal con Stuff+ por pitch y entorno, uso) y `arsenals.json`. El caso
de referencia es `pitcher_00566` (aguanta con el slider) contra `pitcher_00069` (colapsa con la recta).

**Criterios de aceptación:**
- [ ] `packages/web/src/app/plan/page.tsx` existe y `check_pendientes` marca P5 ✅.
- [ ] Para `pitcher_00069` (2025), «qué se degrada» nombra la recta y sus pulgadas perdidas, que
      salen de las cifras reales (20.7″ → 15.0″), no del JSX.
- [ ] La propuesta de uso nunca da usos que no sumen 100% ni usa un pitch que el lanzador no tiene.
      Test de propiedad.
- [ ] El Stuff+ HH ponderado antes y después lleva banda (propagada desde las bandas por pitch; basta
      documentar el supuesto) y el mecanismo físico va en una frase.
- [ ] Ninguna frase imprime carreras.
- [ ] Captura headless revisada contra `Plan.dc.html`.

---

### T5 · P6 · Tablero de Despliegue · **tiene una pregunta abierta**

**Pregunta:** *¿Quiénes son los mejores para el estadio donde se juega?* (`docs/02` P6)

**Qué entra:** un selector de entorno (nivel del mar, altitud media, Harp Helú) y el roster ordenado
por el Stuff+ de **ese** entorno, agrupado en abridores y relevistas. **No sugiere orden de pitcheo**
(`docs/02`).

**⚠ Pregunta abierta que decide el alcance:** «el roster» presupone saber qué lanzadores son de
Diablos, y **el dataset viene anonimizado y sin equipo.** Antes de construir, pregúntale al usuario
cuál de estas usar:
1. mostrar a los 296 con score y declarar que el filtro «nuestro plantel» se activa cuando el club
   entregue su lista de IDs;
2. aproximar el plantel por los lanzadores con más apariciones en Harp Helú, **declarado como
   aproximación**;
3. dejar la pantalla como mockup.

**No inventes la lista.**

**Datos:** `mockup_data.json` (Stuff+ por entorno y rol). Para altitud media no hay Stuff+ por
lanzador: habría que agregarlo en `analysis/evidence.py` o limitar el selector a dos entornos.

**Hecho cuando:** `packages/web/src/app/despliegue/page.tsx` existe; la correlación de orden entre
casa y gira (**0.700**) y el cambio mediano (**38 posiciones**) que justifican la pantalla salen
de una corrida y se asertan en tests; la decisión sobre el roster está escrita en un ADR.

---

### T6 · P7 · Proyección

**Pregunta:** *¿Cómo se vería este lanzador en el estadio de la próxima serie?* (`docs/02` P7)

**Qué entra:** la forma medida de un lanzador proyectada a un entorno elegido, **incluida la altitud
media**, por pitch, con banda por eje y el factor aplicado. Es el Traductor aplicado a alguien que ya
está en los datos. Vive como pestaña de la Ficha, o en `app/proyeccion/page.tsx` si `check_pendientes`
lo exige así.

**Qué no entra:** Stuff+ en altitud media, porque el puente no se validó ahí. La pantalla declara su
propio límite: si el lanzador ya tiene muestra en el destino, la Ficha trae la medición y la
proyección sobra.

**Datos:** `arsenals.json` y la ley de `translate()` con las densidades de `evidence.json`.

**Hecho cuando:** `packages/web/src/app/proyeccion/page.tsx` existe; para un lanzador con muestra en
los dos entornos, la proyección mar → Harp Helú cae dentro de la banda de lo medido en la mayoría de
sus pitches (test sobre `pitcher_00069`); la extrapolación a altitud media se declara en pantalla.

---

### T7 · P8 · Plantel · **misma pregunta abierta que T5**

**Qué entra:** los lanzadores con su Stuff+ por temporada y su rol. Es la contraparte del Radar y la
puerta a la Ficha.

**Hecho cuando:** `packages/web/src/app/plantel/page.tsx` existe y la decisión sobre qué es «el
plantel» (T5) está aplicada y declarada. Si se elige mockup, que sea explícito en pantalla.

---

## 3. Tareas que no son pantallas y no pueden esperar

| Tarea | Por qué | Hecho cuando |
|---|---|---|
| **`report/build.py`** | Ninguna tabla del documento técnico se hace a mano (`docs/05` §4.3), y el documento se escribe contra cifras congeladas el **12 de octubre** | Existe y genera las tablas de `docs/09` §5.1 desde `simulator_validation.json` y `evidence.json` |
| **La web lee de la API** (semana 4) | Hoy las pantallas leen JSON en build; el cambio es un archivo nuevo en `sources/` y ningún componente tocado | `packages/web/src/sources/apiSource.ts` existe y la P1 lo usa |
| **`GET /api/v1/pitchers/{id}/scores`** | Tercer endpoint de `CONVENTIONS.md` §5.2; lo necesita `apiSource` | Responde con las tarjetas de ese lanzador y tiene tests de caso feliz, 404 y validación |
| **Copy de prohibición de apuestas** | `docs/03` §9: declarado en el producto, no en un pie de página | Visible en el rail o en el pie de toda pantalla, con el texto en `es.ts` |
| **Entregable 2 · Perfil Físico Ideal** | Decidido como sección del documento técnico más una lámina del deck (`docs/08`) | La sección existe, con cifras de `evidence.json` |
| **Prototipo y deck** | Cada cambio de cifra va en tres lugares: evidencia, docs y artifact | Las pantallas nuevas del artifact dicen «maqueta» donde sus cifras no son las vigentes, como ya se hizo con el Simulador |

---

## 4. Lo que queda del Simulador (P4)

No bloquea las pantallas nuevas, pero hay que cerrarlo antes del 13 de octubre:

- [ ] **Ensayo cronometrado** de las tres historias de `docs/09` §5.2: cada pregunta respondida en
      ≤ 10 segundos (compuerta P1).
- [ ] **Sesión con alguien del staff vía ISAC**, si se consigue (compuerta P2).
- [ ] Cuando llegue A3: pasarlo por el mismo contrato y las mismas compuertas
      (`analysis/simulator_gates.py`), reentrenar y actualizar `docs/09` §5.1.

La explicación completa del Simulador, para el equipo, está en
https://claude.ai/artifact/Fgr192a2cnf5gKK3HvXFuL (es privada: hay que compartirla desde su menú).
