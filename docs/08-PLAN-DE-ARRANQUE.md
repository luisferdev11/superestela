# SuperEstela — Plan de arranque

> Fecha de escritura: **17 de septiembre de 2026**. Entrega: **15 de octubre**. Quedan **4 semanas exactas**.
>
> Este documento existe para que nadie tenga que volver a decidir qué sigue. Todo lo que hay aquí está respaldado por `docs/00`–`07` y por `CONVENTIONS.md`.

---

## 1. Calendario, hacia atrás desde el 15 de octubre

| Semana | Fechas | Objetivo | Hecho cuando |
|---|---|---|---|
| **1** | 17–24 sep | **Desbloquear al equipo** | Repo en pie, CI verde, contratos publicados, datos trabajando |
| **2** | 25 sep – 1 oct | **Modelo v1 y esqueleto de app** | Componentes → xRV corriendo; Radar sirviendo scores reales |
| **3** | 2–8 oct | **Integración** | Las tres pantallas nucleares sobre scores reales; borrador del documento |
| **4** | 9–15 oct | **Cerrar** | Validación final, documento, deck, y margen para lo que salga mal |

### Dos fechas que no se mueven

- **12 de octubre · congelamiento de cifras.** A partir de ahí ningún número cambia. El documento y el deck se terminan contra cifras congeladas, no contra un modelo que sigue entrenando. Sin esto, la última noche se va en actualizar tablas.
- **13 de octubre · ensayo completo.** Los 10 minutos cronometrados, con la app en vivo. Lo que falle ahí se arregla el 14.

### La ruta crítica

**A1–A3: el puente Stuff+ → carreras** (`docs/05` §3, Track A). Todo lo demás tiene holgura; esto no. Si el 1 de octubre no hay un xRV que correlacione con el run value observado, se recorta alcance de producto, no de validación.

---

## 2. Semana 1, día por día

### Sesión de setup (la siguiente, en Claude Code limpio)

Orden exacto, porque cada paso desbloquea al siguiente:

1. **`git init`, estructura de `packages/`** según `docs/07` §2.1. `data/` en `.gitignore` en el **primer** commit.
2. **`packages/contracts/`** — los esquemas Pandera de `docs/07` §1.1 y §1.2, con fixtures que pasan y que fallan. *Esto es lo que desbloquea al equipo de datos: publicarlo antes que nada.*
3. **`packages/core/`** — extraer de `analysis/evidence.py` la capa de física: `density_index()` y `translate()`, como funciones puras con tests de propiedades. Es la frontera de IP (`docs/04` §5.1); nace limpia o no nace.
4. **`pre-commit`** — ruff, mypy, commitlint, gitleaks, y el hook que rechaza `.parquet`/`.csv`/`.xlsx`.
5. **`.github/workflows/ci.yml`** — el de `docs/07` §4.1.
6. **`Dockerfile` + `docker-compose.yml`** — app, Postgres, MLflow. Sin esto el compañero de Windows pierde horas.
7. **`CONVENTIONS.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`** — ya escritos, solo se mueven al repo nuevo.
8. **Invitar al equipo**, ramas protegidas, `CODEOWNERS`.

### El resto de la semana

| Quién | Qué |
|---|---|
| **Datos** | MLflow en pie con la taxonomía de `docs/05` §4; correr A1 (componentes vs run value directo) |
| **Producto** | Scaffold de Next.js, tokens desde el sistema de marca, el componente `<Metric>` |
| **Ambos** | Primer PR de cada uno, para probar que CI y revisión funcionan de verdad |

---

## 3. Lo que el equipo de datos recibe el día uno

No una conversación: **artefactos**.

1. **`docs/05-PROTOCOLO-CIENTIFICO.md`** — su backlog de 26 preguntas con prioridad, y la estructura de MLflow.
2. **`packages/contracts/`** — el esquema exacto de lo que deben entregar, ejecutable.
3. **`docs/07` §1** — los cinco contratos y la cadencia lunes/miércoles/viernes.
4. **`CONVENTIONS.md`** — cómo se escribe el código, sin importar qué agente usen.
5. **`analysis/evidence.py`** — el baseline v0 con todos los hallazgos reproducibles en 3 minutos.

### Las tres reglas que hay que decirles en voz alta

1. **No ajusten run value crudo.** R² 0.003. Componentes → xRV. Está medido, no es opinión.
2. **Features de arsenal con corrección temporal.** Calculadas sobre la temporada completa filtran el futuro y fallan justo contra un lanzador nuevo — que es el caso de uso de fichajes.
3. **`stuff_plus_se` es obligatorio.** El producto muestra banda en cada número; un score sin error estándar es una entrega rechazada.

---

## 4. Riesgos, con su disparador

| Riesgo | Se activa si | Qué hacemos |
|---|---|---|
| El puente a carreras no cierra | 1 oct sin xRV correlacionado | El caso económico se apoya solo en el impuesto **observado**. La lámina 11 ya lo declara; no se inventa la conversión |
| El modelo final no llega | 8 oct sin scores en producción | El baseline v0 sirve al prototipo. Se dice que es baseline, como ya se dice |
| Alcance de producto | 8 oct con menos de 3 pantallas vivas | Radar, Ficha y Simulador son obligatorias. Las otras tres bajan a mockup |
| Alguien se satura | Cualquier momento | Son 4 semanas con clases. Mejor recortar el 1 de octubre que el 14 |

---

## 5. Qué pedirle a la siguiente sesión

> Vamos a montar el repositorio de SuperEstela. Lee `CONVENTIONS.md`, `docs/07-INGENIERIA-Y-EQUIPO.md` y `docs/08-PLAN-DE-ARRANQUE.md`, y ejecuta los ocho pasos de la sesión de setup en orden. Empieza por `git init` y la estructura de `packages/`, y no avances al siguiente paso hasta que el anterior tenga su test o su verificación.

---

## 6. Pendientes que no son de código

- [ ] **Buscar si "SuperEstela" ya existe** como marca en software o deporte. Media hora ahora; un problema incómodo en noviembre.
- [ ] Confirmar el hex exacto del rojo y el teal contra el manual de marca del club.
- [ ] Leer el NDA de finalistas **antes de firmarlo**, en la parte de propiedad intelectual (`docs/04` §5.3).
- [ ] Decidir quién presenta los 10 minutos y quién responde la parte técnica.
