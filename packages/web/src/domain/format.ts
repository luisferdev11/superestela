import { MIN_PITCHES_FOR_SCORE } from './constants'
import type { Metric, PitcherSeason } from './types'

/**
 * El formateo de cifras, fuera de los componentes (`CONVENTIONS.md` seccion 4,
 * regla 6). Aqui viven dos reglas del `README` que no son presentacion sino
 * producto, y por eso se prueban.
 */

/** Menos negativo tipografico, no guion. */
const MINUS = '−'

export const formatNumber = (value: number, digits = 1): string => {
  const text = Math.abs(value).toFixed(digits)
  return value < 0 ? `${MINUS}${text}` : text
}

export const formatSigned = (value: number, digits = 1): string =>
  value < 0 ? formatNumber(value, digits) : `+${formatNumber(value, digits)}`

/** Un numero nunca sale solo: siempre `valor ± banda`. */
export const formatMetric = (metric: Metric, digits = 1): string =>
  `${formatNumber(metric.value, digits)} ± ${formatNumber(metric.se, digits)}`

/**
 * Debajo del umbral, en cualquiera de los dos entornos, no hay cifra: hay
 * "muestra insuficiente". `README`, regla 4.
 */
export const hasSufficientSample = (card: {
  readonly nPitchesHh: number
  readonly nPitchesSea: number
}): boolean => Math.min(card.nPitchesHh, card.nPitchesSea) >= MIN_PITCHES_FOR_SCORE

/** El impuesto ya llega en `null` cuando no es significativo (ver el adaptador). */
export const isTaxConclusive = (card: Pick<PitcherSeason, 'altitudeTax'>): boolean =>
  card.altitudeTax !== null
