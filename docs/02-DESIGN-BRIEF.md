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
| **Escala de altitud** | El gradiente conceptual del producto: de nivel del mar a 2,240 m. Es el sistema cromático que codifica entorno en toda la app. Sea level y altitud deben ser distinguibles de un vistazo y consistentes en las ocho pantallas. |
| **Neutros** | La mayor parte de la interfaz. Superficies, tablas, texto. Alto contraste, poca saturación. |
| **Semánticos** | La bandera de Trampa, el signo del Impuesto y el estado *no concluyente*. Deben leerse sin depender solo del color (accesibilidad). |

Requisito: funcionar en **tema claro y oscuro**. La presentación puede ser en proyector, sala iluminada o pantalla personal.

### Tipografía
Una familia con buen juego de pesos y **cifras tabulares obligatorias** — toda la app son tablas de números que deben alinearse. Números grandes con tracking ajustado para los KPI.

### Firma visual
El **mapa de movimiento** (break horizontal vs vertical) es el gráfico insignia. Debe ser reconocible como "de SuperEstela" y repetirse como elemento de marca en app, deck y one-pager, siempre mostrando la pareja **sea level → altitud** con la misma codificación.

---

## 2. Pantallas

### P1 · Radar de Fichajes *(pantalla de aterrizaje)*

**Pregunta:** *¿A quién deberíamos estar mirando?*

Tabla densa y ordenable, 296 lanzadores reales en su última temporada jugada.

| Columna | Ejemplo | Nota |
|---|---|---|
| Pitcher | `pitcher_00069` | IDs anonimizados por diseño del reto |
| **Temporada** | 2025 | **Su última temporada jugada.** 95 candidatos tienen 2024, 134 el 2025, 67 el 2026 — no es un pie de página |
| Mano | Right / Left | |
| **Stuff+ HH** | 92.0 ± 0.7 | El número principal. Siempre con su banda |
| Stuff+ nivel del mar | 111.1 | La referencia engañosa |
| **Δ** | −19.1 | Codificado en la escala de altitud |
| **Impuesto de Altitud** | +5.93 ± 2.18 | Carreras por 9 entradas. **Solo 35 de los 296 candidatos del Radar son significativos; los otros 261 dicen *no concluyente*, no un número.** Sobre las 370 tarjetas, 40 |
| **Rol** | `Abridor` | Dos valores, abridor o relevista. Inferido de la entrada de ingreso, y **por temporada** (`docs/adr/0004`) |
| **Trampa** | 🚩 | 58 de 370 temporadas |

Rangos reales de la cohorte: Stuff+ HH **87.9 – 109.5** · Impuesto **−10.62 a +14.40** carreras/9 entradas sobre las 370 tarjetas.

> Ninguna de estas cifras se escribe en la interfaz. La pantalla las deriva de `analysis/outputs/mockup_data.json` al renderizar y un test las compara contra `evidence.json`, que es la corrida que las respalda. Están aquí para leer el diseño, no para copiarlas al código.

Controles: filtro por mano, rol, temporada, tipo de pitch dominante; toggle **"ordenar por Stuff+ nivel del mar"** — que produce un orden visiblemente distinto. **Ese contraste es la demostración del producto en un solo clic.**

---

### P2 · Ficha de Pitcher

**Pregunta:** *¿Qué tengo enfrente y qué le pasa en la altura?*

La barra de contexto lleva un **selector de temporada** con las que el lanzador tenga, y debajo una tabla compacta con **todas sus temporadas** y su rol en cada una. Ahí es donde se ve el hueco de los 28 que se fueron y volvieron: un lanzador con 2024 y 2026 y nada en medio no es un promedio, son dos mediciones.

Caso real, `pitcher_00069` en su única temporada con score, **2025**:

- Stuff+ HH **93.3 ± 0.7** · nivel del mar **110.5 ± 0.8** · Δ **−17.2**
- Impuesto de Altitud **no concluyente** — mide +4.55 ± 2.70 carreras por 9 entradas, y con la muestra de una sola temporada la banda cruza el cero. **La pantalla muestra el estado, no el número:** es la regla funcionando
- Rol **Abridor** · 🚩 **Trampa de Altitud** · 341 pitches en altitud, 434 a nivel del mar
- Pérdida media de IVB: **4.43"**

Arsenal (datos reales):

| Pitch | Uso | Velo | IVB sea → HH | \|HB\| sea → HH | Spin | Stuff+ sea → HH | Whiff |
|---|---|---|---|---|---|---|---|
| Four-Seam | 71.3% | 92.2 | 20.7" → **15.0"** | 8.2" → 5.2" | 2353 | 111.0 → **90.4** | 18.3% |
| Slider | 18.5% | 84.1 | 7.1" → 2.7" | 5.4" → 4.4" | 2310 | 101.3 → 99.6 | 21.9% |
| Curveball | 9.4% | 72.4 | −16.6" → −13.4" | 11.3" → 8.3" | 2640 | 117.1 → 102.9 | 43.8% |

Temporada 2025, `mockup_data.json`. Una versión anterior de esta tabla (66.5% de uso, 110.8 → 87.8) era de antes de que las tarjetas fueran por temporada (ADR 0005) y no la respalda ninguna corrida vigente.

Elementos: mapa de movimiento con ambos entornos superpuestos, tarjeta por pitch, y la **Ficha Técnica** desplegable — contribución por feature más la razón física en lenguaje llano.

---

### P3 · Traductor de Altitud *(el diferenciador)*

**Pregunta:** *Este pitcher nunca ha lanzado aquí. ¿Cuánto vale en el Harp Helú?*

Flujo: entra el arsenal medido en cualquier estadio (captura manual o carga de archivo) → sale la forma proyectada y el Stuff+ HH, con banda de confianza.

El estado final debe mostrar tres cosas juntas:
1. **Forma proyectada** — IVB y |HB| esperados en CDMX, por pitch.
2. **Stuff+ HH proyectado** con banda.
3. **Por qué** — el Índice de Densidad aplicado y el factor Magnus (≈0.75), visible. La física es el argumento de confianza, y debe verse.

Precisión a comunicar honestamente, en pitchers nunca vistos: **±0.85" a ±1.45"** con el modelo empírico, **±0.90" a ±1.85"** con la física pura sobre el break con signo, que es la banda que `translate.py` pone en pantalla ([`docs/09`](09-SIMULADOR.md) §3.2). Se cita la que la pantalla muestra.

---

### P4 · Simulador de Pitch *(entregable obligatorio)*

**Pregunta:** *¿Y si mi pitcher cambia esto?*

Lo que el reto pide, literal: ingresar las características físicas de un pitch y obtener su Stuff+; el mismo pitch lado a lado en Harp Helú y a nivel del mar; y el **mapa de movimiento de los pitches más y menos efectivos**. Fundamento, fórmulas y criterios de aceptación en [`docs/09`](09-SIMULADOR.md).

**Entrada.** Dos modos: *desde un lanzador* —se elige lanzador y pitch, y su pitch real es la línea base que marca cada slider— y *laboratorio*, desde el promedio LMB del tipo. El primero es el principal: el coach pregunta por su pitcher, no por un pitch genérico.

**Controles**, agrupados por lo que deciden:
- **Forma** — velocidad, IVB, HB. Arriba y con más peso visual.
- **Release** — extensión, altura, lado.
- **Spin** — rpm y eje, en un bloque secundario, con el *movimiento por rpm* en percentil del tipo y el aviso de plausibilidad cuando la combinación no se ha lanzado en la LMB.
- Tipo de pitch y mano. Cada slider marca el valor real del lanzador y la banda p5–p95 de la liga.

**Salida, lado a lado, siempre:**
1. Stuff+ a nivel del mar y en Harp Helú, **cada uno con banda**, y el Δ partido en *forma* (cuánto pierde por moverse menos) y *entorno*. Si el modelo no pasó sus compuertas, el Stuff+ dice «modelo en validación» y el resto de la pantalla sigue.
2. La forma en cada entorno con su banda, el VAA y la velocidad al plato.
3. Los diferenciales contra la recta del lanzador **en los dos entornos**: en altura se encogen, y ahí se ve qué pitch pierde engaño.
4. El mapa de efectividad en dos paneles, mar | Harp Helú: rejilla de whiff observado por zona de forma, los pitches más y menos efectivos, el arsenal del lanzador y el pitch simulado con su flecha.
5. La procedencia: barra de Índice de Densidad, qué modelo contesta y si usa arsenal.

**No imprime carreras.** El puente Stuff+ → carreras no existe (r = −0.08); las carreras viven en el Impuesto de Altitud, que es otra medición.

> **Decisión de diseño no negociable:** el spin rate se muestra pero **no domina la jerarquía visual**. Los datos son inequívocos — el spin no cambia con la altitud mientras el movimiento colapsa 20–30%. La interfaz debe enseñar `shape over spin`, no reforzar el error. **El spin sí entra al modelo** (v0 usa `SpinRate` y `SpinAxis`, y el reto lo nombra como feature); lo que no hace es decidir: la forma decide, y el spin dice si esa forma es coherente.

---

### P5 · Plan de Desarrollo

**Pregunta:** *¿Qué le arreglo a este pitcher?*

**No son tarjetas.** Son dos o tres frases, cuantificadas, con su mecanismo físico — porque un pitching coach no consume tarjetas, escucha una razón y la repite en el bullpen. La plantilla es fija:

> *Qué se degrada* — cuál lanzamiento pierde más y cuántas pulgadas.
> *Qué aguanta* — cuál conserva su forma y por qué físicamente.
> *Qué cambia* — qué reparto de uso lo compensa, en puntos de Stuff+ HH.

**Sin carreras.** Esta plantilla pedía también carreras por 9 entradas, pero el puente Stuff+ → carreras no existe (r = −0.08, `docs/05`). La P5 imprime solo Stuff+, con su banda, y dice por qué. Cuando A3 cierre el puente, las carreras vuelven aquí. Si el pitch que aguanta rinde menos en altura que el que se degrada, pasarle uso empeora el arsenal: la pantalla lo dice en lugar de proponerlo (47 de 349 tarjetas con plan).

Deriva del contraste entre el arsenal actual y los perfiles resistentes de la cohorte.

Ejemplo real del dataset, temporada 2025: `pitcher_00566` sobrevive la altitud (Δ −4.0) apoyándose en un slider al **41.9% de uso**, mientras `pitcher_00069` colapsa (Δ −17.2) con un four-seam al **71.3%**. Los dos parten de ~111 de Stuff+ a nivel del mar (111.3 y 110.5).

---

### P6 · Tablero de Despliegue

**Pregunta:** *¿Quiénes son los mejores para el estadio donde se juega?*

Selector de entorno → el roster ordenado por Stuff+ de **ese** estadio, **agrupado por rol**: abridores y relevistas.

**No sugiere orden de pitcheo.** Esa decisión es del mánager, entra contexto que no modelamos, y automatizarla es la forma más rápida de que deje de usarse la herramienta.

El rol se infiere de la entrada en que el lanzador entra al juego — una regla medida sobre 22,569 apariciones, no un modelo: 469 lanzadores abren menos del 10% de las veces, 119 más del 90%, y el valle está en 40–50%. **Son dos categorías y nada más:** no hay "cerrador" —se define por situación de salvamento y no hay marcador— ni un tercer nivel por entrada tardía, porque la entrada de ingreso de los relevistas es unimodal con su moda justo en la séptima (`docs/adr/0004`).

Lo que justifica la pantalla: la correlación de orden entre casa y gira es **0.700**, el cambio mediano es de **38 posiciones**, y **6 de los 10 mejores en casa no están entre los 10 mejores de gira**.

---

### Lo que **no** es pantalla: el entorno de la liga

El contexto de liga —RA/9 por entorno, Índice de Densidad por estadio, el efecto replicado en tres temporadas— **vive en el documento técnico y en el deck, no en la app.** Es material que se lee una vez para entender la tesis; no es una consulta que alguien repita, y una pantalla que nadie vuelve a abrir le resta a las que sí se usan.

La excepción es la **barra de Índice de Densidad**, que se queda como componente transversal: ahí no es contexto, es la procedencia del número que se está viendo.

---

### P7 · Proyección *(por lanzador)*

**Pregunta:** *¿Cómo se vería este lanzador en el estadio de la próxima serie?*

La forma medida de **ese** lanzador, proyectada al entorno que se elija —incluida la altitud media, donde casi nadie tiene muestra suficiente para medirlo directamente—. Por lanzamiento: IVB y |HB| proyectados con su banda por eje, y el factor de densidad aplicado, visible.

Existe porque la pestaña anterior saltaba al Traductor, que es una herramienta de laboratorio con captura manual: la migaja decía un lanzador y el contenido era un formulario en blanco. Es el mismo error de alcance que tuvo Ubicación.

**Y declara su propio límite:** para un lanzador con muestra en los dos entornos la proyección es redundante —la Ficha ya trae la medición—. Esta pantalla gana cuando el destino es un entorno donde **no** ha lanzado.

---

### P8 · Plantel

**Pregunta:** *¿Qué tenemos?*

Los lanzadores del club con su Stuff+ por temporada y su rol. Es la contraparte del Radar: aquí no se evalúan candidatos, se mira lo propio. Y es la puerta natural a la Ficha para la gente del club.

Reemplaza un elemento de navegación que estaba en el rail en gris, sin pantalla detrás.

---

## 3. Componentes transversales

| Componente | Requisito |
|---|---|
| **KPI con banda** | Un número nunca aparece solo. Siempre `valor ± banda`. Es principio de producto, no adorno |
| **Toggle de entorno** | Harp Helú ⟷ nivel del mar. Mismo control, mismo lugar, en toda la app |
| **Mapa de movimiento** | El gráfico insignia. Ambos entornos, codificación constante |
| **Chip de Rol** | `Abridor` / `Relevista`. Dos, porque dos es lo que el dato separa (`docs/adr/0004`) |
| **Selector de temporada** | Donde un lanzador tiene varias. Mismo control, mismo lugar. Un lanzador con hueco muestra el hueco |
| **Bandera de Trampa** | Alerta visual de alta prioridad |
| **Estado "no concluyente"** | Para toda cifra sin significancia. Es el cuarto estado de dato, junto a cargando, vacío y error |
| **Ficha Técnica** | Panel de explicación: features + física, en lenguaje de coach |
| **Barra de Índice de Densidad** | Elemento de marca. Muestra el aire medido del juego/entorno |

---

## 4. La narrativa de 10 minutos *(deck)*

Trece láminas. El orden importa: primero el hallazgo, luego la física que lo explica, luego **por qué el método es el correcto**, y solo entonces el producto.

| # | Lámina | Qué carga |
|---|---|---|
| 01 | Portada | La tesis en una frase: no persigas a la estrella, lee la estela |
| 02 | El hallazgo | 268 lanzadores medidos contra sí mismos, 100% pierde ride, y los mejores pierden más |
| 03 | Los dos lanzadores | Mismo Stuff+ a nivel del mar en la misma temporada, 13 puntos de diferencia en CDMX |
| 04 | La física | El aire medido desde la trayectoria: densidad 0.858, Magnus 0.754 |
| 05 | H2 refutada | La convocatoria pidió cuantificar antes de asumir |
| **06** | **Por qué la forma y no el resultado** | **El resultado persiste r = 0.216; la habilidad, r = 0.556. Justifica el método antes de enseñar la herramienta** |
| 07 | El producto | Tres decisiones, no un score |
| 08 | La demostración | Un clic reordena el mercado: 10 trampas contra 1 |
| 09 | El Traductor | El diferenciador, con su error en pitchers nunca vistos |
| 10 | El caso económico | 43 carreras entre el perfil correcto y el equivocado |
| 11 | Ingeniería | Que esto es un sistema, no una demo |
| 12 | Los límites | Lo que declaramos que no sabemos |
| 13 | Cierre | Tres decisiones que cambiarían el lunes |

## 5. Ficha ejecutiva (1 página)

Un pitcher, una decisión. Lo que el director deportivo se lleva de la sala.

Contenido: identidad · rol · Stuff+ HH con banda · Impuesto de Altitud en carreras por 9 entradas · mapa de movimiento sea/altitud · tabla de arsenal · **una recomendación explícita** (`Fichar` / `Fichar con reservas` / `No fichar`) con su justificación en dos líneas.

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
  pitchers[]        370 tarjetas lanzador-temporada con arsenal, Stuff+, impuesto/9, rol, trampa
  pitch_profiles{}  niveles y deltas por tipo de pitch y entorno
  density{}         índice de densidad por entorno

analysis/outputs/evidence.json
  run_environment{} RA/9 observado por entorno: 4.84 -> 7.55 (+56%)
  roles{}           distribucion de roles inferidos
  seasons{}         cobertura por temporada, huecos y ultima temporada con score
  within_pitcher{}  efecto within-pitcher por tipo de pitch
  translator{}      métricas de holdout del Traductor
  hypotheses{}      veredicto sobre H1–H4
  audit{}           defectos del dataset
```
