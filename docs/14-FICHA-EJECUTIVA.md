# SuperEstela — Ficha ejecutiva (plantilla)

> **Borrador del 1 de octubre de 2026.** Una página por lanzador, para el director deportivo: un
> pitcher y una decisión (`docs/02` §5). Es lo que se lleva de la sala.
>
> Se genera, no se escribe: cada campo sale de la Ficha de la app (`/pitchers/<id>/<temporada>`) y de
> sus artefactos. Se llena con las **cifras congeladas del 12 de octubre**.

## Estructura

```
┌───────────────────────────────────────────────────────────────────────┐
│ SUPERESTELA ▌            pitcher_XXXXX · temporada · mano · rol         │  registro de portada
├───────────────────────────────────────────────────────────────────────┤
│ RECOMENDACIÓN:  Fichar  /  Fichar con reservas  /  No fichar           │  una sola, grande
│ Por qué, en dos líneas.                                                │
├──────────────┬──────────────┬──────────────┬──────────────────────────┤
│ Stuff+ alt.  │ Stuff+ mar   │ Impuesto de  │ K−BB% · Whiff%           │
│ extrema ± b  │ ± b          │ Altitud c/9  │ por entorno, ± b         │
├──────────────┴──────────────┴──────────────┴──────────────────────────┤
│ Mapa de movimiento: nivel del mar → altitud extrema                    │
├───────────────────────────────────────────────────────────────────────┤
│ Arsenal: pitch · uso · IVB mar → alt. · Stuff+ mar → alt. · whiff       │
├───────────────────────────────────────────────────────────────────────┤
│ Modelo · escala · regla de la recomendación · límites                  │  letra chica
└───────────────────────────────────────────────────────────────────────┘
```

## De dónde sale cada campo

| Campo | Fuente | Nota |
|---|---|---|
| Identidad, temporada, mano, rol | Tarjeta de `mockup_data.json` | El rol, por ADR 0004 |
| **Recomendación** | `domain/reading.ts → verdictOf` | Trampa: «no fichar al precio de nivel del mar»; banda entera arriba de 100: «fichar»; lo demás: «con reservas». **La regla se imprime en la letra chica**, porque es provisional y de producto |
| Por qué, en dos líneas | La «Lectura del sistema» de la Ficha | La frase depende de la escala (`es.scale`, #75) |
| Stuff+ en los dos entornos | Tarjeta, con su banda al 95% | Ninguna cifra sin banda |
| Impuesto de Altitud | Tarjeta; «no concluyente» si no es significativo | En carreras por 9 entradas (ADR 0003) |
| K−BB% y whiff | `outcomes_hh`, `outcomes_sea` (#72) | «Muestra insuficiente» debajo de 50 turnos |
| Mapa de movimiento | `arsenals.json` | Forma medida, no simulada |
| Arsenal | La tabla de la Ficha | |
| Letra chica | `model_id`, `mockup_data.json → scale`, «el sistema recomienda; decide el cuerpo técnico» | Más la prohibición de uso para apuestas |

## Cómo se genera (pendiente)

- **Opción A, recomendada:** una ruta de impresión de la app, `/pitchers/<id>/<temporada>/ficha`, con
  `@media print` a una página carta. Usa los mismos componentes, así que las cifras no pueden
  divergir de la pantalla.
- **Opción B:** una tabla de `report/build.py` por lanzador, en Markdown y luego PDF. Es más rápida,
  pero pierde el mapa.

Para la entrega bastan **tres fichas**, una por historia de `docs/09` §5.2: `pitcher_00069` (la
recta que pierde en la altura), `pitcher_00566` (el slider que aguanta) y un lanzador que sí se
recomienda fichar, a elegir de la cohorte con la regla de arriba.
