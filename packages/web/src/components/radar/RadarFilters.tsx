'use client'

import { FilterChip, FilterDivider } from './FilterChip'
import {
  availableSeasons,
  availableThrows,
  countWith,
  countWithTrapsOnly,
  isFiltered,
  NO_FILTERS,
  toggleValue,
  type MultiKey,
  type RadarFilters as Filters,
} from '@/domain/filters'
import { ROLES } from '@/domain/constants'
import type { PitcherSeason, Role } from '@/domain/types'
import { es } from '@/i18n/es'

export const RadarFilters = ({
  cards,
  pitches,
  filters,
  onFiltersChange,
}: {
  readonly cards: readonly PitcherSeason[]
  readonly pitches: readonly string[]
  readonly filters: Filters
  readonly onFiltersChange: (next: Filters) => void
}) => {
  const chip = <K extends MultiKey>(key: K, value: Filters[K][number], label: string) => (
    <FilterChip
      key={`${key}:${String(value)}`}
      label={label}
      active={(filters[key] as readonly Filters[K][number][]).includes(value)}
      count={countWith(cards, filters, key, value)}
      onToggle={() => {
        onFiltersChange(toggleValue(filters, key, value))
      }}
    />
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="pr-1 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
        {es.filter}
      </span>

      <FilterChip
        label={es.all}
        active={!isFiltered(filters)}
        count={cards.length}
        onToggle={() => {
          onFiltersChange(NO_FILTERS)
        }}
      />
      {availableThrows(cards).map((hand) => chip('throws', hand, es.throws[hand] ?? hand))}

      <FilterDivider />
      {ROLES.map((role: Role) => chip('role', role, es.rolePlural[role]))}

      <FilterDivider />
      {availableSeasons(cards).map((season) => chip('season', season, String(season)))}

      <FilterDivider />
      {pitches.map((pitch) => chip('pitch', pitch, pitch))}

      <FilterDivider />
      <FilterChip
        label={es.trapsOnly}
        active={filters.trapsOnly}
        count={countWithTrapsOnly(cards, filters)}
        onToggle={() => {
          onFiltersChange({ ...filters, trapsOnly: !filters.trapsOnly })
        }}
      />
    </div>
  )
}
