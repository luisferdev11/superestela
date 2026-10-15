import { sortRows, type SortDirection, type SortState, type SortValue } from './tableSort'
import type { Metric } from './types'

/**
 * La tabla del Traductor con varios lanzadores (14 de octubre): una fila por
 * lanzador del archivo, sin pitch principal ni filtro por tipo. Funciones
 * puras, fuera del componente (`CONVENTIONS.md` seccion 4, regla 6).
 */

/** Lo que la tabla necesita de cada lanzador; la API da el error estandar, no la banda. */
export type ScoredPitcher = {
  readonly pitcherId: string
  readonly pitcherHand: string
  readonly n: number
  readonly stuffPlusSea: Metric | null
  readonly stuffPlusHh: Metric | null
  readonly altitudeDelta: Metric | null
  readonly projectedTax: Metric | null
  readonly whiffPerSwing: { readonly value: number; readonly ci95: number } | null
}

export const MANY_SORT_KEYS = ['pitcher', 'n', 'sea', 'hh', 'delta', 'whiff', 'tax'] as const
export type ManySortKey = (typeof MANY_SORT_KEYS)[number]

export const DEFAULT_MANY_SORT: SortState<ManySortKey> = { key: 'hh', direction: 'desc' }

export const firstManyDirection = (key: ManySortKey): SortDirection =>
  key === 'pitcher' ? 'asc' : 'desc'

/** 1.96 errores estandar: la banda al 95%, la unica convencion del «±» (`docs/12` §2.1). */
const Z95 = 1.96

/** Un error estandar de la API como la banda al 95% que muestra la pantalla. */
export const toBand95 = (metric: Metric | null): Metric | null =>
  metric === null ? null : { value: metric.value, se: Z95 * metric.se }

const valueOf =
  (key: ManySortKey) =>
  (p: ScoredPitcher): SortValue => {
    switch (key) {
      case 'pitcher':
        return p.pitcherId
      case 'n':
        return p.n
      case 'sea':
        return p.stuffPlusSea?.value ?? null
      case 'hh':
        return p.stuffPlusHh?.value ?? null
      case 'delta':
        return p.altitudeDelta?.value ?? null
      case 'whiff':
        return p.whiffPerSwing?.value ?? null
      case 'tax':
        return p.projectedTax?.value ?? null
    }
  }

export type ManyFilters = { readonly hand: string | null; readonly query: string }

export const NO_MANY_FILTERS: ManyFilters = { hand: null, query: '' }

/** Filtra por mano y por parte del id, y ordena por la columna pedida (los `null` al final). */
export const viewOf = <T extends ScoredPitcher>(
  pitchers: readonly T[],
  filters: ManyFilters,
  sort: SortState<ManySortKey>,
): readonly T[] => {
  const query = filters.query.trim().toLowerCase()
  const kept = pitchers.filter(
    (p) =>
      (filters.hand === null || p.pitcherHand === filters.hand) &&
      (query === '' || p.pitcherId.toLowerCase().includes(query)),
  )
  return sortRows(kept, valueOf(sort.key), sort.direction)
}
