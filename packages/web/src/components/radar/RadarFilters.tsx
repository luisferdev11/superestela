'use client'

import { FilterChip, FilterDivider } from './FilterChip'
import { availableSeasons, availableThrows, isFiltered, NO_FILTERS } from '@/domain/filters'
import type { RadarFilters as Filters } from '@/domain/filters'
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
  // Cada chip alterna: pulsar el activo lo apaga. Un filtro que no se puede
  // quitar sin recargar es una trampa en una demo de diez minutos.
  const toggle =
    <K extends keyof Filters>(key: K, value: Filters[K]) =>
    () => {
      onFiltersChange({ ...filters, [key]: filters[key] === value ? NO_FILTERS[key] : value })
    }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="pr-1 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
        {es.filter}
      </span>

      <FilterChip
        label={es.all}
        active={!isFiltered(filters)}
        onToggle={() => {
          onFiltersChange(NO_FILTERS)
        }}
      />
      {availableThrows(cards).map((hand) => (
        <FilterChip
          key={hand}
          label={es.throws[hand] ?? hand}
          active={filters.throws === hand}
          onToggle={toggle('throws', hand)}
        />
      ))}

      <FilterDivider />
      {ROLES.map((role: Role) => (
        <FilterChip
          key={role}
          label={es.rolePlural[role]}
          active={filters.role === role}
          onToggle={toggle('role', role)}
        />
      ))}

      <FilterDivider />
      {availableSeasons(cards).map((season) => (
        <FilterChip
          key={season}
          label={String(season)}
          active={filters.season === season}
          onToggle={toggle('season', season)}
        />
      ))}

      <FilterDivider />
      {pitches.map((pitch) => (
        <FilterChip
          key={pitch}
          label={pitch}
          active={filters.pitch === pitch}
          onToggle={toggle('pitch', pitch)}
        />
      ))}

      <FilterDivider />
      <FilterChip
        label={es.trapsOnly}
        active={filters.trapsOnly}
        onToggle={toggle('trapsOnly', true)}
      />
    </div>
  )
}
