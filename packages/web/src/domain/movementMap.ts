import type { Environment } from './types'
import type { PitchType } from './simulator'

/**
 * El mapa que el reto pide por nombre: «el mapa de movimiento de los pitches
 * mas y menos efectivos» (`docs/09` seccion 3.10). Es whiff por swing
 * observado sobre el plano de break, no una salida del modelo, asi que no
 * espera a A1.
 */

export type MapCell = {
  readonly ivb: number
  readonly horizontalBreak: number
  readonly swings: number
  /** Ya encogido hacia la media del tipo en `analysis/simulator_evidence.py`. */
  readonly whiffPerSwing: number
}

export type MapExtreme = {
  readonly pitcherId: string
  readonly season: number
  readonly tier: 'most' | 'least'
  readonly ivb: number
  readonly horizontalBreak: number
  readonly whiffPerSwing: number
}

export type MapPanel = {
  readonly binIn: number
  readonly meanWhiffPerSwing: number
  readonly cells: readonly MapCell[]
  readonly extremes: readonly MapExtreme[]
}

export type MovementMaps = Readonly<Record<PitchType, Readonly<Record<Environment, MapPanel>>>>

/**
 * Cuantos puntos de whiff por encima o por debajo de la referencia trae la
 * celda. La referencia es la media **a nivel del mar** del tipo, para los dos
 * paneles: el reto pregunta que pitches son mas y menos efectivos entre los de
 * su tipo, y medir el panel de altitud extrema contra su propia media esconderia
 * justo lo que la altura le hace a todo el tipo.
 */
export const relativeWhiff = (cell: MapCell, reference: number): number =>
  cell.whiffPerSwing - reference

/**
 * Una sola escala, simetrica, para los dos paneles del mismo tipo: el mismo
 * tono significa lo mismo a nivel del mar y en altitud extrema.
 */
export const sharedWhiffRange = (panels: readonly MapPanel[], reference: number): number => {
  const spreads = panels.flatMap((p) => p.cells.map((c) => Math.abs(relativeWhiff(c, reference))))
  return spreads.length === 0 ? 0 : Math.max(...spreads)
}

/** La celda del mapa donde cae una forma, o `null` si ahi no hay muestra. */
export const cellAt = (panel: MapPanel, ivb: number, horizontalBreak: number): MapCell | null => {
  const half = panel.binIn / 2
  return (
    panel.cells.find(
      (c) =>
        Math.abs(c.ivb - ivb) <= half &&
        Math.abs(c.horizontalBreak - horizontalBreak) <= half &&
        // El borde superior pertenece a la celda siguiente, como en el binning de Python.
        ivb < c.ivb + half &&
        horizontalBreak < c.horizontalBreak + half,
    ) ?? null
  )
}

export type Extent = {
  readonly hbMin: number
  readonly hbMax: number
  readonly ivbMin: number
  readonly ivbMax: number
}

/**
 * Un solo encuadre para los dos paneles, que contiene todas las celdas y las
 * formas marcadas. Cuadrado en pulgadas: una pulgada de break mide lo mismo en
 * horizontal y en vertical, o el mapa miente sobre la forma.
 */
export const sharedExtent = (
  panels: readonly MapPanel[],
  points: readonly { readonly ivb: number; readonly horizontalBreak: number }[],
  padding = 2,
): Extent => {
  const xs = [
    ...panels.flatMap((p) =>
      p.cells.flatMap((c) => [c.horizontalBreak - p.binIn / 2, c.horizontalBreak + p.binIn / 2]),
    ),
    ...points.map((p) => p.horizontalBreak),
  ]
  const ys = [
    ...panels.flatMap((p) => p.cells.flatMap((c) => [c.ivb - p.binIn / 2, c.ivb + p.binIn / 2])),
    ...points.map((p) => p.ivb),
  ]
  const x0 = Math.min(...xs) - padding
  const x1 = Math.max(...xs) + padding
  const y0 = Math.min(...ys) - padding
  const y1 = Math.max(...ys) + padding
  const side = Math.max(x1 - x0, y1 - y0)
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return {
    hbMin: cx - side / 2,
    hbMax: cx + side / 2,
    ivbMin: cy - side / 2,
    ivbMax: cy + side / 2,
  }
}
