import type { Environment } from './types'

/**
 * El aire medido. `docs/02` seccion 3 lo llama elemento de marca: la barra es
 * la procedencia del numero, no un adorno. Los tres entornos salen de
 * `analysis/evidence.py`; ninguno se escribe a mano.
 */
export type DensityLevel = {
  readonly label: string
  readonly densityRatio: number
  readonly magnusRatio: number
  readonly nPitches: number
}

export type DensityScale = {
  readonly levels: readonly DensityLevel[]
  readonly sea: DensityLevel
  readonly extreme: DensityLevel
}

/** El orden es de mas denso a menos: nivel del mar primero, altitud extrema al final. */
export const orderByDensity = (levels: readonly DensityLevel[]): readonly DensityLevel[] =>
  [...levels].sort((a, b) => b.densityRatio - a.densityRatio)

/**
 * Donde cae un entorno dentro de la escala, de 0 (el mas ligero medido) a 1 (el
 * mas denso). Es lo que posiciona el marcador de la barra.
 */
export const positionInScale = (scale: DensityScale, environment: Environment): number => {
  const ordered = orderByDensity(scale.levels)
  const densest = ordered[0]
  const lightest = ordered[ordered.length - 1]
  if (densest === undefined || lightest === undefined) return 0

  const span = densest.densityRatio - lightest.densityRatio
  if (span === 0) return 0

  const target = environment === 'sea' ? scale.sea : scale.extreme
  return (target.densityRatio - lightest.densityRatio) / span
}
