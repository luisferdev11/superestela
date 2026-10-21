# SuperEstela — Ingeniería, repositorio y forma de trabajo

> Decisiones técnicas, contratos entre equipos y prácticas. Escrito para que cuatro personas en cuatro semanas produzcan algo que se vea —y sea— profesional, sin ahogarse en infraestructura que no necesitan.
>
> **Criterio que ordena todo el documento:** en cada decisión, elegir lo correcto para *este* problema y **saber decir por qué no elegimos lo demás**. Frente a un jurado técnico, una decisión bien argumentada de no usar algo vale más que ese algo a medias.

---

## 1. Los contratos con el equipo de datos

Lo más urgente. Sin esto, producto y datos trabajan contra dos ideas distintas del mismo sistema y se descubre la semana de la entrega.

### 1.1 Contrato A · Scores por lanzamiento

Lo que datos entrega, producto consume. Formato parquet, validado con Pandera en CI.

| Campo | Tipo | Restricción | Nota |
|---|---|---|---|
| `PitchUID` | string | único, no nulo | Llave de unión |
| `model_version` | string | semver + hash | `1.2.0+a3f9c1` |
| `stuff_plus` | float | 40 – 160 | La escala firmada |
| `stuff_plus_se` | float | > 0 | **Obligatorio.** El producto muestra banda en cada número |
| `location_plus` | float | nullable | Nulo hasta que exista |
| `pitching_plus` | float | nullable | |
| `p_whiff` | float | 0 – 1 | |
| `p_chase` | float | 0 – 1 | |
| `p_gb` | float | 0 – 1 | |
| `p_hard_hit` | float | 0 – 1 | |
| `xrv` | float | −1 – 1.5 | Valor esperado de carrera |
| `density_index` | float | 0.70 – 1.05 | El del juego |
| `scored_at` | timestamp | UTC | |

**Criterios de aceptación.** Producto rechaza la entrega si: falta `stuff_plus_se`; hay `PitchUID` duplicados; algún valor sale de rango; la cobertura es menor al 99% de los lanzamientos con tracking válido; o no viene acompañada de su corrida de MLflow.

### 1.2 Contrato B · Agregados por pitcher y entorno

| Campo | Nota |
|---|---|
| `pitcher_id`, `season` | **Llave compuesta.** El entorno **no** va en la llave: la fila ya trae Stuff+ en los dos, o sea que es una comparación, no la observación de uno |
| `n_pitches_hh`, `n_pitches_sea` | Por entorno, no un total. Una entrega con 900 a nivel del mar y 40 en altitud no contiene ninguna comparación, y un solo conteo lo escondería |
| `role` | `starter` / `reliever`, y nada más. Nulo debajo de 5 apariciones. **Nunca `closer`** —se define por situación de salvamento y no hay marcador— ni una tercera categoría por entrada tardía (`docs/adr/0004`) |
| `median_entry_inning` | No se muestra. Es la materia prima del rol y lo que necesita la pregunta E5 del backlog |
| `stuff_plus_hh`, `stuff_plus_hh_ci95` | |
| `stuff_plus_sea`, `stuff_plus_sea_ci95` | |
| `altitude_tax_per_9`, `altitude_tax_se` | Carreras por **9 entradas**, no por 100 lanzamientos. Cota inferior: los pesos lineales no ven secuenciamiento y capturan ~65% del efecto observado |
| `altitude_tax_significant` | **Obligatorio de respetar.** Falso en 246 de 286; ahí el producto muestra *no concluyente*, no un número |
| `arsenal[]` | Por tipo: uso, velo, ivb, hb, spin, stuff_plus, whiff |

**Regla de producto:** por debajo de **50 lanzamientos en cada entorno** (100 hasta el 20 oct) no se muestra score; se muestra "muestra insuficiente". Es preferible callar que mentir con una banda enorme.

**Por qué la temporada va en la llave.** Un lanzador que estuvo en 2024, se fue en 2025 y volvió en 2026 no es un promedio: son dos mediciones. En el dataset hay **28 casos exactos** de eso. Y el hueco se paga en precisión —la forma correlaciona 0.78–0.83 entre temporadas consecutivas y **0.674** con un año de por medio—, así que mezclarlas describe a alguien que no existe. Detalle en `docs/adr/0005`.

### 1.3 Contrato C · El Traductor, como función

No es una tabla, es una función con firma declarada y versionada:

```python
def translate(
    shape: PitchShape,          # velo, ivb, hb, extension, release
    origin_density: float,      # índice medido, no etiqueta
    target_density: float = 0.858,
) -> TranslatedShape:           # forma proyectada + banda de error por eje
```

Debe venir con su error por tipo de lanzamiento, medido en **pitcher holdout**.

### 1.4 Contrato D · Toda corrida de MLflow

Sin las tres etiquetas de trazabilidad, la corrida no cuenta como evidencia: `question`, `report_section`, `product_claim`, más `status`. Detalle en `05-PROTOCOLO-CIENTIFICO.md` §4.

### 1.5 Contrato E · Model card por versión liberada

Una página junto a cada `model_version`: datos de entrenamiento, features, esquema de validación, métricas por eje de holdout, calibración, **límites conocidos**, y fecha de caducidad (cuándo hay que recalibrar).

### 1.6 Cadencia

| Cuándo | Qué |
|---|---|
| Lunes | Producto publica qué afirmaciones necesita respaldo esta semana |
| Miércoles | Datos entrega corrida candidata; producto la revisa contra los contratos |
| Viernes | Se promueve o se rechaza con motivo escrito |

**Regla de oro:** si producto muestra un número, existe una corrida que lo produce. Si no, el número sale de la pantalla. No hay excepciones y no se negocia la semana de la entrega.

---

## 2. Repositorio

### 2.1 Estructura

```
superestela/
├── packages/
│   ├── core/              FÍSICA Y MÉTODO · sin datos del reto · IP portable
│   │   ├── density.py       índice de densidad desde la trayectoria
│   │   ├── translate.py     el traductor
│   │   └── tests/           tests de propiedades físicas
│   ├── models/            ENTRENAMIENTO · toca el dataset
│   │   ├── features/        con corrección point-in-time
│   │   ├── targets/
│   │   ├── train.py
│   │   └── evaluate.py
│   ├── contracts/         ESQUEMAS PANDERA · la frontera entre equipos
│   ├── api/               FastAPI · sirve scores y el simulador
│   └── web/               Next.js
├── data/                  GITIGNORED. Nunca, bajo ninguna circunstancia
├── notebooks/             exploración; nada de aquí se importa en producción
├── docs/
├── report/                build.py genera tablas y figuras desde MLflow
└── .github/workflows/
```

**La separación `core` / `models` es deliberada y tiene motivo legal**, no solo estético: `core` se deriva de primeros principios y es IP nuestra portable; `models` toca datos licenciados solo para la competencia. Ver `04-NEGOCIO.md` §5.1. Montar esa frontera hoy cuesta una hora; reconstruirla después cuesta una negociación.

### 2.2 Higiene

- **`data/` en `.gitignore` desde el primer commit**, y un pre-commit hook que rechaza parquet, csv y xlsx en cualquier ruta. Un dataset filtrado a un repo es una violación del reglamento, no un descuido.
- Ramas: `main` protegida, PR obligatorio, una rama por tarea.
- Commits convencionales (`feat:`, `fix:`, `docs:`) — alimentan el changelog solos.
- `CODEOWNERS`: `packages/models/` lo revisa datos, `packages/web/` lo revisa producto.

### 2.3 Forma de trabajo, dimensionada a cuatro semanas

| Práctica | Cómo |
|---|---|
| Tablero | GitHub Projects. Tres columnas y ya: *por hacer, en curso, hecho* |
| Sincronización | 15 min, lunes / miércoles / viernes. Escrita si alguien no llega |
| Definición de *hecho* | Merged + CI verde + documentado + **la cifra tiene corrida que la respalda** |
| Revisión | Todo PR se revisa. No por control: es cómo se reparte el conocimiento en un equipo de cuatro |
| Decisiones | ADR corto en `docs/adr/` por decisión que cueste revertir. Cinco líneas bastan |

---

## 3. Docker: sí. Kubernetes: no.

### 3.1 Docker — y la razón es concreta

En el notebook del equipo hay rutas `c:\users\jhona\...`. **Ya tienen a alguien en Windows y a alguien en Linux.** Eso solo ya justifica contenerizar: sin eso van a perder horas en "en mi máquina sí corre" justo la semana que no las tienen.

Tres razones más:

1. **CI usa la misma imagen que local.** Lo que pasa en tu laptop pasa en el runner.
2. **Reproducibilidad del modelo.** Versión de Python, de numpy, de sklearn — fijadas. Sin eso "reproducible" es una palabra en el documento, no un hecho.
3. **Frente al jurado**, el argumento "esto no corre en nuestra laptop" deja de ser retórico.

Alcance: un `Dockerfile` por servicio (`api`, `web`) más un `docker-compose.yml` para desarrollo con Postgres y MLflow. Nada más.

### 3.2 Kubernetes — no, y por qué

Medí la carga real: **210,000 lanzamientos por temporada en 211 MB**; el scoring nocturno de la liga completa son segundos de CPU; la infraestructura completa cabe en **US$105–205 al mes**.

Kubernetes resuelve problemas que este sistema no tiene: escalado horizontal bajo carga variable, orquestación de decenas de servicios, despliegues sin interrupción a escala. Aquí traería un costo operativo que cuatro personas en cuatro semanas no pueden pagar, y se notaría: un clúster a medias se ve peor que no tenerlo.

**Qué usar en su lugar:** un contenedor en Cloud Run, Fly.io o Railway. Escala a cero, cuesta centavos, se despliega desde GitHub Actions en una línea.

**Cómo presentarlo.** En el documento técnico, una línea: *"evaluamos Kubernetes y lo descartamos: la carga es de 210k lanzamientos por temporada y el scoring son segundos de CPU. Un contenedor gestionado cubre el caso a 1/20 del costo operativo. K8s entra cuando haya multi-tenencia real con varios clubes y aislamiento por cliente."* **Eso demuestra criterio.** Un clúster innecesario demuestra lo contrario.

### 3.3 Cuándo sí entraría

Cuando haya varios clubes con aislamiento de datos por cliente, modelos versionados por inquilino y SLAs. Ahí el problema deja de ser cómputo y pasa a ser **multi-tenencia** — que es, por cierto, la forma real en que esto escala: no más datos por cliente, sino más clientes. Una liga es una liga; su volumen no crece.

---

## 4. GitHub Actions — una progresión para aprender

No seis workflows el primer día. Tres, en este orden.

### 4.1 Semana 1 · `ci.yml`

```yaml
name: CI
on: [pull_request]
jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-extras
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run mypy packages/
      - run: uv run pytest --cov=packages --cov-report=term-missing
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test
```

Lo que enseña: matrices de jobs, caché de dependencias, fallar rápido.

### 4.2 Semana 2 · `contracts.yml` — el que de verdad importa

Valida que lo que datos entrega cumple el contrato de §1, **antes** de que llegue a producto.

```yaml
name: Contratos de datos
on:
  pull_request:
    paths: ['packages/models/**', 'packages/contracts/**']
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync
      # fixture chico y anonimizado, versionado en el repo — nunca el dataset
      - run: uv run python -m contracts.validate fixtures/scores_sample.parquet
      - name: Comentar el resultado en el PR
        uses: actions/github-script@v7
        with:
          script: |
            const r = require('./contract_report.json');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner, repo: context.repo.repo,
              body: `### Contrato de datos\n\n${r.summary}`
            });
```

Lo que enseña: filtros por ruta, artefactos entre pasos, y **escribir de vuelta en el PR** — que es lo que convierte a CI en un compañero de equipo en vez de un semáforo.

### 4.3 Semana 3 · `model-eval.yml` — el que impresiona

Al tocar código de modelo, corre la evaluación en holdout y **publica la comparación contra `main` en el PR**.

```yaml
- name: Evaluar y comparar contra main
  run: |
    uv run python -m models.evaluate --split pitcher_holdout --out metrics.json
    uv run python -m report.compare --baseline main --current metrics.json --out diff.md
- uses: actions/github-script@v7   # pega diff.md como comentario
```

El PR queda así:

```
| Métrica              | main   | este PR | Δ      |
|----------------------|--------|---------|--------|
| AUC whiff            | 0.637  | 0.681   | +0.044 |
| Calibración (slope)  | 0.91   | 0.98    | +0.07  |
| xRV vs observado (r) | 0.08   | 0.31    | +0.23  |
```

Nadie fusiona un modelo peor sin darse cuenta. **Esto es MLOps de verdad, y cabe en 30 líneas de YAML.**

### 4.4 Después, si sobra tiempo

`deploy.yml` (contenedor a Cloud Run al fusionar a `main`), `docs.yml` (regenerar tablas del reporte desde MLflow), `a11y.yml` (axe sobre las pantallas).

### 4.5 Detalles que separan un CI serio de uno decorativo

- **Fijar versiones de las actions** (`@v4`, no `@main`).
- **Permisos mínimos**: `permissions: { contents: read, pull-requests: write }`.
- **Concurrencia**: cancelar corridas viejas del mismo PR.
- **Secretos por ambiente**, nunca en el YAML.
- **CI verde obligatorio** para fusionar. Si se puede saltar, no es CI.

---

## 5. Frontend

### 5.1 Stack recomendado

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Estándar profesional; server components dejan el cómputo fuera del navegador |
| Estilos | **Tailwind + tokens propios** | Los tokens salen del sistema de marca, no de la paleta por defecto |
| Componentes | **shadcn/ui** | Se copia al repo y se modifica; no es una dependencia que imponga su estética |
| Estado de servidor | **TanStack Query** | Caché, reintentos y estados de carga resueltos |
| Validación | **Zod** en la frontera de la API | El contrato de §1 se verifica **en runtime**, no solo en tipos |
| Gráficas | **SVG a mano + `d3-scale`** | Ya lo hicimos así en el prototipo y es lo correcto: el mapa de movimiento y el de calor son visualizaciones propias, no gráficas de catálogo. Una librería de charts estorbaría |
| Tests | **Vitest + Testing Library + Playwright** | Unitarios, de componente, y un par de flujos end-to-end |

### 5.2 Prácticas específicas de un producto de datos

Esto es lo que separa un dashboard bonito de una herramienta creíble:

1. **Cifras tabulares en todas partes.** `font-variant-numeric: tabular-nums`. Sin esto las columnas bailan y se ve amateur.
2. **Todo número lleva su incertidumbre.** Ya es regla de producto; en código, un componente `<Metric value se />` que **no permite** renderizar un valor sin su banda.
3. **Los cuatro estados de cada vista de datos**: cargando, vacío, error, y *muestra insuficiente*. El cuarto es propio de este producto y es donde casi todos los prototipos se caen.
4. **Gráficas accesibles.** `role="img"` con `aria-label` que contenga los números reales, y una tabla equivalente detrás de un `<details>`. Un lector de pantalla debe poder leer el hallazgo.
5. **Nada de cómputo pesado en el cliente.** El scoring vive en la API. El navegador dibuja.
6. **Los tokens de diseño son una sola fuente.** Un `tokens.json` que genera las variables CSS y alimenta también el canvas de diseño. Si el rojo cambia, cambia en un lugar.

### 5.3 Accesibilidad, verificada y no prometida

Ya la aplicamos en el prototipo —botones y labels reales, contraste 4.5:1, estado que no depende solo del color. Para que no se degrade: `axe-core` en Playwright, corriendo en CI, fallando el build. **Verificada, no declarada.**

---

## 6. Cómo escala esto de verdad

Vale la pena tenerlo claro para no optimizar lo que no toca.

| Dimensión | ¿Crece? | Implicación |
|---|---|---|
| Lanzamientos por liga | **No.** Una temporada es una temporada | No hace falta streaming, ni sharding, ni columnar a escala |
| Número de clubes | **Sí, es el eje real** | Multi-tenencia: aislamiento de datos, modelo por inquilino, permisos |
| Ligas / países | Sí, despacio | El Índice de Densidad ya generaliza; el modelo se recalibra por liga |
| Usuarios por club | No. Son 3 a 6 | Nada de arquitecturas para alta concurrencia |

**Conclusión:** la inversión de escalabilidad que sí paga es **multi-tenencia y aislamiento**, no throughput. Diseñar hoy el esquema con `tenant_id` en todas las tablas cuesta nada; agregarlo después es una migración fea.

---

## 7. Las cinco decisiones, en una línea cada una

1. **Docker sí**, porque ya tienen Windows y Linux en el equipo y la reproducibilidad del modelo depende de ello.
2. **Kubernetes no**, porque la carga son segundos de CPU al día; decirlo con el número es lo que demuestra criterio.
3. **CI en tres pasos**: calidad → contratos de datos → evaluación de modelo comentada en el PR.
4. **Repo partido en `core` y `models`** desde el primer commit, por la frontera de IP.
5. **Frontend Next + Tailwind + SVG propio**, con un componente de métrica que no deja publicar un número sin su banda.
