# SuperEstela — Plan hacia el 15 de octubre

> Actualizado el **21 de septiembre de 2026**. Quedan **24 días**.
>
> Reemplaza al plan de arranque original: el repositorio ya está en pie y la semana 1 se cumplió. Esto es lo que falta.

---

## 1. Dónde estamos

| | |
|---|---|
| Repositorio | `github.com/luisferdev11/superestela`, privado, CI verde, `main` protegida |
| Contratos | Ejecutables y publicados. Llave `(pitcher_id, season)`, rol de dos valores |
| Evidencia | `analysis/evidence.py` reproduce todo en ~3 min; 370 temporadas con score de 296 lanzadores |
| Prototipo | 10 pantallas de app y 13 láminas de deck, con datos reales de la corrida actual |
| Equipo de datos | Incorporado, primer PR fusionado (EDA del dataset) |

**Lo que todavía no existe:** el modelo final. Todo lo que se ve hoy corre sobre `stuff_plus_v0`, un baseline declarado como tal.

---

## 2. Calendario

| Semana | Fechas | Objetivo |
|---|---|---|
| **2** (en curso) | 21–24 sep | Modelo por componentes arrancando: A1 y A2 del backlog |
| **3** | 25 sep – 1 oct | **Puerta A3**: ¿existe un xRV que correlacione con el run value observado? |
| **4** | 2–8 oct | Integración: las pantallas sobre scores reales, borrador del documento |
| **5** | 9–15 oct | Cerrar |

### Dos fechas que no se mueven

- **12 de octubre · congelamiento de cifras.** A partir de ahí ningún número cambia. El documento y el deck se terminan contra cifras congeladas, no contra un modelo que sigue entrenando.
- **13 de octubre · ensayo completo.** Los 10 minutos cronometrados, con la app en vivo. Lo que falle ahí se arregla el 14.

### La ruta crítica, sin cambios

**A1–A3: el puente Stuff+ → carreras.** Todo lo demás tiene holgura; esto no. La lámina 06 del deck ahora **declara el hueco explícitamente** (el whiff predice las carreras del año siguiente con −0.12), así que si el puente no cierra, el deck sigue siendo coherente: dijimos que faltaba.

**Disparador:** si el 1 de octubre no hay xRV correlacionado, se recorta alcance de producto, no de validación.

---

## 3. Qué falta, en orden

1. **El modelo por componentes** (datos). A1, A2, A3 del backlog de `docs/05`. Es lo único que está en la ruta crítica.
2. **Scaffold de Next.js** (producto). Las pantallas existen como diseño; falta la app. `packages/web/` está vacío y el job `web` del CI ya está esperando.
3. **`contracts.yml` y `model-eval.yml`** (CI). Semanas 2 y 3 de la progresión de `docs/07` §4.
4. **El documento técnico.** Se escribe contra cifras congeladas a partir del 12.

---

## 4. Anotado, y explícitamente no prioritario

Cosas que valen la pena y que **solo se hacen si sobra tiempo**. Están aquí para que no se pierdan, no para que presionen.

### Mapa de diseño de lanzamiento

El uso de Stuff+ que más valoran las organizaciones: no *"¿qué pasa si muevo esto?"* sino *"¿hacia dónde muevo?"* — un contorno sobre el plano de break que muestra la dirección en que sube el score.

**Por qué espera:** el contorno saldría del `stuff_plus_v0`, cuyo R² no sostiene una recomendación direccional. Dibujar una flecha encima prometería una precisión que no tenemos. **Entra cuando exista el modelo por componentes**, y entonces es una capa sobre el Simulador, no una pantalla nueva.

### La prueba que cierra el sesgo de slider

`docs/01` §8.5 documenta que nuestro v0 premia sliders y curvas, y que lo que realmente sobrevive la altitud es **el poco ride** (corr |IVB| vs pérdida = **+0.531**), no la categoría de lanzamiento.

La prueba que lo cerraría del todo: **correr el baseline sin las variables de tipo de lanzamiento** y ver si el efecto de altitud sobrevive sin que el modelo sepa qué se lanzó. Media tarde del equipo de datos.

**Por qué espera:** la respuesta ya está documentada y lista si preguntan en la presentación. Convertirla en experimento la haría más fuerte, pero no es lo que decide el resultado del reto.

### Ángulo de brazo

Probado y descartado, para que nadie lo reabra: el proxy de slot correlaciona −0.221 con la pérdida de IVB, pero enteramente por su correlación con el IVB mismo (+0.388). Controlando por IVB, el coeficiente es −0.0014 y el R² gana 0.000. **No aporta nada que las features de release y el IVB no tengan ya.**

---

## 5. Pendientes que no son de código

- [ ] **Buscar si "SuperEstela" ya existe** como marca en software o deporte.
- [ ] Confirmar el hex exacto del rojo y el teal contra el manual de marca del club.
- [ ] Leer el NDA de finalistas **antes de firmarlo**, en la parte de propiedad intelectual (`docs/04` §5.3).
- [ ] Decidir quién presenta los 10 minutos y quién responde la parte técnica.
- [ ] **Subir las revisiones requeridas de `main` a 1** el día que entren los compañeros al repositorio (comando en el `README`).
