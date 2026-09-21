import { dominantPitch } from './arsenal'
import type { PitcherSeason, Role } from './types'

/**
 * Los filtros de la P1 (`docs/02` seccion 2): mano, rol, temporada y pitch
 * dominante, mas el de solo trampas. Funciones puras, fuera de los componentes
 * (`CONVENTIONS.md` seccion 4, regla 6), para que el test no monte React.
 */
export type RadarFilters = {
  readonly throws: string | null
  readonly role: Role | null
  readonly season: number | null
  readonly pitch: string | null
  readonly trapsOnly: boolean
}

export const NO_FILTERS: RadarFilters = {
  throws: null,
  role: null,
  season: null,
  pitch: null,
  trapsOnly: false,
}

export const isFiltered = (filters: RadarFilters): boolean =>
  filters.throws !== null ||
  filters.role !== null ||
  filters.season !== null ||
  filters.pitch !== null ||
  filters.trapsOnly

export const applyFilters = (
  cards: readonly PitcherSeason[],
  filters: RadarFilters,
): readonly PitcherSeason[] =>
  cards.filter((card) => {
    if (filters.throws !== null && card.throws !== filters.throws) return false
    if (filters.role !== null && card.role !== filters.role) return false
    if (filters.season !== null && card.season !== filters.season) return false
    if (filters.trapsOnly && !card.altitudeTrap) return false
    if (filters.pitch !== null && dominantPitch(card)?.pitch !== filters.pitch) return false
    return true
  })

/** Los valores presentes en la cohorte, para no ofrecer un filtro que da cero. */
export const availableThrows = (cards: readonly PitcherSeason[]): readonly string[] =>
  [...new Set(cards.map((card) => card.throws))].sort()

export const availableSeasons = (cards: readonly PitcherSeason[]): readonly number[] =>
  [...new Set(cards.map((card) => card.season))].sort((a, b) => b - a)
