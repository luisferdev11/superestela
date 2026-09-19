# SuperEstela — Definición de Producto

> **SuperEstela** — Inteligencia de pitcheo calibrada para la altura.
> Hackathon ISAC 2026 · Diablos Rojos del México · Stuff Plus Model

---

## 1. El problema

Diablos Rojos juega a **2,240 metros** sobre el nivel del mar. Es el entorno de pitcheo más extremo del béisbol profesional — 631 m más alto que Coors Field, el estadio más bateador-friendly de MLB.

Cada herramienta de evaluación de pitcheo que existe en el mundo —Stuff+ de FanGraphs, los modelos internos de los 30 equipos de MLB, cualquier reporte de scouting comprado— fue **entrenada al nivel del mar**. Cuando el club las usa para decidir a quién firmar, está aplicando una regla calibrada para un aire que aquí no existe.

El sesgo no es aleatorio. Es sistemático, y va en la peor dirección posible:

> **Los pitchers que los modelos de MLB rankean más alto son exactamente los que más se degradan en el Harp Helú.**

Correlación entre el ride (IVB) de un fastball a nivel del mar y cuánto pierde en altitud: **−0.52**. El cuartil superior pierde **−4.27"**; el inferior, **−3.06"**. El activo más caro del mercado es el que peor sobrevive aquí.

---

## 1bis. El nombre

**SuperEstela** — la estela aerodinámica, la huella que la pelota deja en el aire. Es de donde sale el Índice de Densidad: leemos el aire desde la trayectoria, no desde la etiqueta del estadio.

Y es un juego con *superestrella*: la superestrella es el lanzador que el mercado persigue y que peor sobrevive aquí. Una letra de diferencia cambia la tesis — **no persigues a la estrella, lees la estela.**

Forma corta: **Estela**. Las métricas firmadas no dependen del nombre: Stuff+ HH, Impuesto de Altitud, Índice de Densidad y Trampa de Altitud se mantienen.

---

## 2. La tesis

No hay un modelo Stuff+ calibrado para la LMB. Construirlo es el reto. Pero un score, por sí solo, no cambia una decisión.

**SuperEstela no entrega un número. Entrega la respuesta a las tres decisiones que el club toma cada temporada:**

| Decisión | La pregunta real | Módulo |
|---|---|---|
| **Fichar** | Este pitcher nunca ha lanzado aquí. ¿Cuánto vale *en el Harp Helú*? | Traductor de Altitud + Radar de Fichajes |
| **Desarrollar** | ¿Qué debe cambiar de su arsenal para sobrevivir en casa? | Plan de Desarrollo |
| **Alinear** | ¿Quién abre en casa y quién en carretera? | Tablero de Despliegue |

El "dashboard con sliders" que pide el entregable 4 del reto es el *commodity* que todos los equipos van a construir. En SuperEstela es **una de seis pantallas**, no el producto.

---

## 3. El diferenciador: el Traductor de Altitud

El problema de fichajes tiene una forma incómoda: **el candidato que quieres evaluar nunca ha lanzado en tu estadio.** Sus datos vienen de MLB, MiLB, la Liga del Pacífico, Japón, o de un parque de la LMB a nivel del mar. Un modelo entrenado sobre pitches lanzados en CDMX no puede puntuarlo, porque no tiene sus pitches en CDMX.

El Traductor resuelve exactamente eso: **entra la forma de un pitcher medida en cualquier estadio; sale su forma proyectada y su Stuff+ en el Harp Helú, con banda de confianza.**

Funciona, y está validado sobre **pitchers que el modelo nunca vio** (pitcher holdout 80/20):

| Pitch | Error al proyectar IVB | Error sin ajustar | Mejora |
|---|---|---|---|
| Four-Seam | **0.85"** | 3.88" | 4.6× |
| Sinker | 0.93" | 2.83" | 3.0× |
| Changeup (\|HB\|) | 0.94" | 4.66" | 5.0× |
| Curveball (\|HB\|) | 1.18" | 3.91" | 3.3× |

Y lo más importante: **la versión puramente física, sin ajustar un solo parámetro** —escalar el efecto Magnus por la razón de densidad medida— logra un error prácticamente igual (0.92" vs 0.85" en four-seam IVB).

Que la física sola baste significa que **el Traductor extrapola a altitudes y estadios que nunca vio**. Funciona para un prospecto de Japón igual que para uno de Monterrey. Ese es el caso de uso comercial completo, y ningún modelo Stuff+ público lo hace.

---

## 4. Métricas firmadas

Son activos de marca tanto como métricas. Aparecen con nombre propio en app, deck y documento.

| Métrica | Definición | Usuario |
|---|---|---|
| **Stuff+ HH** | Stuff+ calibrado a las condiciones del Harp Helú. 100 = pitch promedio de la LMB. | Pitching coach |
| **Impuesto de Altitud** | Carreras adicionales concedidas **por cada 9 entradas** al mover a este pitcher a CDMX. Con error estándar; donde no alcanza significancia se muestra *no concluyente*, nunca un número. | Director deportivo |
| **Índice de Densidad** | Densidad del aire **medida** desde la trayectoria de la bola, juego a juego. Sea level = 1.000. | Credibilidad científica |
| **Trampa de Altitud** | Bandera roja: se ve fuerte a nivel del mar, colapsa en CDMX. **44 de 286 pitchers** de la cohorte. | Director deportivo |

> **Por qué el Impuesto va en carreras por 9 entradas.** Nueve entradas es la unidad que el béisbol ya lee; *por 100 lanzamientos* no se la sabe nadie. La conversión usa los 18.63 lanzamientos por entrada medidos en altitud, no un número redondo.
>
> **Y por qué es un piso, no el efecto completo.** El Impuesto se construye con pesos lineales por lanzamiento, que valoran el resultado de cada pitch pero nunca ven el secuenciamiento. Contra las carreras realmente admitidas recupera **+1.77 de los +2.70 RA/9 observados**, cerca del 65%. Se reporta como cota inferior y se dice así.

> **Nota de escala.** Stuff+ HH se normaliza sobre toda la liga (ambos entornos), así que los pitches en altitud promedian **por debajo de 100 por construcción**. Esa brecha *es* el efecto altitud, no un error de calibración. El mismo lanzador puntúa en promedio **8.6 puntos menos** en casa que a nivel del mar.

---

## 5. Los seis módulos

### 1. Traductor de Altitud *(el wedge)*
Entra el arsenal de un pitcher medido en cualquier parte → sale su forma proyectada y su Stuff+ HH, con banda de confianza. Cubre el entregable 3 del reto ("cómo perfilar un prospecto o agente libre").

### 2. Radar de Fichajes
Ranking de candidatos por valor proyectado **en CDMX**, no por sus números crudos. Columnas de Stuff+ HH, Stuff+ a nivel del mar, Δ, Impuesto de Altitud y bandera de Trampa. Ordena por lo que importa aquí.

### 3. Simulador de Pitch *(entregable 4 obligatorio)*
Sliders de velocidad / IVB / HB / spin / extensión → Stuff+ lado a lado **Harp Helú vs nivel del mar**, más el mapa de movimiento. Es lo que pide el reto, ejecutado con calidad de producto real.

### 4. Plan de Desarrollo
Para un pitcher ya en roster: qué lanzamiento se degrada más, cuál aguanta, y qué cambio de uso lo compensa — cuantificado en Stuff+ HH y en carreras, **en dos o tres frases con su mecanismo físico**. No en tarjetas: un coach no lee tarjetas, escucha una razón. Cubre el entregable 3 del reto junto con el Traductor.

### 5. Tablero de Despliegue
Selector de estadio → el roster ordenado por Stuff+ de **ese** entorno, agrupado por rol (abridor / relevista / relevista de entradas finales). **No sugiere orden de pitcheo**: esa decisión es del mánager y no es nuestra para automatizar.

Que el tablero exista lo justifica el dato: la correlación de orden entre casa y gira es **0.700**, el cambio mediano es de **38 posiciones**, y **6 de los 10 mejores en casa no están entre los 10 mejores de gira**.

El rol se infiere de la entrada en que el lanzador entra al juego — una regla medida, no un modelo. **No incluye "cerrador":** un cerrador se define por entrar en situación de salvamento y el dataset no trae marcador.

### 6. Ficha Técnica *(transversal)*
Cada score viene con su explicación: contribución por feature (SHAP) **y la razón física**. Un pitching coach no actúa sobre una caja negra.

---

## 6. Principios de producto

1. **Decisión, no exploración.** Cada pantalla responde su pregunta en menos de 10 segundos. Un coach no navega dashboards; decide.
2. **La incertidumbre es feature.** "Stuff+ HH 107.1 ± 4.2" gana confianza; un número desnudo la pierde. Los pitchers con poca muestra muestran bandas anchas, y eso está bien.
3. **Física visible.** Toda recomendación se acompaña de su mecanismo físico. Es lo que separa un modelo creíble de un oráculo.
4. **Nada inventado.** Cada cifra del prototipo sale de `analysis/outputs/`. No hay *lorem ipsum* ni datos ficticios en ningún entregable.
5. **Honestidad de alcance.** Lo construido y lo diseñado se marcan explícitamente ante el jurado.

---

## 7. Usuarios

| Usuario | Qué necesita | Módulo principal |
|---|---|---|
| **Pitching coach** | Qué ajustar en el arsenal de su pitcher, hoy | Plan de Desarrollo, Simulador |
| **Reclutador / scout** | Filtrar candidatos rápido, evitar trampas | Radar de Fichajes, Traductor |
| **Director deportivo** | Cuánto vale esto en carreras y en dinero | Impuesto de Altitud, Ficha ejecutiva |

---

## 8. El argumento de negocio

**Tesis de ineficiencia de mercado.** Los precios del mercado de pitchers se forman con datos de nivel del mar. Diablos puede:

- **comprar barato** lo que aquí sí funciona — curvas, cutters, perfiles de ride bajo, sinkers de mucho movimiento;
- **evitar sobrepagar** por ride alto, que es precisamente el activo más caro y el que más se degrada aquí.

Es *Moneyball* con una variable física que ningún otro club de la liga está modelando. La ventaja dura mientras nadie más la construya.

**Traducción a dinero.** Un delta de Stuff+ no mueve a un director deportivo; "este fichaje concede 6.3 carreras extra por cada 9 entradas en casa" sí. El Impuesto de Altitud está expresado en carreras precisamente para poder convertirlo a valor de contrato.

---

## 9. Mapa a los criterios de evaluación

| Criterio | Peso | Cómo lo atacamos |
|---|---|---|
| **Calidad del Stuff+ Model** | 25% | Targets por componente (whiff, chase, GB, hard contact) combinados en xRV, no run value crudo — con evidencia de por qué (§ `01-EVIDENCIA.md`) |
| **Robustez fuera de muestra** | 25% | Pitcher holdout, season holdout, park holdout. Features de arsenal con *point-in-time correctness* para eliminar leakage |
| **Integración arsenal + altitud** | 25% | Índice de Densidad continuo medido desde la física; efecto cuantificado within-pitcher; delta por pitch shape |
| **Aplicabilidad real** | 25% | Seis módulos orientados a las tres decisiones reales del club; Impuesto de Altitud en carreras; Decision Log auditable |

Entregables obligatorios del reto: **1** → Radar + Ficha de Pitcher · **2** → Perfil Físico Ideal · **3** → Plan de Desarrollo + Traductor · **4** → Simulador · **5** → `docs/` + documento técnico.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Sobre-alcance: 6 módulos en 4 semanas | Módulos 1–3 son obligatorios; 4–6 degradan a mockup de alta fidelidad |
| El equipo de datos no llega al modelo final | El Traductor funciona con **física pura, sin entrenamiento**. Producto defendible aunque el ML se retrase |
| Refutar H2 se lee como arrogancia | Enmarcar como *"la convocatoria pidió cuantificar antes de asumir; esto encontramos"* |
| `Extreme Altitude` mezcla varios estadios | Es exactamente por qué modelamos densidad continua y no el bucket |
| Confusión de fechas (15 oct vs 9 dic) | **Confirmar con ISAC.** Ver `README.md` |
