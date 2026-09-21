import type { PitcherSeason } from './types'

/**
 * Las tres codificaciones visuales de la tabla, como decisiones de dominio y no
 * como ternarios sueltos dentro del JSX. Cada una tiene su motivo escrito y su
 * test; ninguna depende solo del color (`docs/02` seccion 1, semanticos).
 */

/** Delta grande. El umbral sale del prototipo y es el que marca en rojo. */
export const LARGE_DELTA = -10

export const hasLargeDelta = (card: PitcherSeason): boolean => card.stuffPlusDelta <= LARGE_DELTA

/**
 * Un candidato visto por ultima vez antes de la temporada mas reciente del
 * dataset no es comparable con uno de este ano, y la tabla no puede dejar que
 * eso pase inadvertido.
 */
export const isStaleSeason = (card: PitcherSeason, latestSeason: number): boolean =>
  card.season < latestSeason
