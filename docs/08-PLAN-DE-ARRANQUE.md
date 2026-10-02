# SuperEstela — Plan hacia el 22 de octubre

> Actualizado el **1 de octubre de 2026, noche**, después de fusionar #80, #81 y #82 y de abrir el #83. **La entrega es el 22 de octubre** (confirmado; la
> página oficial también lo dice). La §0.0 es lo que sigue; el resto de la §0 es el registro del 1 de
> octubre, y de la §1 en adelante es el plan del 23 de septiembre.
>
> Este documento es la lista viva de pendientes. Cada uno lleva su **criterio de
> hecho**, y los que una máquina puede verificar los verifica
> `scripts/check_pendientes.py`. Un pendiente sin criterio es una intención.

```bash
uv run python scripts/check_pendientes.py       # el estado, ahora mismo
```

---

## 0. Dónde estamos al 1 de octubre, y la checklist

### 0.0 Para la siguiente sesión: léelo primero

**Contexto en cinco líneas:**

- **Fechas:** entrega el **22 de octubre** (confirmado), finalistas el 2 de noviembre, final el 11. El
  calendario de cierre propuesto es congelar cifras el **19** y ensayar el **20**; falta que el equipo
  lo confirme.
- **La demo puede ser local.** No hace falta desplegar.
- **Datos se integra con [`docs/11`](11-LO-QUE-NECESITA-PRODUCTO.md).** Entregan un `Scorer` en
  `artifacts/` y `scripts/regenerate.py --model` lo lleva a las ocho pantallas, la API, las compuertas
  y el holdout (ADR 0010). Sin `--model`, los números de hoy.
- **La web es demostrativa:** corre sobre el v0 y el puente. Los modelos buenos (Stuff+ final,
  Location+, Pitching+, la escala) **los entrega el equipo de datos**; producto no los construye
  (memoria `superestela-frontera-datos`). Las dudas de modelo, holdout y escala son de ellos.
- **Ya no hay cadenas de PRs.** Los 20 PRs del 1 de octubre se consolidaron en tres, y **los tres están
  en `main`** desde el 1 de octubre. Lo abierto ahora:

  | PR | Qué | Estado |
  |---|---|---|
  | #80 | Scorer (`python -m models.score`), API con origen, K/BB/whiff en la evidencia, `report/` | ✅ en `main` |
  | #81 | Todas las pantallas nuevas y sus arreglos | ✅ en `main` |
  | #82 | Q&A, renombre, Decision Log, esqueleto del documento técnico, ficha ejecutiva | ✅ en `main` |
  | **#83** | El Traductor para lanzadores que no están en los datos (tarea 4) | En revisión |

- **Cómo se trabaja desde aquí:** un PR por tarea de esta checklist, desde `main` y hacia `main`. La
  documentación de la tarea va en el mismo PR, y la casilla se marca ahí mismo.

- **Revisión de código del 1 de octubre:** hecha y corregida (abajo). Quedan dos decisiones abiertas.

**Sin preguntar de nuevo:** el renombre híbrido («altitud extrema» en cifras y tablas, «Harp Helú» en
narrativa), el comando del scorer es de producto y el modelo de datos (ADR 0009), la escala la
decide datos (los textos ya están listos para las dos, `es.scale`), el «±» es la banda al 95% en todas
las pantallas, y el Traductor es para quien no está en los datos (`docs/12` §2.1).

**Checklist, en orden.** Cada tarea tiene su criterio de hecho.

- [x] **1 · Que entren #80, #81 y #82.** Hecho el 1 de octubre: los tres en `main`, y
      `check_pendientes` marca P3, P7, `report/build.py` y «Scorer reproducible».
      ✔ `git ls-tree origin/main packages/models/score.py report/build.py packages/web/src/app/traductor/page.tsx docs/12-DECISION-LOG.md`
      lista los cuatro, y `uv run python scripts/check_pendientes.py` marca P3, P7, `report/build.py`
      y «Scorer reproducible».
- [ ] **2 · Correo a ISAC y Diablos con lo que no sabemos.** El borrador está en la memoria del
      proyecto (`superestela-qa-diablos`): la escala con el ejemplo de `docs/11` §8.3 y el ajuste
      «por temporada», y el formato del holdout (columnas y quién corre el scorer). La fecha y la demo
      local ya están resueltas.
      ✔ El correo se envió, y las respuestas quedan en `docs/10` §5.
- [ ] **3 · Las dos preguntas literales del reto que no tienen tabla** (texto en `docs/13`):
      - «¿qué arsenal produce el Stuff+ más alto en Harp Helú?» (entregable 1): una tabla de
        combinaciones de arsenal contra el Stuff+ en altitud extrema, desde `mockup_data.json`;
      - «cuantificando el riesgo adicional de contacto duro y jonrón» (entregable 3): el Δ de hard-hit
        y HR/BIP por tipo, desde `evidence.json → pitch_profiles`.

      ✔ Las dos son tablas de `report/tables/`, generadas por `report/build.py`, con sus afirmaciones
      en `claims.toml`.
- [x] **4 · Reencuadrar el Traductor** (discutido el 1 de octubre). Ofrecía tres lanzadores del
      dataset como ejemplo, y con ellos se empalmaba con la pestaña Proyección de la Ficha. Su caso real
      es el lanzador que **no** está en el dataset (agente libre, MLB, Japón), que es el entregable 3c:
      «¿cómo perfilar un prospecto o agente libre…?».
      - Entrada principal: **subir un CSV o export de TrackMan** con las columnas del dataset,
        agregado por `AutoPitchType`. Se reutiliza el mapeo de `models/batch.py`.
      - **Un solo ejemplo**, presentado como validación: lo que proyecta para un lanzador real contra
        lo que se midió en altitud extrema.
      - Un enlace «¿ya juega en la LMB? → su Ficha».
      - Subtítulo nuevo: «Para lanzadores que no están en nuestros datos».
      - **No hacer:** búsqueda sobre todo el dataset, ni fusionarlo con la Proyección.

      ✔ Un CSV de prueba generado (nunca commiteado) llena la tabla, y su test pasa. El ejemplo
      muestra lo proyectado contra lo medido. El subtítulo dice para quién es.
      **Hecho en el #83.** El archivo lo resume `POST /api/v1/arsenals/summarize` (en Python, por
      `contracts/mapping.py`); el ejemplo es `pitcher_00069/2025`. Probado con su export real a nivel
      del mar: la recta y la curva caen en la banda, el slider no (IVB 5.4 ± 1.2 proyectado, 2.7
      medido), y eso es una pregunta para datos. Queda por decidir si los tipos con muy poca muestra
      entran a la tabla.
- [ ] **5 · Aplicar la convención del «±».** **Decidida el 1 de octubre: la banda al 95% en todas las
      pantallas** (`docs/12` §2.1). Hoy, en el Radar y la Ficha ya es la banda; en el Impuesto, el
      Simulador, el Traductor y la Proyección es un error estándar, y hay que pasarlos a la banda.
      ✔ Ninguna pantalla muestra un error estándar como «±», y la guía del Radar dice la convención.
- [ ] **6 · Cifras de los documentos sin corrida** (tabla abajo, en «Revisión de código»): se
      calculan en `evidence.py` o se quitan de los documentos.
      ✔ `grep` de cada una en `docs/` solo devuelve citas con su artefacto.
- [ ] **7 · Arreglos chicos de paridad** (`docs/10` §6): separadores del Plantel, nota dinámica del
      Despliegue, «Cuándo sirve» de la Proyección, enlace al Plan desde la pestaña Arsenal.
      ✔ Cada uno con su captura headless.
- [ ] **8 · Paquete para el jurado**, después del congelamiento:
      - documento técnico contra cifras congeladas (`docs/13`);
      - ficha ejecutiva de tres lanzadores (`docs/14`);
      - README «con sus datos en 3 comandos»;
      - un video de 3–4 minutos para no técnicos;
      - prototipo y deck al día (memoria `superestela-prototipo`).

      ✔ Todo existe, y un tercero lo sigue de punta a punta.
- [ ] **9 · Ensayo el 20 de octubre**, las tres historias de `docs/09` §5.2, con la app local.

**Para no gastar contexto:**

- Lee esta sección y la tabla de PRs. No releas el resto de `docs/` salvo que la tarea lo pida.
- Las trampas del código están en la memoria (`superestela-siguiente`, `superestela-repositorio`).
- Un PR por tarea, que apunte a `main`. Si pasa de 400 líneas, se dice en el cuerpo y se revisa por
  commit.


### Lo que se hizo del 28 de septiembre al 1 de octubre

| Qué | Dónde |
|---|---|
| **P2 Ficha** (resumen, arsenal con banda por pitch, mapa de movimiento, temporadas con hueco, «Lectura del sistema», pestaña Arsenal con contrato de ubicación) | `main`, #36–#47 |
| **P5 Plan de Desarrollo** (déficit por pitch, tres frases, reparto de uso que solo se propone si ayuda) | `main`, #49–#51 |
| **P6 Despliegue y P8 Plantel**, sobre el plantel aproximado del ADR 0008 | `main`, #52–#54 llevados por #56 |
| **P7 Proyección**: datos y dominio (`analysis/projection_evidence.py`, aplica `core.translate`) | `main`, #57 |
| P7 Proyección: la pantalla | **#58, listo para revisión** |
| Copy de prohibición de apuestas en el rail; check `pr-base.yml`; `docs/11` (lo que producto necesita de datos) | `main`, #34, #41, #35, #48 |
| Q&A con Diablos y sus consecuencias | `docs/10` §5, `docs/11` §8, `docs/reference/categorias-altitud.md` |

**Pantallas:** 7 de 8 construidas; la P3 Traductor quedó construida después, en #67–#71. **Datos:** Martín entrena modelos por
componente en MLflow, pero en `main` todavía no hay nada en `packages/models/targets`, `train.py` ni
`evaluate.py`. La puerta de A3 es hoy.

### Avance del 1 de octubre (segunda sesión): todo en PRs, nada en `main` todavía

> **Registro histórico.** Los PRs de esta sección (#58–#79) se cerraron y se consolidaron en #80, #81 y
> #82 (§0.0). Los números quedan para rastrear la historia de cada commit.

Los PRs de la web van **en cadena**: cada uno apunta a `main` y contiene al anterior. Se revisan en
este orden: #58 → #60 → #68 → #69 → #70 → #71 → #73 → #74 → #75 → #78 → #79. Salen de `main`: #62 →
#63 → #61 (scorer), #64 → #65 → #66 (`report/`), #67 (API), #72 (tasas) y #76 (borradores).
**Dos dependencias:** el #73 contiene al #72, y **el #67 tiene que entrar antes que el #71**; sin él,
la API rechaza el origen en altitud media. El #79 corrige lo que encontró la revisión de código
(abajo, «Revisión de código»).

| # | Tarea | PRs | Estado |
|---|---|---|---|
| 1 | Renombre híbrido | #60 (web) y este PR (docs) | ✅ en revisión |
| 2 | Aviso del plantel | #60 (texto) y este PR (ADR 0008) | ✅ en revisión |
| 3 | Fusionar el #58 | — | ⏳ falta una aprobación |
| 4 | Textos listos para la escala por entorno | #75 | ✅ en revisión. Cambian solos cuando la evidencia declare `per_environment` |
| 5 | Whiff, K y K−BB | #72 (datos y contrato), #73 (Radar y Ficha) | ✅ en revisión |
| 6 | `report/build.py` | #64 → #65 → #66 | ✅ en revisión. 22 de 28 afirmaciones con corrida |
| 7 | Entregables de texto | #76 (`docs/12` Decision Log, `docs/13` esqueleto del documento, `docs/14` ficha ejecutiva) | 🟡 borradores; se terminan contra cifras congeladas |
| 8 | README reproducible | #62 → #63 → #61 (`python -m models.score`, ADR 0009) | ✅ en revisión. Falta que alguien que no lo escribió lo corra |
| 9 | P3 Traductor | #67 (API) y #68 → #71 (web), reencuadre en #83 | ✅ en `main` (#81). Recta de `pitcher_00069`: 15.6″ ± 0.9″ y 92.9 ± 4.1, igual que el Simulador |
| — | Radar legible para no técnicos | #74 | ✅ en revisión |
| — | Pasada de paridad contra el prototipo | #78 (arreglos), `docs/10` §6 (lo que queda) | ✅ en revisión |
| 10 | `apiSource` y GET scores | — | ⬜ |
| 11 | Prototipo y deck | — | ⬜ después del congelamiento |
| 12 | Ensayo | — | ⬜ 13 de octubre |

### Revisión de código del 1 de octubre

Una revisión de todo lo de la sesión (Python, `report/`, la web y los documentos) encontró, y se
corrigió en las mismas ramas:

| Dónde | Qué estaba mal | PR |
|---|---|---|
| `models.score` | La densidad de un juego se promediaba sobre filas distintas a las del entrenamiento: el mismo pitch cambiaba hasta 4 puntos según qué más trajera el archivo | #63 |
| API, origen | La banda brincaba en el default y no era cero donde se midió el pitch; un origen de 0.05 se aceptaba | #67 |
| Tasas | Un BB% de 0 salía con banda ± 0.0 | #72 |
| `report/` | Un `\|` en una celda rompía la tabla; la precisión de una afirmación salía del `repr` de un float; «0.858» se llamaba densidad, cuando es un índice de arrastre | #64–#66 |
| Traductor | Sin el #67 todas las preguntas daban 422; un uso vacío ponía el arsenal en cero; respuestas viejas bajo filas nuevas; el rojo de las celdas no se veía | #79 |

**Cifras de los documentos sin corrida detrás.** No se pueden usar en el documento técnico hasta que un
artefacto las calcule, o se quitan:

| Cifra | Dónde aparece | Qué hacer |
|---|---|---|
| r = −0.08 (Stuff+ contra el impuesto observado) | `docs/02`, `04`, `05`, `09` | Lo mide A3; mientras tanto, no citarla |
| +0.531 (\|IVB\| contra Stuff+ perdido) | `docs/01` §8.5, `docs/13` | Calcularla en `evidence.py` o quitarla |
| 8.6 puntos menos en casa | `docs/00` | La media de las tarjetas hoy es otra: citar el artefacto, no el número |
| 40 de 286 | `docs/04` | La cohorte es de 370 tarjetas: regenerar desde `evidence.json → cohort` |
| 0.674 | un comentario de `evidence.py` | Llevarla a `evidence.json` si se va a citar |

**Para el equipo de datos** (`docs/11` §8.1): el comando que Diablos va a correr ya existe. Lo que les
toca es el modelo que contesta por él (ADR 0009).

### Checklist de producto, en orden

| # | Tarea | Hecho cuando |
|---|---|---|
| 1 | **Renombre híbrido.** «Altitud extrema» en cifras, columnas y tablas; «Harp Helú» solo en la narrativa. Una nota única lista los cinco parques. Son ~24 textos en `packages/web/src/i18n/es.ts` («Stuff+ HH», «Harp Helú»), más `docs/00`, `02`, `09` y `10`, más el deck | `grep "Harp Hel" packages/web/src/i18n/es.ts` solo devuelve textos de narrativa, y los tests pasan |
| 2 | **Aviso del plantel:** ADR 0008 y `components/deploy/RosterNotice.tsx` dicen que la aproximación mezcla lanzadores de cinco parques, y que P6 y P8 son demostrativas | El texto y el ADR lo dicen |
| 3 | **Fusionar el #58** (pantalla de P7) | `check_pendientes` marca P7 ✅ en `main` |
| 4 | **Textos listos para la escala por entorno** (`docs/11` §8.3): el Δ como «cambio de lugar» en vez de «pierde X puntos», en el Radar, la Ficha, el Plan y la Trampa | Se aplica cuando datos confirme la escala; ningún texto asume la escala vieja |
| 5 | **Whiff más visible:** whiff por swing, ponches y ponches menos bases por bolas por lanzador-temporada, calculados en `analysis/evidence.py` (descriptivo), en el Radar y la Ficha | La columna sale del artefacto y tiene su test |
| 6 | **`report/build.py`**: las tablas del documento técnico, generadas desde la evidencia | Antes del 12; `check_pendientes` ✅ |
| 7 | **Entregables de texto:** documento técnico, ficha ejecutiva, Perfil Físico Ideal, Decision Log y **«qué haríamos con más tiempo»** (Emilio dijo que cuenta) | Existen en `docs/` o `report/` |
| 8 | **Reproducibilidad para el jurado:** README con «cómo correr esto con sus datos» | Un tercero lo sigue de punta a punta |
| 9 | **P3 Traductor** (baja prioridad: la física es complemento, según el Q&A) | `check_pendientes` ✅ |
| 10 | **La web lee de la API** (`sources/apiSource.ts`) y `GET /api/v1/pitchers/{id}/scores` | `check_pendientes` ✅ |
| 11 | **Prototipo y deck:** cifras nuevas (0.638, 40 posiciones, 8 de 10), cinco parques, renombre | El artifact dice «maqueta» donde no cuadre |
| 12 | **Ensayo cronometrado** de las tres historias (`docs/09` §5.2), pensado para una audiencia no técnica | El 13 de octubre, ≤ 10 s por pregunta |

**Fuera de producto, pero bloqueante:**
- El scorer reproducible y el modelo final, del equipo de datos (`docs/11` §8.1–8.2).
- **Correo a Diablos:** confirmar la escala con el ejemplo de `docs/11` §8.3, y preguntar si la demo
  puede ser local.

**Cómo se trabaja:**
- **PRs:** el de arriba apunta a `main` y contiene al de abajo, nunca sobre la rama del anterior
  (`CONVENTIONS.md` §6.3).
- **Verificación:** lo fusionado se comprueba con `git ls-tree origin/main <ruta>`, no con la etiqueta
  MERGED.

---

## 1. Dónde estamos, al 23 de septiembre

| | |
|---|---|
| Repositorio | `main` protegida del todo: CI verde obligatorio, **1 revisión requerida**, `enforce_admins`, checks `python` y `web` |
| Evidencia | `analysis/evidence.py` reproduce todo en ~3 min. 370 tarjetas, 296 lanzadores |
| Contratos | Ejecutables, y desde el 21 de septiembre **validados en CI** (`contracts.yml`) |
| Aplicación | `packages/web/` existe. **P1 (Radar) completa y a paridad con el prototipo** |
| Pruebas | 58 en Python, 38 en la web |
| Modelo final | **No existe.** Todo corre sobre `stuff_plus_v0`, `oof_r2 = 0.0028` |

### Lo que hay que mirar de frente

**La ruta crítica no se ha movido.** Entre el 21 y el 23 de septiembre no hubo
ni un commit en `main` ni una rama del equipo de datos. La última contribución
de alguien distinto al autor de este documento sigue siendo el PR #6. A1–A3 es
lo único que decide el resultado del reto y no ha empezado en este repositorio.

**La cadencia de `docs/07` §1.6 no se está cumpliendo.** Lunes producto publica
afirmaciones, miércoles datos entrega candidata, viernes se promueve o se
rechaza por escrito. El miércoles 23 pasó sin entrega, y `contracts.yml` —que
existe justo para recibirla— sigue sin haber validado una sola entrega real.

**La revisión obligatoria puede volverse el cuello de botella.** Se encendió el
21 de septiembre y es lo correcto, pero con `enforce_admins` activo nadie
fusiona solo. Un PR que espera dos días no es gobierno, es parálisis. Si la
cadencia de revisión no aparece esta semana, hay que decidirlo explícitamente
en un ADR, no dejarlo pasar.

---

## 2. Calendario

| Semana | Fechas | Objetivo |
|---|---|---|
| **2** (termina) | 21–24 sep | P1 completa ✅ · `contracts.yml` ✅ · A1/A2 sin arrancar 🔴 |
| **3** | 25 sep – 1 oct | **Puerta A3** · P4 Simulador · `model-eval.yml` |
| **4** | 2–8 oct | Integración: pantallas sobre scores reales · borrador del documento |
| **5** | 9–15 oct | Cerrar |

### Tres fechas que no se mueven

- **1 de octubre · puerta A3.** ¿Existe un xRV que correlacione con el run value
  observado? **Disparador:** si no lo hay, se recorta alcance de producto, no de
  validación.
- **12 de octubre · congelamiento de cifras.** A partir de ahí ningún número
  cambia.
- **13 de octubre · ensayo completo**, los 10 minutos cronometrados con la app
  en vivo.

---

## 3. Pendientes

Cada uno dice **qué es**, **por qué importa** y **cuándo está hecho**. El
criterio de hecho es lo que verifica `scripts/check_pendientes.py`.

### 3.1 Ruta crítica — equipo de datos

- [ ] **A1 · Modelos por componente agregados a xRV.** ¿Superan al ajuste
      directo del run value? La evidencia previa dice que sí: R² 0.003 directo
      contra AUC 0.64 por componente (`analysis/outputs/evidence.json`,
      `target_learnability`).
      **Hecho cuando:** existe `packages/models/targets/` y una corrida de
      MLflow con `question=A1`.

- [ ] **A2 · Pesos de run value.** ¿Linear weights clásicos, o estimados sobre
      LMB?
      **Hecho cuando:** existe `packages/models/train.py` y su corrida.

- [ ] **A3 · El puente.** ¿El xRV construido correlaciona con el run value
      observado a nivel de lanzador-temporada? **Hoy r = −0.08.**
      **Hecho cuando:** existe `packages/models/evaluate.py` y una corrida con
      la métrica `xrv_vs_observed_r` registrada.

> Los tres están en `docs/05` §3, Track A. Es el trabajo de mayor valor del
> proyecto y el único sin holgura.

### 3.2 Producto — las pantallas que faltan

El prototipo tiene el HTML, los tokens y las cifras de las ocho:
**https://claude.ai/artifact/AysYSEs8pq1Aq4baGMjpAD**

> **Antes de escribir código de una pantalla, leer su `.dc.html` del artifact y
> enumerar sus elementos.** La P1 se construyó dos veces por no hacerlo: primero
> la tabla sola, y después el rail, los filtros, dos columnas y la leyenda que
> el prototipo ya tenía.

- [x] **P1 · Radar de Fichajes** — completa, a paridad con el prototipo.
- [x] **P4 · Simulador de Pitch** — construido el 23 de septiembre, en revisión en la cadena #22–#31.
      Quedan la sesión con staff vía ISAC (P2) y el cronometraje del ensayo (P1).
      `docs/00` §5 lo llama **«entregable 4
      obligatorio»**: es lo único del carril de producto que el reglamento exige
      por nombre. Va **antes que cualquier otra pantalla**.
      Diseño, fórmulas y validación en [`docs/09`](09-SIMULADOR.md): dos capas
      —la física de `packages/core/translate.py`, que no depende de A3, y un
      **contrato de scorer** que hoy llena v0 como puente, con `se`, detrás de
      compuertas ([ADR 0007](adr/0007-contrato-del-scorer-y-escala.md))—. Entra
      desde un lanzador real, muestra los diferenciales contra su recta en los dos
      entornos, e incluye el **mapa de los pitches más y menos efectivos** que el
      reto pide y que ningún doc cubría.
      Se entrega en seis PRs encadenados, en el orden de `docs/09` §6.
      **Hecho cuando:** `packages/web/src/app/simulador/page.tsx` existe y sus
      tests pasan, y `analysis/outputs/simulator_validation.json` existe con el
      resultado de cada compuerta.

> **El plan detallado de las pantallas que faltan** —tareas, alcance, datos, código a reutilizar y
> criterios de aceptación— está en [`docs/10`](10-PANTALLAS-RESTANTES.md). Empezar por ahí.

- [ ] **P3 · Traductor de Altitud**, el diferenciador (`docs/02` §2).
      Sus datos ya están en `evidence.json` (`translator`) y su física en
      `packages/core/translate.py`. Precisión a comunicar honestamente:
      **±0.90″ a ±1.85″**, la banda física sobre el break con signo que usa
      `translate.py` (`docs/09` §3.2; el empírico sobre |HB| da ±0.85″ a ±1.45″, y
      subestimaba slider y curva).
      **Hecho cuando:** `packages/web/src/app/traductor/page.tsx` existe.

- [ ] **P2 · Ficha de Pitcher.** Es a donde apunta el Radar.
      **Hecho cuando:** `packages/web/src/app/pitchers/[pitcherId]/page.tsx`
      existe.

- [ ] **P5 a P8** — Plan de Desarrollo, Tablero de Despliegue, Proyección y
      Plantel. Degradan a mockup de alta fidelidad si falta tiempo
      (`docs/00` §10).

> Al aterrizar cada pantalla, cambiar su `null` por la ruta en
> `packages/web/src/domain/navigation.ts`: el rail se entera solo.

### 3.3 Ingeniería

- [ ] **`report/build.py`.** `docs/05` §4.3: ninguna tabla ni figura del
      documento se hace a mano, todas se generan desde MLflow, y **la matriz de
      trazabilidad falla si una afirmación queda sin corrida**. El directorio
      `report/` ni siquiera existe.
      **Tiene que existir antes del 12 de octubre, no el 12**, porque el
      documento se escribe contra cifras congeladas a partir de esa fecha.
      **Hecho cuando:** `report/build.py` existe y corre sin error.

- [ ] **`report/compare.py` y `model-eval.yml`.** Al tocar código de modelo,
      evalúa en holdout y publica la comparación contra `main` en el PR.
      **Bloqueado** hasta que exista `packages/models/evaluate.py`.
      **Hecho cuando:** `.github/workflows/model-eval.yml` existe.

- [ ] **Los tres endpoints de la API.** `CONVENTIONS.md` §5.2 los diseñó y hoy
      solo existe `/health`:
      `GET /api/v1/pitchers/{pitcherId}/scores`, `POST /api/v1/simulate`,
      `POST /api/v1/translate`.
      **`/translate` se puede hacer hoy**, sin el modelo: `packages/core/translate.py`
      es física pura. Es la ruta de menor riesgo para tener un endpoint real, y
      `docs/03` §10 lo pide explícito para el deck.
      **Hecho cuando:** los tres responden.

- [ ] **La fuente de datos de la web pasa a la API** (semana 4). Está diseñado
      para ser **un archivo nuevo en `packages/web/src/sources/` y ningún
      componente tocado**.
      **Hecho cuando:** existe `packages/web/src/sources/apiSource.ts`.

- [ ] **Accesibilidad verificada.** `docs/07` §5.3 dice «axe-core en Playwright,
      corriendo en CI, **fallando el build**. Verificada, no declarada» — pero
      §4.4 lo pone en «si sobra tiempo». **Resolver la contradicción y escribirlo.**
      **Hecho cuando:** `.github/workflows/a11y.yml` existe, o un ADR dice por
      qué no.

### 3.4 Entregables que no son código

- [ ] **Documento técnico**, 6–10 páginas. Se escribe contra cifras congeladas a
      partir del 12 de octubre, y se **selecciona**, no se vuelca (`docs/05` §5).
- [ ] **Ficha ejecutiva de 1 página** (`docs/02` §5), con una recomendación
      explícita: `Fichar` / `Fichar con reservas` / `No fichar`. No existe.
- [ ] **Entregable 2 del reto, «Perfil Físico Ideal».** Aparece **una sola vez
      en todo el repositorio**, en el mapeo de `docs/00` §9. **Decidido:** se
      cubre como **sección del documento técnico más lámina del deck**, no como
      pantalla — sale de las features que sobreviven la altitud, que es un
      hallazgo y no una herramienta. **El +0.531 de `docs/01` §8.5 no lo calcula
      ningún artefacto:** está pendiente en `report/claims.toml`. Borrador en
      `docs/13` (#76).
- [ ] **Decision Log auditable.** `docs/00` §9 lo lista dentro del 25% de
      Aplicabilidad real. No existe ni en código ni en plan.
- [ ] **Copy de cumplimiento en la app.** `docs/03` §9: la prohibición de
      apuestas va **declarada en el producto, no escondida en un pie de página**.
- [ ] Buscar si «SuperEstela» ya existe como marca en software o deporte.
- [ ] Confirmar el hex del rojo y el teal contra el manual de marca del club.
      Hoy son `#D8102F` y `#12726E`, transcritos del prototipo. Están en
      `packages/web/src/design/tokens.json` y en ningún otro sitio: confirmarlos
      es cambiar dos líneas y correr `pnpm tokens`.
- [ ] Leer el NDA de finalistas **antes** de firmarlo (`docs/04` §5.3).
- [ ] Decidir quién presenta los 10 minutos y quién responde la parte técnica.
- [x] ~~Subir las revisiones requeridas de `main` a 1~~ — hecho el 21 de
      septiembre ([ADR 0006](adr/0006-gobierno-con-el-equipo-dentro.md)).
- [x] ~~Confirmar la fecha de entrega con ISAC~~ — 22 de octubre (era el 15 hasta el 1 de octubre).

---

## 4. Anotado, y explícitamente no prioritario

Cosas que valen la pena y que **solo se hacen si sobra tiempo**.

### Mapa de diseño de lanzamiento

El uso de Stuff+ que más valoran las organizaciones: no *«¿qué pasa si muevo
esto?»* sino *«¿hacia dónde muevo?»* — un contorno sobre el plano de break.

**Por qué espera:** saldría del `stuff_plus_v0`, cuyo R² no sostiene una
recomendación direccional. **Entra cuando exista el modelo por componentes**, y
entonces es una capa sobre el Simulador, no una pantalla nueva.

**Lo que ya no espera:** el mapa de efectividad **observada** —whiff por zona de
forma, en cada entorno— entra con la P4, porque el reto lo pide y no depende del
modelo (`docs/09` §3.10). Lo que sigue esperando es el contorno *calculado por el
modelo*.

### La prueba que cierra el sesgo de slider

Correr el baseline **sin las variables de tipo de lanzamiento** y ver si el
efecto de altitud sobrevive. Media tarde del equipo de datos.

**Por qué espera:** la respuesta ya está documentada (`docs/01` §8.5) y lista si
preguntan. Convertirla en experimento la haría más fuerte, no decide el reto.

### Ángulo de brazo

Probado y descartado, para que nadie lo reabra: el proxy de slot correlaciona
−0.221 con la pérdida de IVB, pero enteramente por su correlación con el IVB
mismo (+0.388). Controlando por IVB, el coeficiente es −0.0014 y el R² gana
0.000.
