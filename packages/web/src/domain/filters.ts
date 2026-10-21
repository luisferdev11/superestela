import type { Metric, PitcherSeason, Role } from './types'

/**
 * Los filtros de la P1 (`docs/02` seccion 2), como una barra clasica de menus:
 * un valor por categoria, o «Todos». Entre categorias se leen como "y": zurdo
 * **y** abridor **y** con slider. Se cambiaron de chips de varios valores a
 * menus el 14 de octubre: el equipo los encontraba confusos.
 *
 * El tipo de pitch **no es el dominante**: elegir Slider deja a todos los que
 * tiran slider (con muestra en altitud extrema), y la tabla pasa a mostrar el
 * Stuff+ de ese pitch (`domain/ranking.ts`, `focusOf`).
 *
 * Funciones puras, fuera de los componentes (`CONVENTIONS.md` seccion 4,
 * regla 6), para que los tests no monten React.
 */
/**
 * A role, or `unknown` for the pitchers the rule could not classify (`role:
 * null`): they are in the table as «Sin rol», so the filter must reach them.
 */
export type RoleFilter = Role | 'unknown'

/**
 * Location+ in extreme altitude against 100, its type's average: above, below,
 * or anyone. A pitcher without Location+ only passes «Todos».
 */
export type LocationFilter = 'above' | 'below'

export type RadarFilters = {
  readonly throws: string | null
  readonly role: RoleFilter | null
  readonly season: number | null
  readonly pitch: string | null
  readonly trapsOnly: boolean
  readonly locationPlus: LocationFilter | null
  /** Parte del id del lanzador, sin distinguir mayusculas. */
  readonly query: string
}

export const NO_FILTERS: RadarFilters = {
  throws: null,
  role: null,
  season: null,
  pitch: null,
  trapsOnly: false,
  locationPlus: null,
  query: '',
}

export const isFiltered = (filters: RadarFilters): boolean =>
  filters.throws !== null ||
  filters.role !== null ||
  filters.season !== null ||
  filters.pitch !== null ||
  filters.trapsOnly ||
  filters.locationPlus !== null ||
  filters.query.trim() !== ''

/** Si el lanzador tira ese pitch: esta en su arsenal, que exige muestra en altitud extrema. */
export const throwsPitch = (card: PitcherSeason, pitch: string): boolean =>
  card.arsenal.some((entry) => entry.pitch === pitch)

const passesLocation = (value: Metric | null | undefined, filter: LocationFilter): boolean =>
  value != null && (filter === 'above' ? value.value >= 100 : value.value < 100)

export const applyFilters = <T extends PitcherSeason & { readonly locationPlusHh?: Metric | null }>(
  cards: readonly T[],
  filters: RadarFilters,
): readonly T[] => {
  const query = filters.query.trim().toLowerCase()
  return cards.filter((card) => {
    if (filters.throws !== null && card.throws !== filters.throws) return false
    if (filters.role !== null && (card.role ?? 'unknown') !== filters.role) return false
    if (filters.season !== null && card.season !== filters.season) return false
    if (filters.trapsOnly && !card.altitudeTrap) return false
    if (filters.pitch !== null && !throwsPitch(card, filters.pitch)) return false
    if (filters.locationPlus !== null && !passesLocation(card.locationPlusHh, filters.locationPlus))
      return false
    if (query !== '' && !card.pitcherId.toLowerCase().includes(query)) return false
    return true
  })
}

/** Whether anyone in the cohort has no role: only then is «Sin rol» offered. */
export const hasUnknownRole = (cards: readonly PitcherSeason[]): boolean =>
  cards.some((card) => card.role === null)

/** Los valores presentes en la cohorte, para no ofrecer un filtro que da cero. */
export const availableThrows = (cards: readonly PitcherSeason[]): readonly string[] =>
  [...new Set(cards.map((card) => card.throws))].sort()

export const availableSeasons = (cards: readonly PitcherSeason[]): readonly number[] =>
  [...new Set(cards.map((card) => card.season))].sort((a, b) => b - a)

/** Cada tipo de pitch con cuantos lanzadores de la cohorte lo tiran, del mas al menos tirado. */
export const availablePitches = (
  cards: readonly PitcherSeason[],
): readonly { readonly pitch: string; readonly count: number }[] => {
  const counts = new Map<string, number>()
  for (const card of cards) {
    for (const entry of card.arsenal) counts.set(entry.pitch, (counts.get(entry.pitch) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pitch, count]) => ({ pitch, count }))
}
