import { dominantPitch } from './arsenal'
import type { PitcherSeason, Role } from './types'

/**
 * Los filtros de la P1 (`docs/02` seccion 2): mano, rol, temporada y pitch
 * dominante, mas el de solo trampas.
 *
 * Cada categoria acepta **varios valores**, y dentro de una categoria se leen
 * como "o": temporada 2024 o 2025. Entre categorias se leen como "y": zurdo
 * **y** abridor. Es la unica combinacion que responde a las preguntas que un
 * scout hace de verdad — "zurdos con slider en las dos ultimas temporadas" no
 * se puede expresar eligiendo un valor por categoria.
 *
 * Funciones puras, fuera de los componentes (`CONVENTIONS.md` seccion 4,
 * regla 6), para que los tests no monten React.
 */
export type RadarFilters = {
  readonly throws: readonly string[]
  readonly role: readonly Role[]
  readonly season: readonly number[]
  readonly pitch: readonly string[]
  readonly trapsOnly: boolean
}

export const NO_FILTERS: RadarFilters = {
  throws: [],
  role: [],
  season: [],
  pitch: [],
  trapsOnly: false,
}

/** Las categorias que aceptan varios valores, para recorrerlas sin repetirlas. */
export type MultiKey = 'throws' | 'role' | 'season' | 'pitch'

export const isFiltered = (filters: RadarFilters): boolean =>
  filters.throws.length > 0 ||
  filters.role.length > 0 ||
  filters.season.length > 0 ||
  filters.pitch.length > 0 ||
  filters.trapsOnly

/** Una categoria vacia no restringe nada. */
const allows = <T>(selected: readonly T[], value: T | null): boolean =>
  selected.length === 0 || (value !== null && selected.includes(value))

export const applyFilters = (
  cards: readonly PitcherSeason[],
  filters: RadarFilters,
): readonly PitcherSeason[] =>
  cards.filter((card) => {
    if (!allows(filters.throws, card.throws)) return false
    if (!allows(filters.role, card.role)) return false
    if (!allows(filters.season, card.season)) return false
    if (filters.trapsOnly && !card.altitudeTrap) return false
    if (!allows(filters.pitch, dominantPitch(card)?.pitch ?? null)) return false
    return true
  })

/** Enciende o apaga un valor dentro de su categoria. */
export const toggleValue = <K extends MultiKey>(
  filters: RadarFilters,
  key: K,
  value: RadarFilters[K][number],
): RadarFilters => {
  const current = filters[key] as readonly RadarFilters[K][number][]
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
  return { ...filters, [key]: next }
}

/**
 * Cuantas filas quedarian si ademas se pulsara este valor. Es lo que permite
 * mostrar el conteo en cada chip y apagar los que llevan a una tabla vacia:
 * asi la combinacion se explora sin caer en callejones sin salida.
 */
export const countWith = <K extends MultiKey>(
  cards: readonly PitcherSeason[],
  filters: RadarFilters,
  key: K,
  value: RadarFilters[K][number],
): number => applyFilters(cards, toggleValue(filters, key, value)).length

export const countWithTrapsOnly = (
  cards: readonly PitcherSeason[],
  filters: RadarFilters,
): number => applyFilters(cards, { ...filters, trapsOnly: !filters.trapsOnly }).length

/** Los valores presentes en la cohorte, para no ofrecer un filtro que da cero. */
export const availableThrows = (cards: readonly PitcherSeason[]): readonly string[] =>
  [...new Set(cards.map((card) => card.throws))].sort()

export const availableSeasons = (cards: readonly PitcherSeason[]): readonly number[] =>
  [...new Set(cards.map((card) => card.season))].sort((a, b) => b - a)
