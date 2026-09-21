# ADR 0004 · El rol tiene dos categorías, no tres

**Fecha:** 20 de septiembre de 2026 · **Estado:** aceptada · **Reemplaza la decisión de rol en** [ADR 0003](0003-metricas-de-producto.md)

## Contexto

El [ADR 0003](0003-metricas-de-producto.md) introdujo tres roles: `starter`, `reliever` y `late_inning_reliever`, este último definido como "entra de la séptima en adelante". El equipo de datos no quedó convencido y pidió dos: abridores y relevistas.

Le pedimos el veredicto a los datos, sobre las 22,569 apariciones del dataset.

**La entrada de ingreso de los relevistas es unimodal, y su moda es exactamente la entrada 7:**

```
entrada mediana 4: ██████ 18
entrada mediana 5: ████████████ 37
entrada mediana 6: ███████████████████████████████████████████ 129
entrada mediana 7: ██████████████████████████████████████████████████████████████████████████ 222   ← el corte
entrada mediana 8: ███████████████████████████████████ 106
entrada mediana 9: ██████████████ 43
```

El corte pasaba por la cresta. 222 de 568 relevistas quedaban parados sobre la línea, y las dos supuestas poblaciones diferían en 3 lanzamientos por aparición (18 contra 15) con rangos intercuartiles casi solapados: `[15, 23]` contra `[14, 17]`.

**Abridor contra relevista, en cambio, sí son dos poblaciones:**

```
abre   0-10% de sus apariciones: ██████████████████████████████████████████████████████████ 469
abre  40-50%:                    ██ 21      ← el valle
abre  90-100%:                   ██████████████ 119
```

Y los lanzamientos por aparición confirman lo mismo: 450 lanzadores entre 10 y 20, un valle entre 30 y 50, y 79 entre 70 y 80.

## Decisión

`ROLES = ["starter", "reliever"]`. Se elimina `late_inning_reliever` del contrato, del módulo, de las pantallas y del deck.

`median_entry_inning` se conserva como **número** en el Contrato B, sin mostrarse: es la materia prima del rol y lo que necesita la pregunta E5 del backlog para preguntar si la altitud muerde distinto según el rol.

## Qué salió mal, para no repetirlo

El error no fue de cálculo, fue de razonamiento: **"entra de la séptima en adelante" es *nombrable*, y lo confundimos con *separable*.** Que una categoría tenga un nombre natural en el idioma del béisbol no significa que el dato la contenga. La prueba barata —mirar el histograma antes de fijar el umbral— no se hizo.

Vale la pena registrar también que **el equipo de datos lo detectó sin tener el histograma delante**, por conocimiento del dominio. La medición vino después y le dio la razón. Es el argumento a favor de que los contratos se revisen con quien conoce el oficio, no solo con quien escribe el código.

## Consecuencia

El rol pasa a vivir en la fila lanzador-temporada, no en el lanzador: **43 de 347** lanzadores con dos o más temporadas clasificadas cambian de rol entre ellas. Ver [ADR 0005](0005-eje-de-temporada.md).
