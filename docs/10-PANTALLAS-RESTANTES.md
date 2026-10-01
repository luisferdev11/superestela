# SuperEstela — Las pantallas que faltan: plan de trabajo

> Escrito el **23 de septiembre de 2026**, al cerrar la P4 (Simulador). Es el plan para la siguiente
> sesión de trabajo, humana o de un agente: **quien lo lea debe poder empezar sin preguntar nada.**
>
> Cada tarea dice qué es, por qué importa, qué entra y qué no, de dónde salen sus datos, qué código
> ya existe para reutilizar y **cómo se sabe que está hecha**. `docs/08` sigue siendo la lista viva
> de pendientes; este documento es el detalle de su carril de producto.
>
> **Nota del 28 de septiembre:** las pantallas se construyen sobre los artefactos de v0, como dice
> §0. Lo que producto no hace es otro modelo ni otro puente: eso es del equipo de datos. Lo que se
> necesita de ellos, y por qué, está en [`docs/11`](11-LO-QUE-NECESITA-PRODUCTO.md).
>
> **Estado al 1 de octubre.** En `main`: P1 Radar, P2 Ficha y su pestaña Arsenal (#36–#48), P4
> Simulador, P5 Plan (#49–#51), P6 Despliegue y P8 Plantel (#56). La P7 Proyección tiene sus datos en
> `main` (#57) y su pantalla en el #58, listo para revisión. **Solo falta la P3 Traductor**, que bajó de
> prioridad tras el Q&A (§5). Lo que sigue, con criterio de hecho, está en la checklist de
> [`docs/08`](08-PLAN-DE-ARRANQUE.md).

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
| `analysis/outputs/mockup_data.json` | 370 tarjetas lanzador-temporada: Stuff+ en altitud extrema y a nivel del mar, Impuesto, rol, Trampa, arsenal resumido | `analysis/evidence.py` |
| `analysis/outputs/evidence.json` | Densidad, within-pitcher, perfiles por tipo, traductor, hipótesis | `analysis/evidence.py` |
| `analysis/outputs/simulator.json` | Rangos por tipo, mapa de efectividad, envolvente de plausibilidad, bandas de traducción | `analysis/simulator_evidence.py` |
| `analysis/outputs/arsenals.json` | Arsenal completo por lanzador-temporada y entorno: release, eje y HB con signo | `analysis/simulator_evidence.py` |
| `analysis/outputs/simulator_validation.json` | Veredicto de las compuertas y `model_id` | `analysis/simulator_gates.py` |

Si una pantalla necesita un número que no existe, **se calcula primero en `analysis/`**
(`docs/02` §0, `CONVENTIONS.md` §8.1). Nunca va una cifra plausible escrita a mano. Donde de verdad no
hay dato, va un placeholder que diga que no lo hay.

### Estado del repositorio

- La P4 llega a `main` con el PR de integración **#32** (24 de septiembre). La cadena #22–#31 se
  fusionó cada PR sobre el anterior en lugar de sobre `main`, y el #32 la lleva a `main` de una vez.
- **Todo trabajo nuevo sale de `main`**, una vez fusionado el #32. Las ramas viejas de la cadena ya se
  borraron.

### Arrancar el entorno

Está en el [README](../README.md): «Arrancar, una sola vez», «Levantar la app» y la tabla «Si algo no
jala». En corto:

```bash
uv sync --all-extras && (cd packages/web && pnpm install)
uv run python analysis/evidence.py && uv run python analysis/simulator_gates.py
uv run uvicorn api.main:app --port 8000        # terminal 1
cd packages/web && pnpm dev                    # terminal 2 → http://localhost:3000
```

Si se trabaja en un worktree, necesita su propio `uv sync --all-extras` y un enlace a `data/`
(`ln -s <repo>/data data`), o fallan los hooks y la evidencia.

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
- **El modelo y su veredicto viven juntos en `artifacts/`**, fuera de git. La API solo muestra Stuff+
  si el veredicto junto al modelo corresponde a ese modelo. Correr las compuertas no toca archivos
  versionados; `--publish` actualiza el registro de `analysis/outputs/` y solo se usa cuando el
  modelo o las compuertas cambian.
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
| 3 | 24 sep – 1 oct | Fusionar el #32 · **P3 Traductor** · **P2 Ficha** |
| 4 | 2 – 8 oct | **P5 Plan** · P6/P7/P8 · la web lee de la API · `report/build.py` |
| 5 | 9 – 15 oct | Congelamiento el **12** · ensayo el **13** · entrega el **15** |

El orden sigue lo que el reto exige por nombre: la P3 cubre el entregable 3 y es el diferenciador;
la P2, el entregable 1; la P5, el entregable 3. P6, P7 y P8 degradan a mockup de alta fidelidad si
falta tiempo (`docs/00` §10).

---

## 2. Tareas

### T1 · Fusionar el #32 · ✅ hecho

**Qué:** el PR de integración #32 (`chore/simulador-a-main` → `main`) lleva a `main` toda la P4, la
guía de arranque del README y el veredicto del modelo junto al modelo. Necesita una aprobación de
alguien del equipo: quien lo abrió no puede aprobarse a sí mismo y `main` tiene `enforce_admins`.
**Cómo:** aprobar y fusionar con merge commit; después, borrar la rama `chore/simulador-a-main`.
Es la última rama vieja.

**Hecho cuando:** `git ls-tree origin/main packages/web/src/app/simulador/page.tsx` la encuentra y
`uv run python scripts/check_pendientes.py` marca P4 ✅ desde `main`.

---

### T2 · P3 · Traductor de Altitud · construida (#67–#71), en revisión

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
  2. el **Stuff+ en altitud extrema proyectado con banda** por pitch y del arsenal ponderado por uso;
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
      el Stuff+ en altitud extrema coincide con el del Simulador para el mismo pitch (**92.9 ± 4.1**). Mismo pitch,
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

### T3 · P2 · Ficha de Pitcher · ✅ en `main`

**Pregunta:** *¿Qué tengo enfrente y qué le pasa en la altura?* (`docs/02` P2)

**Por qué:** es a donde apunta cada fila del Radar y cubre el entregable 1 («Stuff+ por pitch,
pitcher y arsenal»). Hoy el Radar no tiene a dónde llevar.

**Qué entra:**
- Ruta `app/pitchers/[pitcherId]/page.tsx`, estática: los 296 lanzadores con score se generan en build
  con `generateStaticParams`. **Lee la guía de rutas dinámicas de Next 16** en
  `node_modules/next/dist/docs/` antes de escribirla (`packages/web/AGENTS.md`).
- **Selector de temporada** con todas las que tenga, y una tabla compacta de sus temporadas con rol.
  El hueco se ve: si tiene 2024 y 2026, no hay promedio (ADR 0005).
- **Encabezado:** Stuff+ en altitud extrema ± banda, nivel del mar ± banda, Δ, Impuesto de Altitud (o «no
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
- [ ] `/pitchers/pitcher_00069` muestra, para 2025: Stuff+ en altitud extrema **93.3 ± 0.7**, nivel del mar
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

### T4 · P5 · Plan de Desarrollo · ✅ en `main`

**Pregunta:** *¿Qué le arreglo a este pitcher?* (`docs/02` P5)

**Por qué:** cubre el entregable 3 junto con el Traductor. Es la pantalla del pitching coach, que es
quien se sienta en la entrevista de 10 minutos.

**Qué entra:**
- Ruta `app/plan/page.tsx`, con un selector de lanzador. También se llega desde la Ficha.
- **No son tarjetas: son dos o tres frases con plantilla fija** (`docs/02` P5):
  - *Qué se degrada*: cuál pitch pierde más y cuántas pulgadas.
  - *Qué aguanta*: cuál conserva su forma, y por qué físicamente.
  - *Qué cambia*: qué reparto de uso lo compensa, en puntos de Stuff+ en altitud extrema ponderado.
- Cada frase se arma en `domain/` desde datos; ningún texto con cifras escrito a mano.
- El **cambio de uso** se calcula como el Stuff+ en altitud extrema ponderado del arsenal con los usos actuales contra
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
- [ ] El Stuff+ en altitud extrema ponderado antes y después lleva banda (propagada desde las bandas por pitch; basta
      documentar el supuesto) y el mecanismo físico va en una frase.
- [ ] Ninguna frase imprime carreras.
- [ ] Captura headless revisada contra `Plan.dc.html`.

---

### T5 · P6 · Tablero de Despliegue · ✅ en `main` (#56), demostrativa

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
casa y gira (**0.638**, antes citada como 0.700) y el cambio mediano (**40 posiciones**, antes 38) que justifican la pantalla salen
de una corrida y se asertan en tests; la decisión sobre el roster está escrita en un ADR.

---

### T6 · P7 · Proyección · datos en `main` (#57), pantalla en #58

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

### T7 · P8 · Plantel · ✅ en `main` (#56), demostrativa

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
| **Location+ y Pitching+** (del equipo de datos) | El entregable 1 pide «Stuff+, Location+, Pitching+» por lanzamiento, y hoy solo existe Stuff+. No estaba en ningún plan | Existen los dos scores por lanzamiento, o `docs/08` dice por qué no, según lo que conteste Diablos en el Q&A |
| **Despliegue de la app**, si hace falta | Si la entrevista exige la app en internet, hoy no hay dónde correrla: la API necesita el modelo, que no va a git | Decidido tras el Q&A: o una URL pública que funcione el 13 de octubre, o una demo local declarada |
| **Prototipo y deck** | Cada cambio de cifra va en tres lugares: evidencia, docs y artifact | Las pantallas nuevas del artifact dicen «maqueta» donde sus cifras no son las vigentes, como ya se hizo con el Simulador |

---

### Preguntas que se llevaron al Q&A con Diablos (30 de septiembre, 17:00)

Las preguntas vivían en Claude Docs
(https://claude.ai/code/artifact/1cdb16ee-211f-42ee-9ddb-eb4f3148f966). Las respuestas están en §5.

## 4. Lo que queda del Simulador (P4)

No bloquea las pantallas nuevas, pero hay que cerrarlo antes del 13 de octubre:

- [ ] **Ensayo cronometrado** de las tres historias de `docs/09` §5.2: cada pregunta respondida en
      ≤ 10 segundos (compuerta P1).
- [ ] **Sesión con alguien del staff vía ISAC**, si se consigue (compuerta P2).
- [ ] Cuando llegue A3: pasarlo por el mismo contrato y las mismas compuertas
      (`analysis/simulator_gates.py`), reentrenar y actualizar `docs/09` §5.1.

La explicación completa del Simulador, para el equipo, está en
https://claude.ai/artifact/Fgr192a2cnf5gKK3HvXFuL (es privada: hay que compartirla desde su menú).

---

## 5. Respuestas del Q&A con Diablos (30 de septiembre)

Respondió Emilio, analista de Diablos. La transcripción está fuera del repo; esto es lo que cambia el
plan, citado donde importa.

| Tema | Lo que dijo | Qué cambia |
|---|---|---|
| **Categorías de altitud** | No Altitude 0–700 m; Medium 800–1,600 m (Oaxaca); **Extreme: Puebla, CDMX, Aguascalientes, Querétaro y León** | «Stuff+ en altitud extrema» es el promedio de **cinco parques**, no el Harp Helú. Nombre híbrido decidido el 1 oct: «altitud extrema» en cifras y tablas, «Harp Helú» solo en narrativa. Detalle en [`reference/categorias-altitud.md`](reference/categorias-altitud.md) |
| **Escala de 100** | «Ese sería **por estadio** […] el mismo picheo puede valer 120 a nivel del mar, pero 150 en la altura, o viceversa» | 100 es el promedio **de cada entorno**, probablemente por tipo de pitch. El v0 normaliza sobre toda la liga y el ADR 0007 proponía normalizar a nivel del mar: los dos difieren de esto. Decide datos antes del 12, **y se confirma por correo** con un ejemplo. Cambia el significado del Δ y de la Trampa: de «cuánto pierde» a «cuánto cambia su lugar» |
| **Evaluación** | Holdout propio: **la postemporada 2026**. No imponen definición de run value: cómo definimos la calidad del picheo también se evalúa | Hace falta un **scorer reproducible** que corra sobre sus datos (`docs/11` §8) |
| **Location+ y Pitching+** | «Vamos a evaluar sobre todo Stuff+»; los otros dos «salen y nacen de Stuff+», son un *nice to have*. Cuenta incluir **qué harían con más tiempo** | Se incluyen después del scorer. Si no alcanza, van en esa sección |
| **Qué mira Diablos** | Swings abanicados y ponches, porque en la altura hasta el contacto débil se vuelve hit; y ponches contra bases por bolas, como comando | El target pesa el whiff por entorno, desde los datos (`docs/11` §8). En producto: whiff, K y K−BB más visibles |
| **¿Solo Diablos?** | No: evaluar a todos. Ellos saben quién es cada ID anonimizado y buscan lanzadores que rindan en la altura | **El Radar es la pantalla central.** El plantel de Diablos **no se va a obtener**: P6 y P8 quedan demostrativas (ADR 0008) |
| **Simulación física** | Interesante como complemento, «pero no sería el entregable principal» | **La P3 Traductor baja de prioridad.** El Simulador (P4) y la Proyección (P7) ya cubren la física |
| **Fuentes externas** | Se valen si son públicas y reproducibles, explicando para qué se usaron | Clima o altitud por parque se pueden usar, documentados |
| **Datos faltantes** | Normales en las métricas de batazo; quitaron los parques con radar mal calibrado; hay temporadas incompletas | Política de exclusión o imputación escrita en el documento técnico |
| **Uso** | Pretemporada (¿llega con menos movimiento o velocidad?), juntas semanales con los pitchers, quizá en vivo | La Ficha y su tabla de temporadas son la vista de pretemporada |
| **Entrega y presentación** | Por correo; detalles después. Valoran claridad para una audiencia no técnica, interactividad («super plus») y reproducibilidad. Revisa Octavio Hernández | Ensayar para no técnicos; README reproducible |

**Lo que no se respondió:** si la demo puede ser local o debe estar en internet. Se pregunta por
correo, junto con la confirmación de la escala.

---

## 6. Pasada de paridad contra el prototipo (1 de octubre)

Revisé cada pantalla construida contra su `.dc.html`, con capturas a 1440 y a 1280 px. Lo que estaba
roto y no requería decidir nada se arregló en el #78: la mano en inglés, las referencias internas en
el texto para el coach, cifras partidas en dos renglones y un par de rótulos. **Lo que queda**, en
orden de valor para la demo:

### Requiere una decisión

1. **El «±» no significa lo mismo en todas las pantallas.** En el Radar, la Ficha y el Despliegue es
   la banda al 95%. En el Simulador, el Traductor y la Proyección es un error estándar, y la
   Proyección lo dice. En el Plan, «93.3 ± 0.7» (la tarjeta) convive con «93.3 ± 0.4» (el arsenal
   ponderado). Propuesta: una sola convención, la banda al 95%, y que cada pantalla lo diga.
2. **La Ficha Técnica del prototipo** («de dónde vienen los −23.0 del four-seam»: cuánto se debe al
   IVB, al HB, a la velocidad y al spin) no existe. Para cada feature hace falta una atribución del
   modelo (SHAP, A1), así que es **trabajo de datos**; el Simulador ya separa forma de entorno.
3. **El orden de la Ficha a 1280 px:** el mapa ocupa la primera pantalla y la tabla del arsenal queda
   abajo. El prototipo los pone lado a lado.

### Arreglos chicos (menos de 30 líneas cada uno)

- **Plantel:** «Agrupar por rol» no muestra dónde terminan los abridores. Falta una fila separadora.
- **Despliegue:** la nota dinámica del prototipo («pitcher_X es último en casa y N° de gira»), que
  convierte la columna Cambio en una historia.
- **Pestaña Arsenal de la Ficha:** sin datos de ubicación solo repite la tabla. Agregar el enlace
  «Palanca para el coach» al Plan, y achicar los mapas vacíos mientras llega Location+.
- **Proyección:** el recuadro «Cuándo sirve» del prototipo, y explicar por qué un pitch queda «fuera»
  de la banda (break chico, error relativo grande).
- **Ficha:** la temporada sin score como chip gris con su motivo, en la barra de contexto.
- **Simulador:** la banda gris de cada slider (p5–p95 de la liga) no tiene leyenda, y el panel
  «Contra su recta» queda casi vacío cuando el pitch es la recta misma.
