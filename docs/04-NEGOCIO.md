# SuperEstela — Modelo de Negocio

> Dos secciones con audiencias distintas. **§1–§4 es lo que se presenta al jurado.**
> **§5 es interno del equipo y no se muestra, ni se insinúa, en el deck ni en la entrevista.**

---

## 0. Por qué esto importa aunque la convocatoria no lo pida

El reto no evalúa modelo de negocio. Pero el 25% de "Aplicabilidad real" se juzga en una entrevista de 10 minutos con un **pitching coach y un director deportivo**, y la pregunta literal es si cambiarían sus decisiones de reclutamiento y táctica. Esa es una pregunta de negocio disfrazada de pregunta técnica.

Un equipo que llega con un modelo bien validado y no sabe decir qué vale, pierde contra uno que sabe ambas cosas. Y en ITAM, frente a un jurado mixto, el lenguaje de carreras y pesos es el que cruza entre la mesa técnica y la mesa deportiva.

---

## 1. Quién se beneficia y de qué

| Usuario                | Decisión que toma hoy a ciegas                            | Qué cambia con SuperEstela                                                      |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Director deportivo** | Firma imports con reportes calibrados a nivel del mar     | Ve el valor proyectado en su propio estadio, y la bandera de Trampa      |
| **Reclutador / scout** | Ordena candidatos por velocidad, spin y reportes externos | Ordena por Stuff+ en altitud extrema; el spin deja de ser criterio                       |
| **Pitching coach**     | Ajusta por intuición y video                              | Sabe qué lanzamiento del arsenal carga el déficit y cuánto rinde moverlo |
| **Mánager**            | Alinea por rotación fija y matchup de bateo               | Alinea por Stuff+ del entorno: casa y gira dejan de ser el mismo tablero |

---

## 2. La cadena de valor, medida

Todo lo de abajo sale de `analysis/outputs/`. Los supuestos están marcados.

### 2.1 El número central

Sobre 286 lanzadores con al menos 150 lanzamientos en ambos entornos:

| Perfil           | Impuesto de Altitud | Carreras/temporada en casa\* | Victorias\*\* |
| ---------------- | ------------------- | ---------------------------- | ------------- |
| Peor decil (p90) | +6.26 carreras/9 ent. | **+31.8**                  | +3.2          |
| Mediana          | +1.67 carreras/9 ent. | +8.5                       | +0.9          |
| Mejor decil (p10)| −2.29 carreras/9 ent. | **−11.6**                  | −1.2          |

\* Supuesto: 850 lanzamientos en casa por abridor y temporada, que a 18.62 lanzamientos por entrada son ~45.6 entradas.
\*\* Supuesto: ~10 carreras por victoria.

> **43 carreras — cerca de 4.3 victorias — separan al perfil correcto del equivocado en un solo puesto de rotación.** La herramienta cuesta lo mismo en ambos casos.

> **Y es una cota inferior.** El Impuesto se construye con pesos lineales por lanzamiento, que no ven el secuenciamiento: captura +1.77 de los +2.71 RA/9 realmente observados entre entornos, cerca del 65% (`01-EVIDENCIA.md` §8.2). El caso económico está calculado sobre el 65%, no sobre el total.

### 2.2 Las cinco palancas, por costo de implementación

| #   | Palanca                                                              | Costo marginal            | Magnitud                                                               |
| --- | -------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| 1   | **Alinear mejor** — ordenar la rotación por Stuff+ del entorno       | **Cero**                  | Reasignación pura; `pitcher_00445` es último en casa y séptimo en gira |
| 2   | **No firmar la trampa** — descartar perfiles que colapsan            | Cero (es un _no_)         | Hasta 31.7 carreras evitadas por firma                                 |
| 3   | **Desarrollar** — mover uso y reformar arsenal                       | Bajo; ya se paga al coach | +3.5 Stuff+ en altitud extrema en el caso trabajado                                    |
| 4   | **Comprar barato** — curvas, cutters, perfiles de ride bajo          | Negativo: son más baratos | Arbitraje de precio                                                    |
| 5   | **No vender al infravalorado** — el que se ve mal en casa y es bueno | Cero                      | Evita destruir valor propio                                            |

Las tres primeras no requieren un peso adicional de nómina. Ese es el argumento: **la mayor parte del valor es reasignación, no inversión.**

### 2.3 La tesis de arbitraje

El mercado de lanzadores forma precios con datos de nivel del mar. En CDMX:

- el **four-seam de ride alto** —el activo más caro y más buscado— es el que peor sobrevive (−3.36 pp de whiff, el mayor deterioro de la liga);
- la **curva** conserva su whiff intacto (−0.23 pp) y _gana_ chase (+1.95 pp), y nadie la cotiza por eso;
- el **cutter** casi no se mueve (−0.32 pp).

Diablos puede comprar barato exactamente lo que aquí funciona y dejar de sobrepagar por lo que aquí se rompe. La ventaja dura mientras ningún otro club de la liga lo modele.

### 2.4 Cómo se convierte a dinero

La cadena es: `Stuff+ en altitud extrema → carreras → victorias → [valor de una victoria para el club]`.

Los dos primeros eslabones están medidos. El tercero es estándar sabermétrico. **El cuarto lo pone el club**, porque depende de taquilla, patrocinio, derechos y valor de un título — datos que no están en el dataset y que no vamos a inventar.

> En el deck esto aparece como `[VALOR DE UNA VICTORIA]` sin rellenar. Un jurado que ve una cifra inventada ahí deja de creer el resto.

### 2.5 El eslabón que todavía no cierra — y hay que decirlo

La conversión funciona hacia atrás desde el **Impuesto de Altitud observado**, que se mide directamente sobre el run value. Lo que **no** está soportado es predecir carreras a partir de un cambio de Stuff+: con el baseline v0 la correlación es **r = −0.08** sobre 286 casos, y solo **40 de 286** impuestos son significativos al 95%.

Consecuencia operativa, ya reflejada en el producto:

- **Stuff+ en altitud extrema** es la señal para decidir sobre un lanzador individual: sale de la forma física y es estable.
- **Impuesto de Altitud** es señal de cartera: sirve para razonar sobre el pool de candidatos, no para sentenciar a uno.

Cerrar ese puente —modelar los componentes del outcome y agregarlos a xRV— es la tarea de mayor valor económico pendiente del equipo de datos. Ver `05-CIENCIA-BRIEF.md`.

---

## 3. Costo y viabilidad para el club

| Concepto    | Nota                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| Datos       | Ya los tienen: TrackMan está instalado. Costo incremental cero                                |
| Cómputo     | Scoring nocturno de la liga completa; carga trivial a esta escala                             |
| Integración | La app consume un endpoint; no reemplaza ningún sistema existente                             |
| Adopción    | Tres usuarios nombrados, cada uno con su pantalla de aterrizaje                               |
| Riesgo      | El Decision Log deja auditar si la herramienta ayudó — el club puede cancelarla con evidencia |

El argumento de adopción: **no pedimos que confíen en el modelo. Pedimos que registren sus decisiones y lo midan.**

---

## 4. Lo que hace defendible la ventaja

1. **La capa de física.** El Índice de Densidad se deriva de la trayectoria de la bola, no de una etiqueta. Extrapola a estadios fuera del dataset, que es justo el caso de fichajes.
2. **El Decision Log.** Cada recomendación queda con su versión de modelo, su incertidumbre y la decisión humana. El sistema mejora con el uso; un competidor que empieza de cero no tiene ese historial.
3. **La calibración local.** Un modelo entrenado en LMB a altitud no se compra en ningún lado.

---

## 5. INTERNO — cómo capitalizamos nosotros

> **No se presenta al jurado, no se menciona en la entrevista, no aparece en ningún entregable.**

### 5.1 Lo primero: qué podemos y qué no podemos llevarnos

Del reglamento de la convocatoria, literal:

- _"Los participantes son dueños de sus proyectos y propiedad intelectual **pero no de los datos**."_
- _"Se pueden presentar resultados **pero no los datos**."_
- _"Los datos proporcionados por ISAC y el patrocinador **solo se pueden utilizar para la competencia**."_
- La capa de finalistas **incluye NDA**.
- El output **no puede usarse para apuestas**.

Lectura operativa:

| Activo                                            | ¿Es nuestro?        | Comentario                                                  |
| ------------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| Diseño de producto, IA, marca                     | **Sí**              | IP propia                                                   |
| Arquitectura e ingeniería                         | **Sí**              | IP propia                                                   |
| **Método** del Índice de Densidad y del Traductor | **Sí**              | Se deriva de primeros principios; la data solo lo validó    |
| Código del pipeline                               | **Sí**              | Mientras no incluya datos                                   |
| **Pesos del modelo entrenado**                    | **No asumirlo**     | Son derivados de datos licenciados solo para la competencia |
| Dataset LMB, cifras a nivel registro              | **No**              | Prohibido explícitamente                                    |
| Resultados agregados y hallazgos                  | **Sí, publicables** | "Se pueden presentar resultados"                            |

> **Conclusión:** lo comercializable es **el método y el producto**, no el modelo entrenado ni la data. Cualquier uso comercial de lo segundo requiere un acuerdo aparte con ISAC y Diablos. Vale la pena preguntarlo explícitamente si llegamos a finalistas — es una conversación normal, no un favor.

### 5.2 Vías realistas, de más probable a menos

**A. El pipeline de contratación.** La convocatoria lo ofrece de forma explícita y comparte nombres y correos con los patrocinadores. Es la vía más directa y no requiere montar nada. Ganar o quedar finalista es, en la práctica, una entrevista técnica de varios días con evidencia.

**B. Un encargo de servicios con Diablos.** El hackathon es una demostración de capacidad pagada con nuestro tiempo. Si el producto convence, la conversación natural es implementarlo de verdad, ya con acuerdo de datos. Modelo: proyecto de implantación + retainer de operación.

**C. Generalizar el método a otras plazas.** Esto es lo interesante y no depende de sus datos. El problema no es "Harp Helú": es **evaluación de pitcheo ajustada por entorno**, y el Índice de Densidad funciona sobre cualquier feed de tracking.

- LMB: varios parques altos además de CDMX — Puebla, Saltillo, Aguascalientes, León. Los 18 clubes tienen el problema en distinto grado.
- Organizaciones de MLB con filiales en altura, y Coors.
- Ligas de invierno que importan lanzadores de la LMB.
- Programas universitarios y academias con trackers portátiles.

**D. Lado del jugador.** Un lanzador castigado por haber tirado en altura tiene números que no lo representan. El Traductor normaliza a nivel del mar — eso es un servicio vendible a agentes en negociación de contrato. Nicho pequeño, margen alto, cero fricción de datos porque el jugador aporta los suyos.

**E. Publicación.** "Se pueden presentar resultados": el efecto within-pitcher sobre 268 lanzadores y la derivación del índice de densidad son publicables. Reputación, y llave para C y E.

### 5.3 Qué hacer ya, aunque no ganemos

1. **Separar el repositorio en dos**: `core` (física, traductor, arquitectura — sin datos, portable) y `lmb` (todo lo que toca el dataset). La frontera de IP queda limpia desde el día uno, no se reconstruye después.
2. **No firmar nada que ceda IP** más allá de lo que el reglamento ya establece. Leer el NDA de finalistas con cuidado en ese punto concreto.
3. **Documentar autoría y fechas** de la capa de física. Es el activo defendible.
4. **Preguntar, si llegamos a finalistas**, en qué términos se podría usar el trabajo fuera de la competencia. Antes de firmar el NDA, no después.
5. **Guardar el producto como portafolio**: el canvas, el deck y el documento técnico valen como credencial aunque el proyecto no continúe.

### 5.4 Expectativas honestas

Un SaaS de analítica deportiva vendido a clubes es un negocio lento, de ciclo largo y pocos compradores. Con datos restringidos, sin entidad legal y siendo estudiantes, **la vía de valor más probable a doce meses es A + B + E**, no un producto vendido por licencia.

Lo que sí es seguro: salimos con un método propio, un producto diseñado de punta a punta, y evidencia de haberlo hecho bien. Eso se capitaliza aunque el hackathon no pase de aquí.
