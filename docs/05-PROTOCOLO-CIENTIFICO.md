# SuperEstela — Protocolo científico

> **Premisa que ordena este documento:** lo que existe hoy es un **baseline v0 hecho en una sesión**. No es el modelo, no es la evidencia final, y ninguna cifra de aquí debe presentarse como conclusión establecida.
>
> Lo que sigue es un **programa de investigación**: preguntas abiertas, experimentos por correr, y la mecánica con la que MLflow convierte ese trabajo en tablas, gráficas y secciones del documento técnico.
>
> El documento de 6–10 páginas no es el punto de partida. Es lo que **se selecciona al final** de un registro de experimentos mucho más grande.

---

## 1. Cómo se relacionan las tres capas

```
   REGISTRO DE EXPERIMENTOS          →   EVIDENCIA          →   ENTREGABLES
   MLflow · decenas de corridas          tablas y figuras       documento 6–10 pp
   cada una con hipótesis,               generadas del          deck · producto
   parámetros y métricas                 registro, no a mano
```

**Regla que sostiene todo:** ninguna tabla ni figura del documento se hace a mano. Todas se generan desde el registro de MLflow con `report/build.py`. Si una cifra no tiene corrida que la respalde, no entra — ni al documento, ni al deck, ni a una pantalla.

Esto no es burocracia: es lo que permite que el documento se reescriba en minutos cuando el modelo mejore la semana antes de entregar.

---

## 2. Estado real de lo que hay hoy

Separado sin ambigüedad, porque mezclarlo es lo que hace que un baseline se lea como resultado.

### 2.1 Medición descriptiva — sólido, no depende de ningún modelo

| Hallazgo | Estado |
|---|---|
| Efecto altitud within-pitcher, 268 lanzadores, 100% pierde ride | ✅ Firme. Es aritmética sobre datos observados |
| Spin invariante entre entornos | ✅ Firme |
| Índice de Densidad desde la trayectoria (0.858 / 0.903 / 1.000) | ✅ Firme. Derivación física, falta validación externa (Q7) |
| Deltas de outcome por tipo de lanzamiento | ✅ Firme como descripción; falta IC |
| Compensación de mira: −3.77″ de ride, −0.71″ de altura de llegada | ✅ Firme. **Hallazgo nuevo, no explotado todavía** |

### 2.2 Modelado — preliminar, todo sujeto a reemplazo

| Pieza | Estado |
|---|---|
| `stuff_plus_v0` | 🟡 **Baseline desechable.** Existe para dar números al prototipo |
| Coeficientes del Simulador y el Traductor | 🟡 Calibrados contra v0. Se reemplazan cuando exista el modelo real |
| Traductor: RMSE 0.85″–1.45″ en holdout | 🟢 Prometedor, pero con un solo split y sin IC |
| Aprendibilidad por target (AUC 0.54–0.64) | 🟡 Una arquitectura, un juego de features, una semilla |
| Puente Stuff+ → carreras | 🔴 **No existe.** r = −0.08 |

> Si alguien pregunta en la entrevista "¿qué tan bueno es su modelo?", la respuesta honesta hoy es: *"el baseline sirve para demostrar el producto; el modelo real está en construcción y así es como lo estamos midiendo"* — y se enseña el registro.

---

## 3. El backlog de experimentos

Cada entrada es una pregunta con una corrida asociada. `P` = prioridad.

### Track A · Diseño del target — **lo que desbloquea todo lo demás**

| # | Pregunta | P |
|---|---|---|
| A1 | ¿Modelos por componente agregados a xRV superan al ajuste directo del run value? *(evidencia previa: R² 0.003 directo vs AUC 0.64 por componente)* | **1** |
| A2 | ¿Qué pesos de run value usar al agregar? ¿Linear weights clásicos, o estimados sobre LMB? | **1** |
| A3 | ¿El xRV construido correlaciona con el run value observado a nivel de pitcher-temporada? **Este es el puente que hoy falta** | **1** |
| A4 | ¿P(out within PA) aporta sobre los componentes por lanzamiento? | 3 |

### Track B · Arquitectura

| # | Pregunta | P |
|---|---|---|
| B1 | GBM vs GAM vs Bayesiano jerárquico vs NN tabular, mismo target y mismo split | 2 |
| B2 | ¿El jerárquico mejora a lanzadores de muestra chica vía shrinkage? | 2 |
| B3 | ¿Interacciones de mano (lanzador × bateador) merecen modelo separado o feature? | 3 |
| B4 | Causal forest como capa táctica: ¿qué hubiera pasado con otro lanzamiento en este conteo? | 4 |

### Track C · Features — ablaciones

| # | Pregunta | P |
|---|---|---|
| C1 | ¿El Índice de Densidad continuo aporta sobre el bucket de 3 niveles? **Es nuestra tesis: hay que probarla, no asumirla** | **1** |
| C2 | ¿Las features de arsenal aportan, calculadas con point-in-time correctness? | **1** |
| C3 | ¿Cuánto se infla la métrica si se calculan mal (fuga de futuro)? Correr las dos y reportar la diferencia | 2 |
| C4 | ¿Los polinomios de trayectoria aportan sobre break y velocidad, o son redundantes? | 3 |
| C5 | ¿Tilt aporta sobre SpinAxis? | 4 |

### Track D · Física

| # | Pregunta | P |
|---|---|---|
| D1 | ¿La razón de Magnus varía por tipo de lanzamiento y por spin rate? Hoy usamos un 0.754 global | **1** |
| D2 | Estimar spin efficiency desde la trayectoria: comparar el vector Magnus observado contra el predicho por SpinAxis | 2 |
| D3 | El residuo entre movimiento observado y movimiento gyro-predicho: ¿captura efecto de costura? | 3 |
| D4 | ¿El Índice de Densidad por juego correlaciona con temperatura y presión externas? **Validación externa del índice** | 2 |

### Track E · Altitud

| # | Pregunta | P |
|---|---|---|
| E1 | Cuantificar la compensación de mira por lanzador. ¿Quién compensa mejor? ¿Es entrenable? | **1** |
| E2 | ¿El efecto altitud tiene pendientes aleatorias por lanzador? ¿Quién se adapta? | 2 |
| E3 | Batted ball: carry y HR/FB por entorno, con velocidad de salida y ángulo controlados | 2 |
| E4 | ¿Interactúa la altitud con el paso por la orden de bateo? | 4 |
| E5 | ¿El efecto de altitud difiere por **rol**? Un abridor pasa tres veces por la orden y un relevista una; si el impuesto difiere, el tablero de despliegue cambia. El Contrato B entrega `role` y `median_entry_inning` | 2 |
| E6 | ¿El Stuff+ de una temporada predice el de la siguiente, y cuánto se degrada con un año de hueco? Medido en forma cruda da 0.78–0.83 consecutivas contra 0.674 con hueco; falta hacerlo sobre el score | 2 |

### Track F · Validación

| # | Pregunta | P |
|---|---|---|
| F1 | Curvas de calibración por entorno, no solo discriminación | **1** |
| F2 | Cobertura de las bandas: ¿el 95% cae dentro del 95%? | **1** |
| F3 | Estabilidad: ¿Stuff+ HH de una temporada predice outcome de la siguiente mejor que el outcome observado? **Es el argumento de por qué usar Stuff+** | 2 |
| F4 | El Traductor con validación repetida y IC, no un solo split | 2 |
| F5 | Sensibilidad a la semilla en todo lo anterior | 3 |

---

## 4. Cómo se estructura MLflow

### 4.1 Taxonomía de experimentos

```
superestela/A-target/<pregunta>
superestela/B-arquitectura/<pregunta>
superestela/C-features/<pregunta>
superestela/D-fisica/<pregunta>
superestela/E-altitud/<pregunta>
superestela/F-validacion/<pregunta>
```

### 4.2 Lo que cada corrida registra, sin excepción

```python
mlflow.set_tags(
    {
        "question": "A1",  # entrada del backlog
        "hypothesis": "H4",  # H1-H4 de la convocatoria, o "propia"
        "report_section": "4-modelado",  # a qué sección del documento alimenta
        "product_claim": "stuff-plus-significa-algo",  # qué afirmación del producto sostiene
        "status": "candidate",  # exploratory | candidate | confirmed | rejected
        "dataset_hash": "<sha del parquet>",
    }
)

mlflow.log_params(
    {
        "target",
        "architecture",
        "feature_set_id",
        "cv_scheme",  # group_pitcher | season_holdout | park_holdout
        "pit_correct",  # True/False: point-in-time en features de arsenal
        "seed",
    }
)

mlflow.log_metrics(
    {
        # discriminación
        "auc_whiff",
        "auc_chase",
        "auc_gb",
        "auc_hardhit",
        # calibración — no basta con discriminar
        "calib_slope",
        "calib_intercept",
        "brier",
        # el puente al negocio
        "xrv_vs_observed_r",
        "band_coverage_95",
        # traductor
        "trans_rmse_ivb",
        "trans_rmse_hb",
    }
)
```

**Las tres etiquetas que importan** son `report_section`, `product_claim` y `status`. Con ellas, el documento y la matriz de trazabilidad se generan solos.

### 4.3 De registro a documento

`report/build.py` consulta MLflow y emite:

1. **Tabla comparativa de arquitecturas** — todas las corridas `status=candidate` del track B, mismo split.
2. **Tabla de ablaciones** — track C, con el delta de métrica por feature retirada.
3. **Curvas de calibración** — figuras de F1, una por entorno.
4. **Tabla de veredictos de hipótesis** — H1–H4 más las propias, con la corrida que las sostiene.
5. **Matriz de trazabilidad** — afirmación del producto → corrida → sección. **Si una afirmación queda sin corrida, el script falla.**

Ese último punto es el control de calidad de todo el proyecto.

### 4.4 Disciplina mínima

- Una pregunta del backlog por experimento. Nada de corridas sueltas sin `question`.
- `status` se actualiza cuando se decide, no al correr.
- Lo que sale **rechazado se conserva**: la sección de ablaciones vive de los rechazos, y una hipótesis refutada con evidencia vale más que una confirmada sin ella.
- Semilla y hash del dataset siempre. Sin eso no hay reproducibilidad que defender.

---

## 5. El documento como selección, no como volcado

El límite de 6–10 páginas obliga a elegir. Criterio, en orden:

1. **Lo que ningún otro equipo va a tener.** El Índice de Densidad, el Traductor, el diseño within-pitcher, la compensación de mira.
2. **Lo que la convocatoria pide explícitamente.** Escala formal, validación en tres ejes, veredicto de H1–H4.
3. **Lo que sostiene una afirmación del producto.** Ver la matriz de trazabilidad.
4. **Lo que quede.** Va a un apéndice o al repositorio.

Estructura tentativa, que se ajusta según lo que el registro produzca:

| § | Contenido | pp |
|---|---|---|
| 1 | Marco teórico: sabermetría, física, entorno LMB | 1 |
| 2 | Datos, auditoría de calidad, y el diseño within-pitcher | 1 |
| 3 | **Índice de Densidad: derivación y validación** | 1 |
| 4 | Modelado: target, arquitectura, ablaciones *(tablas de MLflow)* | 2 |
| 5 | **Escala Stuff+: definición formal y calibración** | 1 |
| 6 | **Veredicto de hipótesis, con H2 refutada** | 1 |
| 7 | Validación: pitcher / season / park, con calibración | 1.5 |
| 8 | **El Traductor de Altitud** | 1 |
| 9 | Fronteras declaradas | 0.5 |

Las cuatro en negrita son las que nos separan. Si hay que recortar, se recorta de las demás.

---

## 6. Lo que producto le pide a datos, en orden

1. **A1–A3 primero.** Sin el puente Stuff+ → carreras, el caso económico se apoya en una correlación de r = −0.08. Es el trabajo de mayor valor del proyecto.
2. **C1 y C2.** Nuestra tesis pública es que la densidad continua y el arsenal con corrección temporal importan. Hay que demostrarlo, no afirmarlo.
3. **F1 y F2.** El producto muestra una banda en cada número. Si no está calibrada, es decoración y un jurado técnico lo va a preguntar.
4. **D1.** El Traductor usa un factor de Magnus global. Si varía por tipo de lanzamiento, mejora y además es publicable.
5. **E1.** La compensación de mira es un hallazgo nuevo que todavía no está en ninguna pantalla. Si resulta entrenable, es una recomendación operativa directa para el pitching coach.
6. **El campo `role` en el Contrato B.** La regla ya está escrita en `packages/models/features/role.py` y no necesita investigación: solo hay que incluirlo en la entrega. Son **dos** valores, `starter` y `reliever` — la tercera categoría se retiró porque no la sostiene el dato (`docs/adr/0004`). Sin este campo, el tablero de despliegue compara abridores con relevistas por Stuff+ promedio, que es comparar dos oficios distintos.
7. **Una fila por lanzador y temporada.** No un promedio de su carrera: 28 lanzadores se ausentaron una temporada y volvieron, y 43 cambian de rol entre temporadas. La llave del Contrato B es `(pitcher_id, season)` (`docs/adr/0005`).

> **Sobre el Impuesto de Altitud.** A partir de esta revisión se entrega en **carreras por 9 entradas**, no por 100 lanzamientos, y `altitude_tax_significant` deja de ser informativo para volverse obligatorio: el producto suprime el número donde es falso. El contrato ejecutable en `packages/contracts/schemas.py` ya lo refleja.

---

## 7. Cómo producto vende esta ciencia

Responsabilidad nuestra, no de datos:

1. **Ficha Técnica en cada score** — contribución por feature más el mecanismo físico, en lenguaje de coach.
2. **La banda siempre visible** — un número desnudo pide fe; con su incertidumbre, pide criterio.
3. **La lámina de límites** — declarar lo que no sabemos es lo que hace creíble lo que sí.
4. **El registro abierto** — si el jurado pregunta de dónde sale una cifra, se enseña la corrida. Eso es lo que separa un proyecto de un demo.

---

## 8. Matriz de trazabilidad

Se genera desde MLflow; esta es la forma que debe tener y el estado de hoy.

| Afirmación del producto | Corrida que la sostiene | Estado |
|---|---|---|
| El efecto altitud es causal, no selección | descriptivo, within-pitcher | ✅ |
| El spin no cambia; el movimiento sí | descriptivo | ✅ |
| Los mejores pierden más | descriptivo | ✅ |
| El lanzador compensa con la mira | descriptivo | ✅ **nuevo** |
| Densidad medida desde la trayectoria | derivación física · falta D4 | 🟡 |
| El Traductor proyecta forma entre entornos | pendiente F4 | 🟡 |
| Stuff+ HH significa algo | pendiente A1–A3, F1–F2 | 🔴 |
| Un cambio de Stuff+ vale carreras | pendiente A3 | 🔴 |
| Generaliza a lanzadores nuevos | pendiente F4–F5 | 🟡 |
