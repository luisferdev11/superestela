# SuperEstela — Brief de Diseño

Documento de entrada para **Claude Design**. Define marca, pantallas, componentes y el contenido real de cada una.

**Regla inviolable:** todo dato que aparezca en un mockup sale de `analysis/outputs/mockup_data.json`. Cero *lorem ipsum*, cero cifras inventadas. Si un mockup necesita un número que no existe, se calcula primero.

---

## 1. Marca

### Concepto
**SuperEstela** es la estela aerodinámica: la huella que la pelota deja en el aire. Es literalmente de donde sale el Índice de Densidad — descomponemos la aceleración medida de cada lanzamiento para leer el aire desde la propia trayectoria, no desde una etiqueta de estadio.

El nombre también es un juego con *superestrella*, y el juego hace trabajo: la superestrella es el lanzador que todo el mercado persigue —el four-seam de ride alto, el que los modelos de MLB rankean primero y el que peor sobrevive aquí. Cambiar una letra cambia la tesis: **no persigues a la estrella, lees la estela.**

Nombre corto de uso diario: **Estela**. El lockup completo se reserva para portada.

> Por qué no se llama por la altitud: los ocho equipos del reto están resolviendo el mismo problema de altura. Un nombre que la nombre describe el problema, no nuestra solución. La estela sí es nuestra: nadie más está midiendo el aire desde la pelota.

**Descriptor:** *Inteligencia de pitcheo calibrada para la altura.*

### Tono
Instrumento de precisión, no dashboard corporativo. La referencia mental es un **altímetro de cabina** o un instrumento de laboratorio: denso en datos, jerárquico, sin decoración. Un front office profesional debe sentir que esto pertenece a una sala de juntas, no a una feria de proyectos estudiantiles.

Lo que **no** es: gradientes, glassmorphism, ilustraciones deportivas genéricas, iconos de pelotita.

### Paleta

| Rol | Uso |
|---|---|
| **Rojo Diablos** | Acento primario, el equipo. Usar con disciplina: acciones, identidad, el dato más importante de la pantalla. Nunca como fondo amplio. |
| **Escala de altitud** | El gradiente conceptual del producto: de nivel del mar a 2,240 m. Es el sistema cromático que codifica entorno en toda la app. Sea level y altitud deben ser distinguibles de un vistazo y consistentes en las 6 pantallas. |
| **Neutros** | La mayor parte de la interfaz. Superficies, tablas, texto. Alto contraste, poca saturación. |
| **Semánticos** | `Resistente` / `Neutral` / `Frágil` y la bandera de Trampa. Deben leerse sin depender solo del color (accesibilidad). |

Requisito: funcionar en **tema claro y oscuro**. La presentación puede ser en proyector, sala iluminada o pantalla personal.

### Tipografía
Una familia con buen juego de pesos y **cifras tabulares obligatorias** — toda la app son tablas de números que deben alinearse. Números grandes con tracking ajustado para los KPI.

### Firma visual
El **mapa de movimiento** (break horizontal vs vertical) es el gráfico insignia. Debe ser reconocible como "de SuperEstela" y repetirse como elemento de marca en app, deck y one-pager, siempre mostrando la pareja **sea level → altitud** con la misma codificación.

---

## 2. Pantallas

### P1 · Radar de Fichajes *(pantalla de aterrizaje)*

**Pregunta:** *¿A quién deberíamos estar mirando?*

Tabla densa y ordenable, 286 pitchers reales.

| Columna | Ejemplo | Nota |
|---|---|---|
| Pitcher | `pitcher_00069` | IDs anonimizados por diseño del reto |
| Mano | Right / Left | |
| **Stuff+ HH** | 92.0 ± 0.7 | El número principal. Siempre con su banda |
| Stuff+ nivel del mar | 111.1 | La referencia engañosa |
| **Δ** | −19.1 | Codificado en la escala de altitud |
| **Impuesto de Altitud** | +3.54 ± 1.30 | Carreras/100 pitches. Marcar significancia |
| **Sello** | `Frágil` | 95 Resistente · 96 Neutral · 95 Frágil |
| **Trampa** | 🚩 | 47 de 286 |

Rangos reales: Stuff+ HH **87.8 – 107.1** · Impuesto **−5.69 a +5.67**.

Controles: filtro por mano, sello, tipo de pitch dominante; toggle **"ordenar por Stuff+ nivel del mar"** — que produce un orden visiblemente distinto. **Ese contraste es la demostración del producto en un solo clic.**

---

### P2 · Ficha de Pitcher

**Pregunta:** *¿Qué tengo enfrente y qué le pasa en la altura?*

Caso real, `pitcher_00069` — el ejemplo canónico:

- Stuff+ HH **92.0 ± 0.7** · nivel del mar **111.1** · Δ **−19.1**
- Impuesto de Altitud **+3.54 ± 1.30 carreras/100 pitches** (significativo)
- Sello **Frágil** · 🚩 **Trampa de Altitud**
- Pérdida media de IVB: **4.27"** · 540 pitches en altitud, 520 a nivel del mar

Arsenal (datos reales):

| Pitch | Uso | Velo | IVB sea → HH | \|HB\| sea → HH | Spin | Stuff+ sea → HH | Whiff |
|---|---|---|---|---|---|---|---|
| Four-Seam | 66.5% | 92.0 | 20.9" → **15.7"** | 7.9" → 5.1" | 2341 | 110.8 → **87.8** | 19.8% |
| Slider | 21.1% | 83.9 | 7.4" → 4.3" | 5.4" → 4.5" | 2269 | 104.6 → 99.8 | 27.7% |
| Curveball | 11.5% | 71.8 | −16.7" → −12.2" | 11.2" → 7.3" | 2553 | 118.4 → 101.2 | 28.6% |

Elementos: mapa de movimiento con ambos entornos superpuestos, tarjeta por pitch, y la **Ficha Técnica** desplegable — contribución por feature más la razón física en lenguaje llano.

---

### P3 · Traductor de Altitud *(el diferenciador)*

**Pregunta:** *Este pitcher nunca ha lanzado aquí. ¿Cuánto vale en el Harp Helú?*

Flujo: entra el arsenal medido en cualquier estadio (captura manual o carga de archivo) → sale la forma proyectada y el Stuff+ HH, con banda de confianza.

El estado final debe mostrar tres cosas juntas:
1. **Forma proyectada** — IVB y |HB| esperados en CDMX, por pitch.
2. **Stuff+ HH proyectado** con banda.
3. **Por qué** — el Índice de Densidad aplicado y el factor Magnus (≈0.75), visible. La física es el argumento de confianza, y debe verse.

Precisión a comunicar honestamente: **±0.85" a ±1.45"** en pitchers nunca vistos.

---

### P4 · Simulador de Pitch *(entregable obligatorio)*

**Pregunta:** *¿Y si cambio esto?*

Sliders: velocidad, IVB, |HB|, spin rate, extensión, release height/side + selector de tipo y mano.

Salida **lado a lado, siempre**: Harp Helú vs nivel del mar. Stuff+, movimiento y mapa.

> **Decisión de diseño no negociable:** el spin rate se muestra pero **no domina la jerarquía visual**. Los datos son inequívocos — el spin no cambia con la altitud mientras el movimiento colapsa 20–30%. La interfaz debe enseñar `shape over spin`, no reforzar el error.

---

### P5 · Plan de Desarrollo

**Pregunta:** *¿Qué le arreglo a este pitcher?*

Recomendaciones priorizadas y cuantificadas en Stuff+ HH **y en carreras**. Cada una con su mecanismo físico. Deriva del contraste entre el arsenal actual y los perfiles resistentes de la cohorte.

Ejemplo real del dataset: `pitcher_00566` sobrevive la altitud (Δ −5.2) apoyándose en un slider al **45.2% de uso**, mientras `pitcher_00069` colapsa (Δ −19.1) con un four-seam al **66.5%**. Ambos parten de Stuff+ 111.1 a nivel del mar.

---

### P6 · Tablero de Despliegue

**Pregunta:** *¿Quién abre en casa?*

Roster ordenado por Stuff+ HH vs Stuff+ de carretera. Vista de matchup de bullpen. Es el módulo de menor prioridad — puede quedar como mockup de alta fidelidad.

---

## 3. Componentes transversales

| Componente | Requisito |
|---|---|
| **KPI con banda** | Un número nunca aparece solo. Siempre `valor ± banda`. Es principio de producto, no adorno |
| **Toggle de entorno** | Harp Helú ⟷ nivel del mar. Mismo control, mismo lugar, en toda la app |
| **Mapa de movimiento** | El gráfico insignia. Ambos entornos, codificación constante |
| **Chip de Sello** | `Resistente` / `Neutral` / `Frágil` — legible sin depender del color |
| **Bandera de Trampa** | Alerta visual de alta prioridad |
| **Ficha Técnica** | Panel de explicación: features + física, en lenguaje de coach |
| **Barra de Índice de Densidad** | Elemento de marca. Muestra el aire medido del juego/entorno |

---

## 4. La narrativa de 10 minutos *(deck)*

Secuencia propuesta:

1. **El gancho** — 268 pitchers. 100% pierde ride. Y los mejores pierden más.
2. **Los dos pitchers** — `pitcher_00069` y `pitcher_00566`: **idéntico Stuff+ a nivel del mar (111.1)**, separados por **13.8 puntos** en CDMX. Nadie en el mercado ve esa diferencia. Nosotros sí.
3. **Por qué pasa** — la física: densidad 0.858, Magnus 0.754, medidos desde la pelota.
4. **Lo que refutamos** — H2 no se sostiene. El changeup no sobrevive; la curva sí.
5. **El producto** — las tres decisiones: fichar, desarrollar, alinear.
6. **Que esto es un sistema, no una demo** — arquitectura, gobernanza, Decision Log.
7. **El cierre** — el Impuesto de Altitud en carreras y en pesos.

---

## 5. Ficha ejecutiva (1 página)

Un pitcher, una decisión. Lo que el director deportivo se lleva de la sala.

Contenido: identidad · Stuff+ HH con banda · Impuesto de Altitud en carreras · Sello · mapa de movimiento sea/altitud · tabla de arsenal · **una recomendación explícita** (`Fichar` / `Fichar con reservas` / `No fichar`) con su justificación en dos líneas.

---

## 6. Restricciones

- **Idioma:** español; vocabulario sabermétrico en inglés (Stuff+, whiff, break, arsenal, chase). Código, esquemas y endpoints en inglés.
- **Responsive:** la app se usará en laptop en una sala. Prioridad escritorio, sin romperse en tablet.
- **Temas claro y oscuro** obligatorios.
- **Accesibilidad:** el estado nunca se codifica solo por color.
- **IDs anonimizados** — es requisito del reto, no una limitación a disimular. Mostrarlos tal cual.

---

## 7. Fuentes de datos para los mockups

```
analysis/outputs/mockup_data.json
  pitchers[]        286 cards reales con arsenal, Stuff+, impuesto, sello, trampa
  pitch_profiles{}  niveles y deltas por tipo de pitch y entorno
  density{}         índice de densidad por entorno

analysis/outputs/evidence.json
  within_pitcher{}  efecto within-pitcher por tipo de pitch
  translator{}      métricas de holdout del Traductor
  hypotheses{}      veredicto sobre H1–H4
  audit{}           defectos del dataset
```
