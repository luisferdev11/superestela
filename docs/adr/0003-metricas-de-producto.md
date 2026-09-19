# ADR 0003 · Revisión de métricas de producto con el equipo de datos

**Fecha:** 18 de septiembre de 2026 · **Estado:** aceptada

## Contexto

Al presentarle el diseño al equipo de datos, tres pantallas y dos métricas no se entendieron. Eso no es un problema de explicación: si las dos personas que construyen el modelo no leen una métrica, un pitching coach tampoco.

Se midió antes de decidir. Lo que salió:

| Hallazgo | Número |
|---|---|
| Impuesto de Altitud significativo por lanzador | **40 de 286** |
| Carreras reales, nivel del mar → altitud extrema | **4.84 → 7.55 RA/9** (+56%) |
| Fracción del efecto que captura el Impuesto modelado | **65%** (+1.77 de +2.71) |
| Lanzamientos por entrada en altitud | 18.62 → 100 lanzamientos ≈ 5.4 entradas |
| Separación abridor / relevista por entrada de ingreso | 439 puros de relevo, 153 puros de abridor, **solo 59 ambiguos** |
| Orden del roster, casa vs gira | rho **0.700**; **6 de los 10 mejores** en casa no están en el top-10 de gira |

## Decisiones

**1 · El Impuesto de Altitud se expresa en carreras por 9 entradas.** Nueve entradas es la unidad que el béisbol ya lee. La conversión usa los lanzamientos por entrada medidos en cada entorno, no una constante. Donde no alcanza significancia, el producto muestra *no concluyente* — el mismo instinto que `MIN_PITCHES_FOR_SCORE`, aplicado a un estadístico que no lo estaba respetando.

**2 · El Sello de Altitud se elimina.** Eran terciles del Impuesto, así que etiquetaba a 286 lanzadores con un estadístico que es ruido para 246. Las métricas firmadas pasan de cinco a cuatro.

**3 · El Plan de Desarrollo deja de ser tarjetas.** Dos o tres frases cuantificadas con su mecanismo físico. Un coach no consume tarjetas; escucha una razón y la repite en el bullpen. Sigue cubriendo el entregable 3.

**4 · El Tablero de Despliegue ordena por estadio y agrupa por rol.** No sugiere orden de pitcheo: esa decisión trae contexto que no modelamos, y automatizarla es la forma más rápida de que la herramienta deje de usarse.

**5 · El contexto de liga sale de la app.** Se lee una vez; vive en el documento y el deck. La barra de Índice de Densidad se queda, porque ahí no es contexto sino la procedencia del número en pantalla.

## El rol, y lo que deliberadamente no nombramos

La regla vive en `packages/models/features/role.py`: si abre al menos la mitad de sus apariciones es **abridor**; si no y entra de la séptima en adelante es **relevista de entradas finales**; si no, **relevista**. Debajo de cinco apariciones, nulo.

Es una regla y no un modelo porque la separación medida ya es casi limpia, y un clasificador solo agregaría un entrenamiento, una semilla y un modo de falla.

**No existe la categoría "cerrador".** Un cerrador se define por entrar en situación de salvamento y **el dataset no tiene marcador**. La palabra estaba disponible y la tentación era real; nombrar un rol que no se puede derivar es exactamente lo que un jurado técnico encuentra.

## Pendiente que esta revisión no resuelve

`altitude_trap` sobrevive —no depende del Impuesto sino de Stuff+ a nivel del mar y del delta— pero arrastra el umbral duro de [ADR 0001](0001-toolchain-pinning.md): reclasifica a 15 de 286 ante un cambio de librería. Necesita el mismo tratamiento que acaba de recibir el Impuesto. Es decisión de producto y se toma aparte, no de pasada.
