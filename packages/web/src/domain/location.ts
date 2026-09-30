/**
 * El contrato de la ubicacion que la pestana Arsenal de la Ficha espera del
 * equipo de datos (`docs/11`). Vista del catcher: `side` en pies, positivo
 * hacia la derecha del catcher; `height` en pies sobre el suelo.
 */
export type LocationPanel = {
  readonly nPitches: number
  readonly meanPlateHeightFt: number
  /** Entre 0 y 1. */
  readonly zoneShare: number
  /** Entre 0 y 1. */
  readonly whiffPerSwing: number
  /** Densidad por celda, filas de arriba abajo; cada fila de izquierda a derecha. */
  readonly grid: readonly (readonly number[])[]
  readonly sideRangeFt: readonly [number, number]
  readonly heightRangeFt: readonly [number, number]
}

export type PitcherLocation = {
  readonly sea: LocationPanel | null
  readonly hh: LocationPanel | null
}

/** Llave de `locations.json`, la misma de `arsenals.json`. */
export const locationKey = (pitcherId: string, season: number): string =>
  `${pitcherId}/${String(season)}`

/**
 * La zona de strike de referencia que se dibuja en el mapa, en pies: 17
 * pulgadas de plato y la altura promedio de la zona. Es un marco para leer el
 * mapa, no la zona de cada bateador.
 */
export const STRIKE_ZONE = { side: [-0.708, 0.708], height: [1.5, 3.5] } as const

/** La celda mas densa vale 1; asi los dos entornos se comparan con la misma escala de color. */
export const sharedMax = (panels: readonly (LocationPanel | null)[]): number =>
  Math.max(1e-9, ...panels.flatMap((p) => (p === null ? [] : p.grid.flat())))
