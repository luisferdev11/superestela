import type { Environment, PitcherSeason } from './types'

/**
 * Ordenar por el entorno que se mira. Cambiar de `hh` a `sea` **reordena la
 * lista visiblemente**, y ese contraste es la demostracion del producto en un
 * clic (`docs/02` seccion 2, P1). Un test lo fija con la correlacion de rangos,
 * para que si el modelo final aplana el efecto nos enteremos aqui.
 */
export const scoreIn = (card: PitcherSeason, environment: Environment): number =>
  environment === 'hh' ? card.stuffPlusHh.value : card.stuffPlusSea.value

export const rankBy = (
  cards: readonly PitcherSeason[],
  environment: Environment,
): readonly PitcherSeason[] =>
  [...cards].sort((a, b) => scoreIn(b, environment) - scoreIn(a, environment))

/** Correlacion de rangos de Spearman entre los dos ordenes. */
export const rankCorrelation = (cards: readonly PitcherSeason[]): number => {
  const n = cards.length
  if (n < 2) return 1

  const rank = (environment: Environment): Map<string, number> =>
    new Map(rankBy(cards, environment).map((card, index) => [key(card), index]))

  const hh = rank('hh')
  const sea = rank('sea')
  const sumSquared = cards.reduce((total, card) => {
    const difference = (hh.get(key(card)) ?? 0) - (sea.get(key(card)) ?? 0)
    return total + difference * difference
  }, 0)

  return 1 - (6 * sumSquared) / (n * (n * n - 1))
}

const key = (card: PitcherSeason): string => `${card.pitcherId}:${String(card.season)}`
