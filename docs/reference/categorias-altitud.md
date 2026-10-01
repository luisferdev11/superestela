# Las categorías de altitud del dataset

> Fuente: Emilio (analista de Diablos) en el Q&A del **30 de septiembre de 2026**, transcrito. Diablos
> va a compartir una imagen con los rangos y los equipos: cuando llegue, se guarda junto a este
> archivo y manda sobre este texto.

| `altitude_category` | Rango | Ciudades que mencionó |
|---|---|---|
| `No Altitude` | 0 a 700 m sobre el nivel del mar | (las listó en la imagen) |
| `Medium Altitude` | 800 a 1,600 m | Oaxaca, entre otras |
| `Extreme Altitude` | de ahí en adelante | **Puebla, Ciudad de México, Aguascalientes, Querétaro y León** |

## Lo que implica para el producto

- **«Altitud extrema» no es el Harp Helú: son cinco parques.** La densidad de 0.858 y todo lo que la
  app llama «Stuff+ HH» es el promedio de esos cinco. El dataset no trae el ID del estadio, así que
  no se puede separar el Harp Helú de los otros cuatro.
- **Decisión del usuario (1 oct): nombre híbrido.** En cifras, columnas y tablas se dice «altitud
  extrema». «Harp Helú» se queda solo en la narrativa (deck, historias), donde se habla de la casa de
  Diablos, que es uno de los cinco.
- **El plantel aproximado (ADR 0008) mezcla lanzadores de cinco equipos.** P6 y P8 quedan como
  pantallas demostrativas, declaradas así.
- El hueco entre 700 y 800 m no se explicó; probablemente ningún parque cae ahí.
