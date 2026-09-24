# SuperEstela — El Simulador de Pitch: fundamento científico

> **Qué es este documento.** El soporte científico del entregable 4 del reto: qué exige, qué física
> y qué modelo lo sostienen, con qué fórmulas, cómo se valida, y qué está hecho y qué falta.
>
> Se escribió el **23 de septiembre de 2026**, antes de construir la pantalla, y **se cierra con los
> resultados reales de las compuertas** (§6), aprueben o no. Si un número de aquí no tiene corrida, lo
> dice.
>
> Estados, como en `docs/05`: ✅ firme · 🟢 prometedor · 🟡 preliminar · 🔴 no existe o falla.

---

## 1. Qué exige el reto

Tomado de la página oficial del reto[^isac], que es la fuente. Los demás docs la parafrasean.

> **4. Dashboard Simulador**
> - El pitching coach puede ingresar las características físicas de un pitch y obtener el Stuff+ estimado
> - Comparación lado a lado: Stuff+ del mismo pitch en Harp Helú vs. estadio a nivel del mar
> - Visualización del "mapa de movimiento" de los pitches más y menos efectivos

El resto del reto condiciona cómo se cumple:

| Requisito del reto | Consecuencia para el Simulador |
|---|---|
| Stuff+ «a partir únicamente de sus propiedades físicas en el momento del release»: velocidad, IVB, HB, **spin rate, spin axis**, release height/side, extensión | Esos son los controles. La ubicación, el conteo y el bateador son de Location+ y Pitching+, no de aquí |
| **Features de arsenal**: `velo_diff_vs_fb`, `ivb_diff_vs_fb`, `hb_diff_vs_fb`, `tunnel_similarity`, `pitch_usage_pct` | El pitch se evalúa contra la recta de su lanzador. Pesa en el criterio «Integración arsenal + altitud» (25%) |
| El jurado busca la «estimación explícita del **delta Stuff+ por pitch shape** entre Harp Helú y estadios a nivel del mar» | Es literalmente la salida del Simulador, y el mapa lo muestra sobre todo el plano de forma |
| H4: «El modelo debe capturar **spin efficiency** y movimiento observado además de rpm» | El spin aparece, pero como coherencia de la forma (§3.4), no como variable de decisión |
| Escala `Stuff+ = 100 + 10 × z`; «un número por encima de 100 **siempre** significa mejor que promedio, independientemente del pitch type»; 100 = «promedio LMB ajustado por temporada y estadio» | Hoy no se cumple al pie de la letra. Ver §3.6 y el [ADR 0007](adr/0007-contrato-del-scorer-y-escala.md) |
| Aplicabilidad (25%): «Entrevista de 10 min donde el jurado evalúa si cambiarían sus decisiones» | El Simulador tiene que contestar la pregunta del coach sobre **su** pitcher, no sobre un pitch genérico |
| Calidad (25%): «Superar el baseline de modelo nulo (xRunValue promedio por conteo)» | Es la compuerta S7 (§5) |

**Lo que ningún doc nuestro cubría:** el **mapa de los pitches más y menos efectivos**. `docs/00` y
`docs/02` solo planeaban el mapa del pitch simulado.

---

## 2. Hallazgos de la revisión

### 2.1 El prototipo no se sostiene

La pantalla del prototipo en el artifact (`Simulador.dc.html`) sirvió para ver la idea. Revisada con
dureza:

| Problema | Por qué importa |
|---|---|
| El Stuff+ es una **fórmula lineal hecha a mano**: `100 + cv·(velo − bv) + ci·(ivb − bi) + ch·(|hb| − bh) + 2.0·(ext − 6.3)`. Los `ci`/`ch` se ajustaron para reproducir el Δ de v0 por tipo, y el 2.0 de extensión no sale de ninguna corrida | Rompe «ninguna cifra sin corrida» (`CONVENTIONS.md` §8.1). Un analista lo detecta en medio minuto |
| Stuff+ sin banda | Rompe «ningún score sin su incertidumbre» (§8.2) y el tipo de `MetricValue` |
| Dice «**El spin no entra en el modelo**» | Es falso: `stuff_plus_v0` usa `SpinRate` y `SpinAxis` (`analysis/evidence.py`, `STUFF_FEATURES`) |
| No tiene mano, ni altura ni lado de release, ni eje de spin | Son features del reto |
| No tiene arsenal | El reto lo exige, y así se evalúa en la industria (§2.2) |
| Parte del promedio de la liga | El coach pregunta por su pitcher: «¿y si **él** cambia esto?» |
| Acepta combinaciones que nadie lanza (22″ de IVB con 1,500 rpm) | Un modelo de árboles puntúa ahí lo que sea; es extrapolación pura[^king] |

### 2.2 Qué hace la industria, y qué tomamos

| Herramienta | Qué hace | Qué tomamos |
|---|---|---|
| FanGraphs Stuff+ (Sarris y Bay)[^fg] | Evalúa los secundarios **por su diferencia contra la recta primaria**. 10 puntos = 1 sd. Se estabiliza a unos 80 pitches | Los diferenciales, y la escala |
| Driveline Stuff+ 2024[^dl] | VAA y HAA ajustados por ubicación. «Más allá de ~96 mph la velocidad domina a la forma» | El VAA como salida |
| PitchingBot (Grove)[^pb] | Submodelos por componente (swing, whiff, contacto…) combinados en xRV; un modelo por familia de pitch | La ruta de A1 y el plan B de §5 |
| Pitch Profiler[^pp] | Separa Magnus de *seam-shifted wake*; zona muerta dinámica; comparación de pitchers | Los comparables |
| Shape+ v2[^shape] | Aviso: «las notas son impredecibles en los bordes de los datos» | El aviso fuera de distribución |
| Alan Nathan[^nathan] | Física de trayectoria, efecto de la altitud en Coors y en CDMX | La validación externa (§3.1) |

Descartamos por ahora el túnel en 3D y los grids de pares de pitches. Son capas del modelo con arsenal
(A1), no de la física.

### 2.3 El score no existe todavía

- No hay **ningún modelo que pueda puntuar un pitch hipotético**. `stuff_plus_v0` se reentrena
  dentro de la validación cruzada y solo guarda las predicciones fuera de muestra. No se serializa.
- Además, su `oof_r2 = 0.0028` (`evidence.json → stuff_plus_v0`). El modelo final (A1–A3,
  `docs/05` Track A) no ha empezado.

### 2.4 El «Índice de Densidad» no es densidad pura (🟡, hipótesis)

`docs/01` §6 dice: «La física predice ~0.78–0.80 de densidad relativa a 2,240 m. Medimos 0.858 desde
la pelota». Lo presenta como si coincidieran, y no coinciden.

| Magnitud | Extreme vs. nivel del mar | Fuente |
|---|---|---|
| Densidad física: ISA a 2,240 m, contra la atmósfera estándar | 0.802 | Cálculo, §3.1 |
| Densidad física: CDMX a 15–25 °C, contra un parque de la LMB a nivel del mar (29 °C, 75% HR) | 0.774–0.804 | Cálculo, §3.1 |
| Nathan, contra la atmósfera estándar | ~0.76 | [^nathan-mx] |
| **Razón Magnus medida** | **0.754** | `evidence.json → density` |
| **«Índice de Densidad»** = razón de `drag_k` | **0.858** | `evidence.json → density` |

- **La razón Magnus sí queda a 2–5% de la densidad física.** El índice, que sale del **arrastre**, queda
  muy por encima.
- Hipótesis: el coeficiente de arrastre de la pelota no es constante. Depende del número de Reynolds, que
  baja con el aire. Si es así, `drag_k ∝ ρ·C_d` cae menos que ρ.
- Si la hipótesis es cierta, el «Índice de Densidad» es un **índice de arrastre**: sigue siendo una
  medición física, continua y juego a juego, pero no es la densidad.
- La prueba es D4 de `docs/05`: correlacionar el índice por juego con temperatura y presión externas.

**Qué cambia para el Simulador:**
- Nada en el tramo mar → Harp Helú: `translate()` está calibrada para reproducir exactamente la razón
  Magnus medida (§3.2).
- Sí cambia la **extrapolación** a otras densidades, que usa el índice como abscisa. Medium Altitude la
  respalda (ley 0.829 contra 0.813 medido), pero es un solo punto intermedio.

### 2.5 La eficiencia de spin absoluta no es identificable con estos datos (🔴 como número)

Corrida de `evidence.py` del 23 de septiembre (`analysis/outputs/simulator.json → spin_efficiency_check`):
- Estimar la eficiencia por pitch (§3.4) da, para la **mediana de la recta a nivel del mar, entre 0.651
  y 0.894** según la densidad absoluta supuesta (1.15–1.225 kg/m³) y el ajuste de `C_L(S)` elegido
  (Sawicki o Nathan).
- Las curvas salen en ~0.3, muy por debajo de lo que publica Statcast.

**Mostrarla como un número sería precisión inventada.** El Simulador cumple H4 con una medida
**relativa y empírica** (§3.4).

---

## 3. Fórmulas

Unidades: pulgadas para el break, mph para la velocidad, pies para el release, rpm para el spin.

### 3.1 Densidad del aire (validación externa) · ✅ física de libro

Atmósfera estándar internacional (ISA), con `T₀ = 288.15 K` y gradiente `L = 0.0065 K/m`:

$$
\frac{\rho(h)}{\rho_0} = \left(1 - \frac{L h}{T_0}\right)^{\frac{g M}{R L} - 1}, \qquad \frac{gM}{RL} = 5.25588
$$

- A `h = 2,240 m`: `ρ/ρ₀ = 0.802` y `p = 77,155 Pa`.
- Para condiciones reales se usa aire húmedo:

$$
\rho = \frac{p_d M_d + p_v M_v}{R T}, \qquad p_v = HR \cdot e_s(T) \;\; \text{(Arden Buck)}
$$

Estas cuentas van en `packages/core/atmosphere.py` con sus tests. Es la compuerta F3 (§5).

### 3.2 Ley de escala del break · ✅ en mar → HH, 🟡 al extrapolar

`packages/core/translate.py`:

$$
B_{\text{destino}} = B_{\text{origen}} \cdot \left(\frac{\rho_{\text{destino}}}{\rho_{\text{origen}}}\right)^{k},
\qquad k = \frac{\ln 0.7543}{\ln 0.858} = 1.841
$$

- Aplica al IVB y al HB. `ρ` es el Índice de Densidad.
- La velocidad de salida, la altura y el lado de release no cambian: son del lanzador, no del aire.
- Con `k = 1.841` la ley reproduce **exactamente la razón Magnus medida** en Extreme.
- El modelo de libro de texto (`F_M ∝ ρ`) daría `k = 1` sobre la densidad verdadera. Que aquí salga 1.841
  es lo que §2.4 explica: el índice no es la densidad.
- **Validación**: la física no ajusta nada por lanzador, así que cada lanzador con ≥ 40 pitches del
  tipo en cada entorno está fuera de muestra. Se mide sobre el **HB con signo**, que es lo que el
  simulador mueve (`simulator.json → translation_error`):

  | Pitch | Lanzadores | IVB | HB | Antes (\|HB\|, holdout 20%) |
  |---|---|---|---|---|
  | Four-Seam | 326 | **0.92″** | 0.93″ | 0.92″ / 0.97″ |
  | Sinker | 158 | 1.14″ | 1.07″ | 1.42″ / 0.99″ |
  | Slider | 226 | 1.16″ | **1.36″** | 1.07″ / 1.06″ |
  | Changeup | 104 | 1.38″ | 1.38″ | 1.47″ / 1.36″ |
  | Curveball | 64 | 1.12″ | **1.85″** | 1.52″ / 1.41″ |
  | Cutter | 25 | 1.14″ | 0.90″ | sin banda |

- Esas RMSE son la **banda que muestra la pantalla** (`BREAK_ERROR_IN`), de **±0.90″ a ±1.85″**.
- **La compuerta F1 atrapó un error en las bandas anteriores.** Se habían medido sobre |HB| en un
  holdout del 20%, con apenas 13 curvas, y **subestimaban el HB de slider (1.06″ contra 1.36″) y de
  curva (1.41″ contra 1.85″)**. Sliders y curvas cruzan el cero en HB, y el valor absoluto dobla el
  error hacia adentro. Se corrigieron las bandas, no la compuerta.
- El «±0.85″ a ±1.45″» que citaban `docs/00` y `docs/02` es el error del modelo **empírico** sobre
  |HB|. No es la banda de la pantalla.
- **Cutter ahora tiene banda**, medida con 25 lanzadores. Es la muestra más delgada y se declara. Antes
  caía a la banda máxima porque `translator()` exige 40 lanzadores.

### 3.3 Magnus y coeficiente de sustentación · ✅ física, 🟡 los parámetros

$$
F_M = \tfrac{1}{2}\,\rho\,A\,C_L\,v^2, \qquad S = \frac{r\,\omega_T}{v}
$$

- Sawicki et al.: `C_L = 1.5 S` si `S < 0.1`; `C_L = 0.09 + 0.6 S` si no.
- Nathan: `C_L = S / (0.4 + 2.32 S)`.
- Pelota: `m = 0.1453 kg`, `r = 0.03688 m`, `A = π r²`.
- La aceleración Magnus se mide del ajuste de 9 parámetros de cada pitch (`ax0`, `ay0`, `az0` menos la
  gravedad, perpendicular a la velocidad). Es el mismo `add_physics()` que produce el índice.

### 3.4 Coherencia del spin (H4) · 🟡

- La eficiencia absoluta, `ε = ω_T / ω`, resuelve `S` desde `C_L` y compara con el spin total. Depende de
  `ρ` absoluto y del ajuste de `C_L(S)` (§2.5), así que **no se muestra como número**.
- Lo que sí se muestra es el **movimiento por rpm**, `B_total / ω`, en **percentil dentro del tipo de
  pitch**. Es empírico, invariante a los supuestos, y dice lo que H4 quiere decir: dos rectas de
  2,400 rpm con 20″ y con 14″ no son el mismo pitch.
- La **plausibilidad** es una distancia de Mahalanobis sobre las cuatro magnitudes que tienen que
  cuadrar entre sí: velocidad, IVB, HB y spin, por tipo de pitch:

$$
d^2 = (x - \mu)^\top \Sigma^{-1} (x - \mu), \qquad \text{aviso si } d^2 > q_{0.985}
$$

  - `μ` y `Σ` se estiman sobre el 95% central de los pitches a nivel del mar. Las colas traen errores
    de tracking y pitches mal etiquetados que inflarían la covarianza.
  - El umbral es el percentil 98.5 de los pitches reales, así que la tasa de falsos positivos queda
    en 1.5% por construcción.
  - **Por qué no límites por variable**: la primera versión revisaba cada magnitud por separado, y
    22″ de ride con 1,500 rpm pasaba, porque cada valor solo era normal. Con Mahalanobis da d² = 40.9
    contra un umbral de 28.6 para la recta. Una recta élite real (24″ a 2,400 rpm) da 5.8 y pasa,
    como debe[^shape].
  - Los límites por variable se conservan solo para decir **cuál** magnitud es rara.

### 3.5 VAA y velocidad al plato · 🟢 (sondeo), se formaliza en `core/trajectory.py`

Cinemática con desaceleración uniforme, desde la extensión hasta el frente del plato:

$$
L = 60.5 - \text{ext} - \tfrac{17}{12}, \quad v_f = v_0 - \Delta v_{\text{entorno}}, \quad
t = \frac{L}{\tfrac{1}{2}(v_0 + v_f)}
$$

$$
a_z = -g + \frac{2\,\text{IVB}}{t^2}, \quad
v_{z0} = \frac{(z_{\text{plato}} - z_{\text{release}}) - \tfrac{1}{2} a_z t^2}{t}, \quad
\text{VAA} = \arctan\frac{v_{z0} + a_z t}{v_f}
$$

- `Δv` es la pérdida de velocidad medida por tipo y entorno (`SpeedDrop`). La velocidad al plato es
  `v₀ − Δv`: el dataset cumple `ZoneSpeed = RelSpeed − SpeedDrop` exacto.
- **Validación (sondeo)**: con solo las entradas del Simulador, más `SpeedDrop` y la altura de llegada,
  el VAA reproduce `VertApprAngle` con **RMSE 0.079°** y sesgo −0.024°. Recta 0.045°, curva 0.144°.
- **Lo que muestra, en la recta** (medias observadas):
  - pierde 7.67 mph en el trayecto a nivel del mar y 6.35 en Extreme (`simulator.json → speed_loss`).
    Con la misma velocidad de salida, **llega ~1.3 mph más rápida** al plato. La diferencia cruda de
    `ZoneSpeed` es 1.7 mph, pero incluye que en Extreme se lanza 0.4 mph más fuerte, y eso no es del
    aire;
  - su VAA pasa de −4.95° a −5.22°, **más empinada**. La mayor parte es el ride perdido; una parte es
    que en Extreme llega 0.06 ft más baja. El Simulador fija la altura de llegada, así que muestra solo
    lo del ride.
- Es la otra mitad de la historia de la altitud: el bateador ve una recta más rápida pero más plana de
  forma y más empinada de llegada.

### 3.6 Escala Stuff+ · 🟡

$$
\text{Stuff+} = 100 - 10\cdot\frac{\widehat{xRV} - \mu}{\sigma}
$$

- El signo es negativo porque menos carreras esperadas significa mejor pitch.
- Hoy `μ` y `σ` se calculan sobre **toda la liga, ambos entornos y todos los tipos**
  (`evidence.py → stuff_plus_v0`). Por eso:
  - en altitud el promedio cae debajo de 100 «por construcción» (`docs/00` §4);
  - un slider promedio no vale 100.
- El reto dice otra cosa: «>100 siempre es mejor que promedio, **independientemente del pitch type**»,
  y 100 = «promedio LMB **ajustado por temporada y estadio**».
- La propuesta al equipo de datos (ADR 0007) es normalizar **por tipo de pitch y temporada** y
  **reportar el entorno como Δ**, no absorberlo en la media. Es su decisión en A3; el Simulador muestra
  la escala que declare el modelo.

### 3.7 Arsenal · ✅ aritmética, 🔴 en el score

- **Recta primaria**: la más usada del lanzador entre four-seam, sinker y cutter (definición de Driveline
  y FanGraphs[^dl][^fg]).
- **Diferenciales**:

$$
\Delta v = v - v_{FB}, \quad \Delta\text{IVB} = \text{IVB} - \text{IVB}_{FB}, \quad
\Delta\text{HB} = \text{HB} - \text{HB}_{FB}
$$

- **Túnel**: la distancia euclidiana entre puntos de release, `‖(h, s) − (h_FB, s_FB)‖`.
- **En los dos entornos**: los diferenciales de movimiento se multiplican por el mismo factor de §3.2, así
  que **se encogen en altura**. El changeup separado 10″ de su recta a nivel del mar queda a ~7.5″ en
  Harp Helú. Es H2 con otra cara: el engaño por velocidad sobrevive, el engaño por forma no.
- v0 **no usa** estas features. El contrato (§4) ya las recibe, para que A1 las use sin cambiar la
  pantalla.

### 3.8 Score con incertidumbre · 🟡

El puente v0 entrena **B ≈ 20 modelos sobre muestras bootstrap de lanzadores**, porque el lanzador es la
unidad de independencia, no el pitch:

$$
\widehat{\text{Stuff+}} = \frac{1}{B}\sum_b s_b(x), \qquad se = \text{sd}_b\, s_b(x)
$$

- La `se` captura la incertidumbre del modelo, no el ruido del resultado. Crece sola lejos de los datos,
  donde las bolsas discrepan.
- `is_rhb` se promedia sobre los dos lados del bateador.

### 3.9 Descomposición del Δ por altitud

$$
\underbrace{s(x_{HH}, \rho_{HH}) - s(x_{mar}, 1)}_{\Delta\ \text{total}} =
\underbrace{s(x_{HH}, 1) - s(x_{mar}, 1)}_{\text{forma}} +
\underbrace{s(x_{HH}, \rho_{HH}) - s(x_{HH}, 1)}_{\text{entorno}}
$$

- `x_HH = translate(x_mar)`.
- **Forma** es cuánto pierde el pitch por moverse menos. **Entorno** es cuánto pierde por lo que el
  modelo aprende de la altitud aparte de la forma (contacto, carry).
- Se muestran por separado porque se corrigen distinto: la forma con desarrollo, el entorno con
  despliegue.

### 3.10 Mapa de efectividad (el punto 3 del reto) · 🟢, datos observados

- Rejilla de IVB × HB por tipo de pitch y entorno.
- En cada celda, el whiff por swing observado, encogido hacia la media del tipo (empírico-bayesiano,
  beta-binomial):

$$
\widetilde{w}_c = \frac{\text{whiffs}_c + \kappa\, \bar w}{\text{swings}_c + \kappa}
$$

- `κ` se estima por momentos sobre las celdas. La celda se oculta si `swings_c` < mínimo.
- Encima: los pitcher-pitch-temporada del **10% más y menos efectivo** y el pitch simulado.
- Se usa whiff porque es el componente **más aprendible** (AUC 0.637, `evidence.json →
  target_learnability`) y el más estable entre temporadas (r = 0.556 contra 0.216 del resultado,
  `docs/01` §8.4).
- No depende del modelo. Por eso no espera a A1, a diferencia del «mapa de diseño» de `docs/08` §4, que
  sí saldría del modelo.

---

## 4. Arquitectura: dos capas, un contrato

```
 controles ──► core/translate · core/trajectory · core/arsenal · core/spin     (física, validada)
                              │ forma en cada entorno ± banda
                              ▼
               models/scoring.Scorer  (contrato)  ◄── hoy: v0 puente · mañana: A1–A3
                              │ Stuff+ ± se, o null + razón si no pasó compuertas
                              ▼
               POST /api/v1/simulate  ──►  web /simulador
```

- **La física no depende del modelo.** Si v0 no pasa sus compuertas, la pantalla sigue entregando la
  forma, el VAA, la velocidad al plato, los diferenciales, el mapa y los comparables, y el Stuff+ dice
  «modelo en validación».
- **El score es el mismo del Radar.** Un pitch no puede valer distinto en dos pantallas (compuerta S4).
- Detalle del contrato: [ADR 0007](adr/0007-contrato-del-scorer-y-escala.md).

---

## 5. Validación: los criterios de aceptación

Las compuertas son automáticas: `uv run python analysis/simulator_gates.py` entrena el puente, las corre y
escribe `analysis/outputs/simulator_validation.json` (unos 50 s).
**Cualquier modelo que entre por el contrato, incluido A3, pasa por las mismas.**

| # | Qué prueba | Por qué | Umbral |
|---|---|---|---|
| **F1** | Proyectar la forma de mar → HH y compararla con la observada, sobre el HB con signo y todos los lanzadores que califican | Es la afirmación central de la física, y la banda que se muestra | RMSE ≤ la banda de la pantalla |
| **F2** | Cobertura de la banda ±1σ | Una banda que no cubre es decorado (`docs/05` F2) | 68.3% ± 2 errores estándar binomiales para la muestra (antes: 60–76% fijo) |
| **F3** | Densidad física (§3.1) contra la razón Magnus medida | Validación externa: la física predice lo que medimos | Magnus dentro del rango físico ± 0.03 |
| **F4** | El detector de plausibilidad, sobre pitches reales y sobre casos imposibles conocidos | No debe saltar con pitches normales, y sí con los que nadie lanza | < 2% de reales marcados (1.5% por construcción) **y** 100% de los imposibles de la lista marcados |
| **F5** | VAA cinemático contra `VertApprAngle` | Que la salida de VAA sea medición, no ilustración | RMSE ≤ 0.5° (sondeo: 0.079°) |
| **S1** | Monotonía: +1 mph en la recta, con forma fija, sobre 300 rectas reales | Lo primero que prueba un coach con el slider | Δ medio > 0; violaciones ≤ 10% |
| **S2** | Espejo: un pitch zurdo reflejado contra el derecho | La mano no puede cambiar la calidad física | \|Δ\| ≤ 1 punto |
| **S3** | Suavidad: el salto por paso de slider (0.1 mph, 0.1″) | Un árbol da escalones; frente al coach parece ruido | p99 ≤ 1.5 puntos |
| **S4** | Consistencia con el Radar en pitches reales | Un pitch vale lo mismo en toda la app | r ≥ 0.9; \|Δ\| medio ≤ 3 |
| **S5** | Calibración: deciles de Stuff+ contra run value observado, holdout por pitcher | «Bien calibrados», dice el criterio del reto | Spearman ≥ 0.8 |
| **S6** | **Experimento natural**: lanzadores con el mismo pitch en ambos entornos. ¿El Δ simulado ordena el Δ whiff observado, por cuartil de forma y por tipo? | Es el contrafactual que sí observamos: el mismo brazo, otro aire | Correlación > 0, con IC al 95% |
| **S7** | Contra el baseline nulo del reto, xRunValue promedio por conteo, en holdout por pitcher | Lo pide el reto con esas palabras | RMSE menor |
| **P1** | Tres historias reales guionizadas, cada una contestada en ≤ 10 s | Principio de producto 1 (`docs/00` §6) | Ensayo cronometrado |
| **P2** | Sesión con alguien del staff vía ISAC, si se consigue | Es la pregunta literal de la entrevista | La usa sin ayuda y nombra una decisión que cambiaría |

Las tres historias:
- `pitcher_00069`: recta de 20.9″ → 15.7″ y Stuff+ 110.8 → 87.8.
- `pitcher_00566`: aguanta la altitud con un slider al 45.2%.
- Un changeup que pierde engaño porque su diferencial contra la recta se encoge.

**Regla de muestra:**
- Si falla cualquiera de **S1–S4**, el Stuff+ del modelo **no se muestra**.
- **S5–S7 se reportan tal como salgan**, en este documento y en el técnico. Se espera que v0 falle S7:
  su R² es 0.003.

### 5.1 Resultados · corrida del 23 de septiembre, modelo `0.1.0+<sha>`

**El Stuff+ del puente v0 se muestra: pasa S1–S4.** Todo lo demás se reporta tal como salió.

| # | Resultado | Valor |
|---|---|---|
| F1 | ✅ tras corregir las bandas | RMSE ≤ banda en los 12 ejes. **En la primera corrida falló**: las bandas viejas subestimaban el HB de slider y curva (§3.2) |
| F2 | ❌ por 0.002, del lado conservador | 11 de 12 ejes dentro. HB de sinker cubre 75.9% contra un máximo de 75.7%: la banda es un poco más ancha de lo necesario, no más estrecha |
| F3 | ✅ | Magnus 0.754 contra la física 0.774–0.804 (± 0.03). El índice de arrastre, 0.858, se reporta sin compuerta |
| F4 | ✅ | 1.5% de falsos positivos; los 4 casos imposibles marcados (d² de 23 a 67) |
| F5 | ✅ | VAA con RMSE de 0.083° sobre 50,000 pitches |
| S1 | ✅ | +1.79 puntos por mph; 9.3% de violaciones, **cerca del 10% del umbral** |
| S2 | ✅ | 0.0, por construcción en el marco del brazo |
| S3 | ✅ | p99 de 1.23 puntos por paso, máximo 2.86. **Un solo modelo daba p99 3.63**: el ensamble lo arregló, así que el plan B no hizo falta |
| S4 | ✅ | r = 0.951 y \|Δ\| medio de 2.47 contra el Radar, sobre 2,153 pitches de arsenal |
| S5 | ✅ | Spearman 1.0: los diez deciles ordenan el run value observado, de +0.033 a −0.010 |
| S6 | ✅, débil | r = 0.144, IC 95% [0.047, 0.230], en 521 pitcher-pitch. El Δ simulado sí ordena la pérdida de whiff real, **pero explica poco** |
| S7 | ❌ | El conteo solo (RMSE 0.21747) le gana a la física sola (0.21888). Conteo + física da 0.21732: **la física agrega algo sobre el conteo, muy poco** |

**Cómo se lee, sin adornos:**
- El puente es **coherente**: monótono, suave, simétrico, igual al Radar y bien ordenado. Por eso se
  muestra.
- **No es un buen predictor.** S7 falla y S6 es débil. Es exactamente lo que dice su R² de 0.003, y lo
  que A1 tiene que mejorar.
- La pantalla dice qué modelo contesta. El documento técnico lleva esta tabla completa.

**Dos criterios cambiaron durante la corrida, y se dice:**
- **F1** comparaba contra las bandas publicadas × 1.10. Esas bandas estaban mal medidas. Se
  re-midieron, y el criterio pasó a «la banda nunca es menor que el error».
- **F2** tenía un rango fijo de 60–76% para cualquier muestra. Con 25 cutters, el error estándar de la
  cobertura es de ±9 puntos, así que un rango fijo reprueba por azar. El JSON guarda los dos
  veredictos (`passed_fixed_60_76`).

**Riesgos que las compuertas no cierran, y se dicen:**
- **Contrafactual observacional.** El modelo aprendió de pitches lanzados, no de intervenciones. «Subir 2
  mph» es una pregunta fuera de lo que vio si ese lanzador no las tiene. La `se` y el aviso de
  plausibilidad lo acotan; no lo resuelven[^king].
- **Goodhart.** La relación Stuff+ → resultados se debilitó en MLB entre 2021 y 2025 conforme los
  lanzadores optimizaron la métrica[^decay].
- **Adaptación del bateador.** El modelo no ve cómo se ajusta el bateador local.

---

## 6. Lo hecho y lo que falta

| Pieza | Estado | Nota |
|---|---|---|
| Física mar → HH (`translate.py`) | ✅ | Holdout por pitcher, bandas por tipo |
| Extrapolación a otras densidades | 🟡 | Depende de §2.4; D4 la cierra |
| Bandas de la física | ✅ | Re-medidas sobre el HB con signo tras fallar F1; Cutter medido con 25 lanzadores y declarado |
| Densidad física / validación externa (F3) | ✅ | `core/atmosphere.py`, pasa F3 |
| VAA y velocidad al plato (F5) | ✅ | `core/trajectory.py`, 0.083° sobre 50,000 pitches |
| Coherencia del spin (F4) | 🟢 | Mahalanobis robusto por tipo (`simulator.json → plausibility`, `core/spin.py`). Falsos positivos: 1.5% por construcción. La prueba real de F4 es que marque los casos imposibles conocidos. La primera versión, por variable, no los marcaba y se descartó |
| Diferenciales de arsenal | ✅ | `core/arsenal.py`; arsenales base por lanzador en `analysis/outputs/arsenals.json` |
| Mapa de efectividad | 🟢 | `simulator.json → movement_map`: rejilla de 2″, κ empírico por tipo y entorno, 10% extremos. Falta la pantalla |
| Rangos de sliders y pérdida de velocidad | ✅ | `simulator.json → distributions`, `speed_loss` |
| Contrato del scorer | ✅ | `models/scoring.py`, ADR 0007 |
| Score v0 puente con `se` | 🟡 | `models/stuff/v0_bridge.py`. Pasa S1–S6, falla S7 (§5.1). Se muestra, declarado como puente |
| Features de arsenal **dentro** del score | 🔴 | Es A1, del equipo de datos |
| Puente Stuff+ → carreras | 🔴 | r = −0.08 (`docs/05`). **Por eso el Simulador no imprime carreras** |
| Contorno «¿hacia dónde muevo?» y SHAP | 🔴 | Después de A1, como capa del Simulador |

Esta tabla se actualiza con cada PR de la cadena. §5 se cierra con los números de
`simulator_validation.json`.

**Orden de la cadena**, semana del 24 de septiembre al 1 de octubre:
1. Este documento, el ADR 0007 y las correcciones a los docs que contradecían el reto o la evidencia.
2. Las salidas nuevas de `evidence.py`: distribuciones por tipo, mapa de efectividad, envolvente de
   plausibilidad y `SpeedDrop` por entorno.
3. `core/`: `atmosphere`, `trajectory`, `arsenal` y `spin`, con tests de propiedad.
4. `models/`: el contrato y v0 puente; `analysis/simulator_gates.py`, que produce `simulator_validation.json`.
5. `api/`: `POST /simulate` y `POST /translate`.
6. `web/`: la pantalla, y se cierra este documento con el resultado real de cada compuerta.

---

## 7. Alcance y fronteras

- **«Harp Helú» es el bucket `Extreme Altitude`.** El dataset no trae id de estadio y ese bucket agrupa
  604 juegos de varios parques (`docs/01` §6). La pantalla dice «Harp Helú» porque es la pregunta del
  club; el documento técnico dice qué mide.
- **Densidad media por entorno.** El índice varía juego a juego (sd 0.032 en Extreme). El Simulador usa
  la media; un selector de clima es trabajo posterior.
- **Stuff+ es calidad física, no resultado.** No incluye ubicación, conteo ni bateador; esos son
  Location+ y Pitching+.
- **El Simulador no recomienda.** Contesta «¿y si cambio esto?»; la pregunta «¿hacia dónde muevo?»
  necesita un modelo que sostenga una dirección, y v0 no la sostiene.

---

[^isac]: ISAC, *2026 ISAC Hackathon – Diablos Rojos: Stuff Plus Model*, https://www.isac-app.com/competition-details/hackathon-diablos-rojos.html (leída el 23 sep 2026).
[^fg]: FanGraphs, *Stuff+, Location+, and Pitching+ Primer*, https://library.fangraphs.com/pitching/stuff-location-and-pitching-primer/
[^dl]: Driveline, *Revisiting Stuff+* (2024), https://www.drivelinebaseball.com/2024/05/revisiting-stuff-plus/
[^pb]: FanGraphs, *PitchingBot Pitch Modeling Primer*, https://library.fangraphs.com/pitching/pitchingbot-pitch-modeling-primer/
[^pp]: Pitch Profiler, https://mlbpitchprofiler.com/
[^shape]: FanGraphs Community, *Shape+ v2.0*, https://community.fangraphs.com/shape-v2-0-isolating-pitch-quality-with-relative-physics-and-additive-modeling/
[^nathan]: A. Nathan, *Baseball at High Altitude*, https://baseball.physics.illinois.edu/Denver.html · *The effect of spin on the flight of a baseball*, Am. J. Phys. 76 (2008), https://baseball.physics.illinois.edu/ajpfeb08.pdf · Sawicki, Hubbard y Stronge, Am. J. Phys. 71 (2003).
[^nathan-mx]: Estimación de Nathan citada en la cobertura de la MLB Mexico City Series, https://www.cbssports.com/mlb/news/mlb-mexico-city-series-four-things-padres-d-backs/
[^king]: G. King y L. Zeng, *The Dangers of Extreme Counterfactuals*, Political Analysis 14 (2006), https://gking.harvard.edu/files/counterft.pdf
[^decay]: FanGraphs, *They Don't Make Pitch Models Like They Used To*, https://blogs.fangraphs.com/they-dont-make-pitch-models-like-they-used-to/
