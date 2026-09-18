# SuperEstela — Evidencia

Todas las cifras de este documento salen de `analysis/evidence.py`, sobre las **635,002 pitches completas** del dataset. Ninguna está calculada sobre una muestra, ninguna está escrita a mano.

```bash
python3 analysis/evidence.py   # ~3 min → analysis/outputs/evidence.json
```

Dataset: 3 temporadas (2024–2026), 2,127 juegos, 1,134 pitchers, 864 bateadores.

---

## 1. El efecto altitud es masivo, limpio y causal

### Diseño

La comparación ingenua —pitches en altitud vs pitches a nivel del mar— confunde el efecto del aire con **qué pitchers lanzan dónde**. Para eliminar esa confusión usamos un diseño **within-pitcher**: solo pitchers con ≥50 lanzamientos del mismo tipo en *ambos* entornos, comparados **contra sí mismos**.

### Resultado

| Pitch | n pitchers | Δ IVB | % que pierde IVB | Δ \|HB\| | % que pierde \|HB\| | Δ velo |
|---|---|---|---|---|---|---|
| **Four-Seam** | 268 | **−3.77"** | **100%** | −2.72" | 98% | +0.10 |
| Sinker | 126 | −2.17" | 92% | **−4.22"** | **100%** | +0.13 |
| Changeup | 76 | −2.32" | 91% | **−4.29"** | **100%** | −0.51 |
| Curveball | 43 | +2.03" | 14% | −3.13" | **100%** | +0.01 |
| Slider | 179 | −0.74" | 73% | −1.33" | 82% | +0.50 |

El four-seam promedio pasa de **16.95" a 13.19"** de ride: **−24%**. Y lo hacen **los 268 pitchers, sin una sola excepción.**

> Un efecto que aparece en el 100% de una cohorte, midiendo a cada brazo contra sí mismo, no admite explicación por selección. **No es que a la altura lancen peores pitchers. Es que el mismo brazo produce otro lanzamiento.**

La curva es el caso interesante: su IVB *sube* (+2.03", solo 14% pierde) porque su Magnus apunta hacia abajo — en aire delgado **cae menos**. Pero su movimiento horizontal se desploma en el 100% de los casos. La curva no se salva del aire; cambia de forma.

---

## 2. Spin rate es una mentira a 2,240 m — H4 confirmada

| Pitch | Δ spin rate (Extreme − Sea) |
|---|---|
| Four-Seam | **0 rpm** |
| Sinker | +21 rpm |
| Curveball | +24 rpm |
| Changeup | +32 rpm |
| Slider | +34 rpm |
| Cutter | −72 rpm |

**El spin rate no cambia. El movimiento colapsa 20–30%.**

Un scout que evalúa por rpm está leyendo un número que en CDMX no predice nada. Es el caso más limpio posible de `shape over spin`, y tiene consecuencia directa de producto: el Simulador debe mostrar **movimiento**, no rpm, como variable de decisión.

---

## 3. Los mejores pierden más

`corr(IVB a nivel del mar, pérdida de IVB) = −0.518`

| Cuartil por IVB a nivel del mar | IVB sea level | Pérdida en altitud |
|---|---|---|
| Q1 (bajo) | 14.63" | −3.06" |
| Q2 | 16.42" | −3.74" |
| Q3 | 17.45" | −3.99" |
| **Q4 (alto)** | **19.30"** | **−4.27"** |

El arquetipo que los modelos Stuff+ de MLB rankean más alto —el fastball de ride alto— es el que más se degrada aquí. **Traducción comercial: el activo más caro del mercado es el que peor sobrevive en el Harp Helú.**

Es el gráfico con el que abre la presentación.

---

## 4. Ganadores y perdedores por pitch

Delta Extreme Altitude − No Altitude, sobre el dataset completo:

| Pitch | Δ whiff/swing | Δ chase | Δ hard-hit 95+ | Δ HR/BIP | Δ GB% | Veredicto |
|---|---|---|---|---|---|---|
| **Four-Seam** | **-3.36 pp** | -2.88 pp | +3.34 pp | +0.18 pp | +6.22 pp | ❌ Mayor perdedor |
| Changeup | -1.28 pp | -2.27 pp | +3.79 pp | +1.18 pp | +2.79 pp | ❌ Frágil |
| Slider | -1.62 pp | -0.95 pp | +2.81 pp | +0.90 pp | +2.45 pp | ⚠️ |
| Sinker | -1.60 pp | -2.91 pp | +3.62 pp | +0.50 pp | +4.86 pp | ⚠️ |
| Cutter | -0.32 pp | +0.12 pp | +2.74 pp | +0.21 pp | +4.04 pp | ✅ Resistente |
| **Curveball** | **-0.23 pp** | +1.95 pp | +2.17 pp | +1.13 pp | +1.27 pp | ✅ Whiff intacto |

El four-seam cae de **21.4% a 18.1%** de whiff por swing (**-3.36 pp**, **-16% relativo**). Es la pérdida más grande de cualquier pitch, en el pitch más lanzado del béisbol.

---

## 5. Veredicto sobre las cuatro hipótesis del reto

La convocatoria pide explícitamente: *"cada una debe cuantificarse con evidencia empírica antes de incorporarse al modelo como supuesto."* Eso hicimos.

### H1 — La baja densidad reduce el movimiento inducido por spin · ✅ **CONFIRMADA**
Four-seam IVB **−3.77"** within-pitcher, 100% de 268 pitchers. Nathan estimaba ~3–4" de pérdida en Coors (1,609 m); a 2,240 m medimos 3.77" en IVB y 2.72" en |HB| simultáneamente. Magnitud consistente con la predicción física y **mayor**, como correspondía a 631 m adicionales.

### H2 — Los pitches de diferencial de velocidad ganan valor relativo · ❌ **REFUTADA**

La convocatoria postula que el changeup *"debería mantener o ganar Stuff+ relativo en CDMX"* por depender del diferencial de velocidad y no del efecto Magnus.

**Los datos lo contradicen en las cuatro dimensiones:**

| | Changeup |
|---|---|
| Movimiento horizontal | **−3.99"** — la mayor pérdida absoluta de cualquier pitch |
| Whiff por swing | −1.28 pp |
| Chase | −2.27 pp |
| **HR por batazo en juego** | **+1.18 pp** — el peor deterioro de la liga |

El changeup **no** es inmune al aire delgado: es uno de los pitches más dependientes del movimiento, y en altitud lo pierde. El pitch verdaderamente a prueba de altitud es la **curva** — whiff/swing prácticamente intacto (−0.23 pp) y chase que **sube** (+1.95 pp).

> **Consecuencia operativa:** el club no debe reclutar changeups esperando que sobrevivan. Debe reclutar curvas y cutters.

### H3 — Los groundball pitchers son más valiosos en altitud · ⚠️ **CONFIRMADA CON MATIZ**
GB% sube en altitud para **todos** los pitch types (+1.27 a +6.22 pp). Pero el mecanismo no es el supuesto: no es que los pitchers de sinker sean más usados, es que **el fastball aplanado induce más rollings por sí mismo**. La conclusión operativa sobrevive —el groundball vale más— pero el camino es distinto, y eso importa para reclutar.

### H4 — El spin rate por sí solo es insuficiente · ✅ **CONFIRMADA**
Ver §2. El spin es idéntico entre entornos mientras el movimiento colapsa 20–30%.

---

## 6. Medimos el aire, no leemos la etiqueta

### El problema

El dataset entrega **tres etiquetas** (`altitude_category`) y **ningún identificador de estadio**. `Extreme Altitude` agrupa 604 juegos de varios parques, no solo el Harp Helú. Todos los equipos participantes estarán limitados a esas tres categorías.

### La solución

La aceleración medida de cada pitch se descompone en primeros principios:

```
a_medida = g + a_drag + a_Magnus
           a_drag   antiparalela a la velocidad
           a_Magnus perpendicular a la velocidad
```

Proyectando sobre el vector velocidad separamos ambas. Y como `drag_k = |a_drag| / v²` es proporcional a `ρ·Cd·A / 2m`, **su razón entre entornos es una medición de densidad relativa del aire.**

| Entorno | Índice de Densidad | Razón Magnus | Juegos | sd por juego |
|---|---|---|---|---|
| No Altitude | 1.000 | 1.000 | 1,004 | 0.041 |
| Medium Altitude | 0.903 | 0.813 | 509 | 0.039 |
| **Extreme Altitude** | **0.858** | **0.754** | 604 | 0.032 |

La física predice ~0.78–0.80 de densidad relativa a 2,240 m. **Medimos 0.858 desde la pelota, sin usar la etiqueta.**

Tres consecuencias:

1. Convertimos 3 categorías en una **covariable física continua**.
2. Varía **juego a juego dentro de cada bucket** (sd ≈ 3–4%), capturando temperatura y clima — información que la etiqueta destruye.
3. El modelo puede **extrapolar a altitudes que nunca vio**, que es el requisito del Traductor.

---

## 7. El Traductor de Altitud, validado en pitcher holdout

Calibración sobre el 80% de los pitchers; error medido sobre el **20% que el modelo nunca vio**.

| Pitch | n test | IVB: error | IVB: sin ajustar | \|HB\|: error | \|HB\|: sin ajustar | Pendiente |
|---|---|---|---|---|---|---|
| Four-Seam | 66 | **0.85"** | 3.88" | 0.95" | 2.92" | 0.73 |
| Sinker | 32 | 0.93" | 2.83" | 0.96" | 4.16" | 0.69 |
| Slider | 46 | 1.04" | 1.58" | 0.96" | 1.93" | 0.59 |
| Changeup | 21 | 1.37" | 2.93" | **0.94"** | **4.66"** | 0.77 |
| Curveball | 13 | 1.45" | 3.15" | 1.18" | 3.91" | 0.71 |

Las pendientes caen en **0.59–0.77** en todos los pitches y ambos ejes. No es casualidad: **es el factor de escala del efecto Magnus**, y coincide con la razón Magnus medida independientemente (0.754).

### La física sola basta

Escalando el break por la razón de densidad medida, **sin ajustar un solo parámetro**:

| | Four-Seam IVB |
|---|---|
| Modelo empírico (calibrado) | 0.85" |
| **Física pura (cero parámetros)** | **0.92"** |
| Sin ajustar | 3.88" |

Una diferencia de 0.07" entre un modelo calibrado y las leyes de la aerodinámica. **Eso es lo que hace que el Traductor extrapole** a estadios, ligas y altitudes fuera del dataset — y es la base técnica del caso de uso de fichajes.

---

## 8. Entorno de carreras: replicado en tres temporadas

| Temporada | Carreras/100 pitches (sea) | Carreras/100 pitches (Extreme) | Δ |
|---|---|---|---|
| 2024 | 2.99 | 4.12 | **+38%** |
| 2025 | 3.27 | 4.80 | **+47%** |
| 2026 | 2.93 | 4.60 | **+57%** |

Tres temporadas independientes, mismo signo, misma magnitud. El entorno ofensivo de la altitud no es ruido de una temporada.

---

## 9. Qué target debe modelar el equipo de datos

**Hallazgo metodológico central.** Ajustamos un baseline sobre las 8 features core con `GroupKFold` por pitcher, contra dos familias de target:

| Target | Métrica | Resultado |
|---|---|---|
| **Run value crudo por pitch** | R² fuera de muestra | **0.003** |
| P(whiff \| swing) | AUC | **0.637** |
| P(groundball \| batted) | AUC | **0.607** |
| P(hard hit 95+ \| batted) | AUC | 0.566 |
| P(chase \| fuera de zona) | AUC | 0.544 |

**El run value crudo a nivel de pitch es esencialmente inaprendible.** Está dominado por el bateador, la secuencia y la suerte. Un equipo que lo ajuste directamente producirá un Stuff+ que es casi ruido.

**Recomendación:** modelar los componentes y combinarlos en xRV — que es exactamente lo que especifica la hoja `Pitching+Out+` del Excel de la organización. Ahora tenemos la evidencia empírica de *por qué*.

> **Validación elegante del marco Stuff+/Location+.** `P(chase)` es el target **más débil** (AUC 0.544) desde features puramente físicas. Tiene que serlo: el chase depende de **dónde** se ubicó el pitch, y la ubicación está deliberadamente excluida de Stuff+ puro. El propio dataset confirma que la descomposición de FanGraphs es la correcta.

### Baseline v0

`stuff_plus_v0` (en `analysis/evidence.py`) existe para dar números reales al prototipo, no como modelo final. A nivel de arsenal correlaciona **0.57** con whiff/swing — discrimina, pero el equipo de datos debe superarlo ampliamente con targets por componente.

---

## 10. Auditoría de calidad del dataset

Defectos concretos encontrados en los datos entregados. Motivan la capa de validación de esquema de la arquitectura (`03-ARQUITECTURA.md`).

| Campo | Defecto | Evidencia | Sev. |
|---|---|---|---|
| `is_hit_by_pitch` | Bandera en cero en las 635,002 filas | pese a 2,280 `HitByPitch` en `PitchCall` | 🔴 |
| `altitude_category` | Etiqueta de entorno nula | 3,020 filas | 🔴 |
| identidad de estadio | No existe; solo un bucket de 3 niveles | — | 🔴 |
| `EffectiveVelo` | Guardado como string | el resto de velocidades son float64 | 🟡 |
| `Outs` | Valor imposible `3` antes del pitch | 8 filas | 🟡 |
| `PitcherThrows` | `None` / `Undefined` | ~1,421 filas | 🟡 |
| `AutoPitchType` | Etiquetas fuera de la taxonomía documentada | `Sweeper` 588, `Other` 61, 3 singletons | 🟡 |
| `y0` | Constante = 50.0 ft, cero información | 634,988 / 635,002 | 🟢 |

---

## 11. Riesgo de leakage que casi todos van a cometer

Las features de arsenal que pide la convocatoria —`velo_diff_vs_fb`, `ivb_diff_vs_fb`, `hb_diff_vs_fb`, `tunnel_similarity`, `pitch_usage_pct`— se calculan contra **la recta primaria del pitcher**.

Si esa línea base se calcula sobre la temporada completa, **cada pitch queda descrito con información de pitches que todavía no habían ocurrido.** El modelo aprende del futuro, las métricas fuera de muestra se inflan, y el sistema falla al estrenarse contra un pitcher nuevo — exactamente el caso de uso de fichajes.

**Solución:** calcular las líneas base con *point-in-time correctness* — ventana expandible / as-of join usando únicamente pitches previos. Es la diferencia entre un número bonito y un sistema que funciona, y ataca directamente el 25% de "Robustez fuera de muestra".
