# ADR 0001 · Fijamos el toolchain, y la evidencia v0 se movió al hacerlo

**Fecha:** 18 de septiembre de 2026 · **Estado:** aceptada

## Contexto

El repositorio se montó con `uv` y Python 3.12. El entorno anterior, donde se
produjo `analysis/outputs/evidence.json`, era Python 3.9 con scikit-learn 1.2.2,
pandas 1.5.3 y numpy 1.26.4. El nuevo trae scikit-learn 1.9.1, pandas 3.0.6 y
numpy 2.5.3.

Al regenerar la evidencia bajo el entorno nuevo comparamos cifra por cifra.

**No se movió nada de lo medido:**

- Índice de densidad extrema: 0.8577 · razón de Magnus: 0.7543
- IVB perdido en recta, dentro del mismo lanzador: −3.77 pulgadas
- Impuesto de altitud observado, pulgadas perdidas y sello: **idénticos en los 286 lanzadores**
- `location_grid.json`: idéntico byte a byte

**Se movió lo que sale del modelo v0:**

- `stuff_plus` cambia ~0.3 puntos en 278 de 286 lanzadores
- `oof_r2` del run value crudo: 0.00287 → 0.00283 (sigue siendo 0.003)
- AUCs de aprendibilidad: cuarto decimal
- `altitude_trap` cambia en **15 de 286**, y el conteo de trampas pasa de **47 a 44**

## Decisión

Nos quedamos con el entorno nuevo, fijado por `uv.lock`. Volver a scikit-learn
1.2.2 para preservar un número publicado sería optimizar la cifra en lugar del
método, y pandas 1.5 ni siquiera acompaña bien a Python 3.12.

Desde aquí, `uv.lock` hace la reproducción exacta: dos corridas consecutivas del
pipeline dan salidas idénticas byte a byte, ya verificado.

## Consecuencia que hay que atender

`docs/00-PRODUCTO.md` §Trampa de Altitud y `docs/02-DESIGN-BRIEF.md` citan
**"47 de 286"**. La corrida que respalda ese número ya no existe; la que existe
dice 44. Por la regla 1 de `CONVENTIONS.md` §8, la cifra publicada tiene que
alcanzar a su corrida.

Y el hallazgo de fondo, que es más importante que el número: **una clasificación
con umbral duro mueve al 5% de la cohorte ante un cambio de librería.** El
producto ya sabe callar cuando la muestra es insuficiente; `altitude_trap`
necesita el mismo trato —una banda, o una zona "no concluyente"— o seguirá
siendo una bandera roja que depende de qué versión de scikit-learn se instaló.
Queda como decisión de producto, no de ingeniería.
