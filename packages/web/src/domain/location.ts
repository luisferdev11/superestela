import type { Metric } from './types'

/**
 * El contrato de la ubicacion que la pestana Arsenal de la Ficha espera del
 * equipo de datos (`docs/11`). Vista del catcher: `side` en pies, positivo
 * hacia la derecha del catcher; `height` en pies sobre el suelo.
 */
export type LocationPanel = {
  readonly nPitches: number
  readonly meanPlateHeightFt: number
  /** Desviacion estandar de la altura en el plato, para la banda del cambio entre entornos. */
  readonly plateHeightSdFt: number
  /** Entre 0 y 1. */
  readonly zoneShare: number
  /** Entre 0 y 1. */
  readonly whiffPerSwing: number
  /** Location+ de datos (L3) con su banda al 95%; null sin modelo o sin muestra. */
  readonly locationPlus: Metric | null
  /** Densidad por celda, filas de arriba abajo; cada fila de izquierda a derecha. */
  readonly grid: readonly (readonly number[])[]
  readonly sideRangeFt: readonly [number, number]
  readonly heightRangeFt: readonly [number, number]
}

/** Un mapa como conteos enteros por celda, con el mismo marco que `LocationPanel`. */
export type CountMap = {
  readonly nPitches: number
  readonly counts: readonly (readonly number[])[]
  /** Location+ de esos lanzamientos, con su banda al 95%; null debajo del minimo. */
  readonly locationPlus: Metric | null
}

/** Un tipo de pitch: donde lo pone en cada entorno; null con menos de 15 alli. */
export type PitchMaps = {
  readonly sea: CountMap | null
  readonly hh: CountMap | null
}

/**
 * Donde caen sus pitches mas efectivos de un tipo (abanicados y los que
 * sacaron el out) y los menos (hits, bases por bolas y golpeados), con los
 * dos entornos juntos: conteo de lo que paso, no modelo.
 */
export type PitchEffectiveness = {
  readonly most: CountMap
  readonly least: CountMap
}

export type PitcherLocation = {
  readonly sea: LocationPanel | null
  readonly hh: LocationPanel | null
  readonly pitches: Readonly<Record<string, PitchMaps>>
}

/** Los conteos como proporcion del total, como el `grid` de los paneles. */
export const countShares = (map: CountMap): readonly (readonly number[])[] => {
  const total = Math.max(
    1,
    map.counts.flat().reduce((a, b) => a + b, 0),
  )
  return map.counts.map((row) => row.map((v) => v / total))
}

const INCHES_PER_FOOT = 12

/**
 * The mean plate height in inches: the rest of the Arsenal tab (break, the
 * reading of how much it changes) speaks inches, so one unit on the screen.
 */
export const meanPlateHeightIn = (panel: LocationPanel): number =>
  INCHES_PER_FOOT * panel.meanPlateHeightFt

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

/** 1.96: la banda al 95% que usan todas las pantallas. */
const Z95 = 1.96

/** Un cambio de la altitud extrema contra el nivel del mar, con su banda al 95%. */
export type LocationChange = { readonly value: number; readonly ci95: number }

export type LocationReading = {
  /** Pulgadas que sube (positivo) o baja su altura media en el plato. */
  readonly heightIn: LocationChange
  /** Puntos porcentuales de lanzamientos en zona. */
  readonly zonePp: LocationChange
  readonly verdict: 'overcompensates' | 'higher' | 'losesZone' | 'noChange'
}

const isClear = (c: LocationChange): boolean => Math.abs(c.value) > c.ci95

/**
 * Lo que dice su ubicacion al subir: si apunta mas alto y si pierde la zona.
 * La pregunta del cuerpo tecnico es si un lanzador «sobrecompensa» la altura
 * con la mira (`docs/10`). Solo se afirma un cambio cuando sale de su banda
 * al 95%; si no, la lectura dice que no se distingue del ruido.
 */
export const readLocation = (sea: LocationPanel, hh: LocationPanel): LocationReading => {
  const heightIn = {
    value: 12 * (hh.meanPlateHeightFt - sea.meanPlateHeightFt),
    ci95:
      12 *
      Z95 *
      Math.sqrt(hh.plateHeightSdFt ** 2 / hh.nPitches + sea.plateHeightSdFt ** 2 / sea.nPitches),
  }
  const share = (p: LocationPanel): number => (p.zoneShare * (1 - p.zoneShare)) / p.nPitches
  const zonePp = {
    value: 100 * (hh.zoneShare - sea.zoneShare),
    ci95: 100 * Z95 * Math.sqrt(share(hh) + share(sea)),
  }
  const higher = isClear(heightIn) && heightIn.value > 0
  const losesZone = isClear(zonePp) && zonePp.value < 0
  const verdict =
    higher && losesZone
      ? 'overcompensates'
      : higher
        ? 'higher'
        : losesZone
          ? 'losesZone'
          : 'noChange'
  return { heightIn, zonePp, verdict }
}
