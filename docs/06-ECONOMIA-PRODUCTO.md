# SuperEstela — Economía del producto: cuánto vale, cuánto cuesta, cómo se cobra

> Ejercicio comercial completo, **interno**. Supone que el hackathon terminó y que SuperEstela se construye de verdad.
>
> **Aviso sobre las cifras.** Los costos de infraestructura están calculados sobre el volumen real de datos que ya medimos. Los costos de talento y los precios son **estimaciones razonadas del mercado mexicano 2026**, no cifras investigadas: sirven para razonar la estructura y para negociar con un punto de partida, y deben validarse antes de poner un número en una propuesta. Todo lo que dependa de economía interna del club va marcado como `[dato del club]`.

---

## 1. Cuánto cuesta construirlo de verdad

El prototipo no es el producto. Esto es lo que falta para operar en producción.

| Rol | Meses-persona | Qué cubre |
|---|---|---|
| Data / ML engineer | 4.0 | Modelo final multi-target, xRV, calibración, recalibración por temporada |
| Platform / backend | 3.0 | Ingesta, contratos de datos, feature store point-in-time, scoring, API, Decision Log |
| Frontend | 2.5 | Las seis pantallas en producción, estados vacíos, errores, permisos |
| Producto / diseño | 1.5 | Definición, research con los tres usuarios, sistema de diseño |
| **Total** | **11.0** | |

**Costo de construcción**

| Escenario | Tarifa/mes-persona | Total |
|---|---|---|
| Consultoría senior mexicana | ~$180,000 MXN | **~$2.0M MXN** (~US$100k) |
| Equipo fundador a costo | ~$70,000 MXN | **~$770,000 MXN** |

La diferencia entre las dos filas es exactamente nuestro margen si lo construimos nosotros y lo vendemos como proyecto.

---

## 2. Cuánto cuesta operarlo — calculado sobre el volumen real

El dataset completo son **635,002 lanzamientos en tres temporadas** (~210k por temporada) en **211 MB**. Esto es importante: **el volumen es minúsculo**. Cualquier intuición de "big data" aquí está equivocada, y eso define el modelo de precios.

### 2.1 Infraestructura, por club y por mes

| Componente | Estimación mensual |
|---|---|
| Almacenamiento (raw + curated + artefactos) | < US$5 |
| Scoring nocturno de la liga completa | US$10–30 · son segundos de CPU |
| API del simulador y el traductor | US$20–50 |
| MLflow: tracking server + artefactos | US$30–50 |
| Postgres gestionado (Decision Log, metadatos) | US$25–40 |
| Observabilidad y logs | US$15–30 |
| **Total** | **US$105–205 ≈ $2,000–4,000 MXN** |

> La infraestructura **no es el costo**. Un club entero se sirve por menos de lo que cuesta una laptop al año.

### 2.2 El costo real son personas

| Concepto | Carga |
|---|---|
| Mantenimiento, soporte y atención al club | 0.2–0.3 FTE |
| Sprint de recalibración post-temporada | 2–3 semanas-persona al año |
| Mejora de modelo y producto | 0.2 FTE |

**Costo anual de operación, un club: ~$450,000–550,000 MXN.** De eso, menos del 10% es infraestructura.

### 2.3 La economía de escala

Servir un segundo club **no duplica** el costo: la infraestructura es marginal y el equipo es el mismo. Costo incremental por club adicional: **~$80,000–120,000 MXN/año** (onboarding, calibración a sus datos, soporte).

| Clubes | Costo anual total | Costo por club |
|---|---|---|
| 1 | $500k MXN | $500k |
| 3 | $700k MXN | $233k |
| 6 | $1.1M MXN | $183k |

Ese es el argumento para no quedarnos con un solo cliente.

---

## 3. Cuánto vale — el techo de precio

### 3.1 El anclaje que entiende un director deportivo

Medimos **43 carreras ≈ 4.3 victorias** de diferencia entre elegir el perfil correcto y el equivocado para **un solo puesto de rotación**, por temporada.

La conversación de precio no es "cuánto cuesta el software". Es:

> **El software cuesta una fracción del salario de un solo importado. Si evita una firma equivocada en tres años, ya se pagó varias veces.**

Con `[salario anual de un lanzador importado]` = S, el rango defendible es **20%–35% de S al año**. Si S está en el orden de US$80k–150k, eso pone la licencia anual en **US$20k–45k ≈ $400,000–900,000 MXN**.

### 3.2 El piso

No tiene sentido vender por debajo de **$500,000 MXN/año** para el primer cliente: es el costo de operarlo bien. Un precio por debajo del costo compra un cliente y destruye el negocio.

### 3.3 La banda

| | Anual, por club |
|---|---|
| Piso (costo) | $500,000 MXN |
| **Objetivo** | **$600,000–750,000 MXN** |
| Techo (valor) | $900,000 MXN |
| Con exclusividad LMB | ver §5.3 |

---

## 4. Bajo qué esquema se cobra — y por qué

Evaluación honesta de cada modelo **para este mercado concreto**: pocos compradores, temporada marcada, volumen de datos plano.

| Esquema | Veredicto | Razón |
|---|---|---|
| **Por procesamiento / por lanzamiento** | ❌ | Todos los clubes lanzan aproximadamente lo mismo. Es complejidad sin variación, y **castiga el uso** — justo lo contrario de lo que quieres con una herramienta de decisión |
| **Por carga de datos** | ❌ | El feed de TrackMan es continuo y el volumen es trivial. Facturar por GB aquí es absurdo |
| **Por asiento** | ❌ | Hay 3 a 6 usuarios por club. Cobrar por asiento desincentiva sumar al scout, que es quien más lo necesita |
| **Licencia perpetua + soporte** | ⚠️ | Malo para nosotros: **la recalibración por temporada _es_ el producto**. Una perpetua nos deja manteniéndolo por una cuota de soporte |
| **Suscripción pura** | ✅ | Encaja con cómo presupuesta un club, pero no cubre el trabajo fuerte de integración inicial |
| **Basado en resultados** | ❌ | Atribución imposible. Nosotros mismos demostramos que el vínculo Stuff+ → carreras todavía es débil (r = −0.08). Sería cobrar por algo que no podemos medir |
| **Implantación + licencia anual** | ✅✅ | **La recomendada** |

### 4.1 La estructura recomendada

```
Implantación (una vez)          $800,000 – 1,200,000 MXN
  integración del feed, calibración a sus datos,
  despliegue, capacitación de los tres roles

Licencia anual                  $600,000 – 750,000 MXN
  recalibración post-temporada, soporte,
  actualizaciones de modelo y producto

Descuento por 3 años            15% sobre la licencia
Club adicional (mismo año)      40% de descuento
```

**Por qué esta estructura:** la implantación cubre el trabajo real de arrancar, que es donde se va el esfuerzo y donde un modelo de suscripción pura nos haría perder dinero el primer año. La licencia anual alinea el precio con el trabajo recurrente de verdad — recalibrar cada temporada, no "dar soporte".

---

## 5. Si Diablos nos contrata: cuatro arreglos posibles

### 5.1 Comparación

| | A · Proyecto | B · Retainer | C · Contratación | D · Piloto |
|---|---|---|---|---|
| **Forma** | Alcance cerrado, 5 meses | Equipo dedicado 12 meses | Nos contratan de planta | 3 meses, alcance acotado |
| **Precio** | $1.5M MXN + licencia | $150k MXN/mes = $1.8M/año | Sueldos | $400,000 MXN |
| **Riesgo para el club** | Medio | Bajo | Ninguno | **Mínimo** |
| **Riesgo para nosotros** | Desviación de alcance | Bajo | Sin upside de producto | Bajo |
| **Deja producto reutilizable** | Sí | Parcial | **No** | Sí |
| **Fricción para cerrar** | Alta | Alta | Media | **Baja** |

### 5.2 La recomendación

**Abrir con D, con precio de conversión pactado de antemano.**

```
Piloto · 3 meses · $400,000 MXN
  Alcance: modelo final sobre sus datos, las tres pantallas
  nucleares en producción, Decision Log operando.
  Entregable duro: 20 decisiones registradas y evaluadas.

Conversión pactada desde el día uno:
  Implantación completa    $900,000 MXN  (acreditando el piloto)
  Licencia anual           $650,000 MXN
```

Un piloto de $400k es una decisión que un director deportivo puede aprobar sin consejo. Un proyecto de $1.5M no. Y el entregable duro —decisiones registradas y evaluadas— convierte la conversación de renovación en un dato en vez de una opinión.

### 5.3 Exclusividad: la palanca de precio más grande

Diablos pagaría por que ningún rival de la LMB tenga esto. Es real y hay que ponerle precio.

| Modalidad | Multiplicador | Condición |
|---|---|---|
| No exclusiva | 1.0× | Podemos vender a cualquier club |
| Exclusiva LMB, 2 temporadas | **2.5×** | Licencia anual ~$1.6M MXN |
| Exclusiva permanente | — | **No ofrecer.** Mata el negocio |

Si toman la exclusiva, el negocio cambia de forma: un cliente grande en vez de seis medianos. Aceptable por dos temporadas, nunca a perpetuidad.

### 5.4 Cláusulas que hay que negociar, no regalar

1. **Propiedad del método.** El Índice de Densidad y el Traductor se derivan de primeros principios. Deben quedar como IP nuestra, licenciada al club — no como obra por encargo.
2. **Derechos de datos.** Necesitamos licencia explícita para usar sus datos en el modelo *que les servimos*. Cualquier uso fuera de ahí, aparte.
3. **Derecho a publicar resultados agregados.** Sin identificar jugadores. Es nuestra credencial para el siguiente cliente.
4. **Reversión.** Si no renuevan, ellos se quedan con los scores históricos; nosotros con el código y el método.

---

## 6. Tamaño de mercado — con expectativas realistas

| Segmento | Compradores | Precio viable | Ingreso potencial |
|---|---|---|---|
| LMB | 18 clubes; 4–8 realistas en 3 años | $600k MXN | $2.4M–4.8M MXN/año |
| Liga del Pacífico | 10 clubes, presupuesto menor | $300k MXN | $900k–1.5M MXN/año |
| Organizaciones MLB con filiales en altura | Nicho, ciclo muy largo | — | Especulativo |
| Agentes y lado del jugador | Por evaluación | $15k–30k MXN | $300k–600k MXN/año |

**Escenario realista a 3 años:** 5 clubes LMB + 2 LMP + trabajo de agentes ≈ **$4M MXN/año de ingreso** contra ~$1.1M MXN de costo.

Es un **negocio de consultoría-producto sano de 3 a 5 personas**. No es escala de capital de riesgo, y conviene decirlo en voz alta: pocos compradores, ciclo de venta largo, presupuestos deportivos apretados. Quien entre esperando un SaaS que se multiplica solo se va a frustrar.

---

## 7. Lo que decide si esto vale algo

| Palanca | Efecto |
|---|---|
| **Cerrar el puente Stuff+ → carreras** | Sin esto la conversación de precio se apoya en una correlación débil. **Es el trabajo técnico de mayor valor económico del proyecto** |
| Primer cliente de referencia | El segundo club cuesta la mitad de vender que el primero |
| El Decision Log | Convierte la renovación en evidencia en vez de fe |
| Mantener el método como IP propia | Es lo único que no se puede replicar comprando datos |

---

## 8. Resumen en cinco líneas

1. Construirlo en serio: **~11 meses-persona**, ~$2.0M MXN a precio de mercado.
2. Operarlo: **~$500k MXN/año por club**, de los cuales menos del 10% es infraestructura.
3. Cobrarlo: **implantación $800k–1.2M + licencia anual $600k–750k**. Nunca por procesamiento ni por carga de datos: el volumen es plano y cobrar por uso castiga la adopción.
4. Con Diablos: **abrir con un piloto de $400k a 3 meses**, con precio de conversión pactado. La exclusividad LMB vale 2.5×, por dos temporadas, nunca perpetua.
5. Techo realista: **~$4M MXN/año** de ingreso a tres años. Negocio sano de pocas personas, no escala de riesgo.
