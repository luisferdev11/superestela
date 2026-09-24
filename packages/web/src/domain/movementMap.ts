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
 * su tipo, y medir el panel del Harp Helu contra su propia media esconderia
 * justo lo que la altura le hace a todo el tipo.
 */
export const relativeWhiff = (cell: MapCell, reference: number): number =>
  cell.whiffPerSwing - reference

/**
 * Una sola escala, simetrica, para los dos paneles del mismo tipo: el mismo
 * tono significa lo mismo a nivel del mar y en el Harp Helu.
 */
export const sharedWhiffRange = (panels: readonly MapPanel[], reference: number): number => {
  const spreads = panels.flatMap((p) => p.cells.map((c) => Math.abs(relativeWhiff(c, reference))))
  return spreads.length === 0 ? 0 : Math.max(...spreads)
}
