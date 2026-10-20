'use client'

import { useId } from 'react'
import {
  availablePitches,
  availableSeasons,
  availableThrows,
  hasUnknownRole,
  isFiltered,
  NO_FILTERS,
  type RadarFilters as Filters,
} from '@/domain/filters'
import { ROLES } from '@/domain/constants'
import type { PitcherSeason, Role } from '@/domain/types'
import { es } from '@/i18n/es'

const control =
  'h-8 border border-(--color-border-strong) bg-(--color-surface-card) px-2 text-[13px] text-(--color-text)'

/**
 * Los filtros del Radar como una barra clasica: un menu por categoria con
 * «Todos», una casilla, un buscador y «Limpiar filtros». Sustituye a los chips
 * de varios valores (14 de octubre): son los controles que cualquiera ya sabe
 * usar.
 */
export const RadarFilters = ({
  cards,
  filters,
  shown,
  onFiltersChange,
}: {
  readonly cards: readonly PitcherSeason[]
  readonly filters: Filters
  readonly shown: number
  readonly onFiltersChange: (next: Filters) => void
}) => {
  const ids = {
    pitch: useId(),
    throws: useId(),
    role: useId(),
    season: useId(),
    search: useId(),
  }
  const set = (patch: Partial<Filters>): void => {
    onFiltersChange({ ...filters, ...patch })
  }
  const label = (id: string, text: string) => (
    <label
      htmlFor={id}
      className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase"
    >
      {text}
    </label>
  )

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border border-(--color-border) bg-(--color-surface-card) px-4 py-3">
      <div className="flex flex-col gap-1">
        {label(ids.pitch, es.filterBar.pitch)}
        <select
          id={ids.pitch}
          className={control}
          value={filters.pitch ?? ''}
          onChange={(event) => {
            set({ pitch: event.target.value === '' ? null : event.target.value })
          }}
        >
          <option value="">{es.filterBar.all}</option>
          {availablePitches(cards).map(({ pitch, count }) => (
            <option key={pitch} value={pitch}>
              {es.filterBar.pitchOption(pitch, count)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        {label(ids.throws, es.filterBar.throws)}
        <select
          id={ids.throws}
          className={control}
          value={filters.throws ?? ''}
          onChange={(event) => {
            set({ throws: event.target.value === '' ? null : event.target.value })
          }}
        >
          <option value="">{es.filterBar.all}</option>
          {availableThrows(cards).map((hand) => (
            <option key={hand} value={hand}>
              {es.throws[hand] ?? hand}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        {label(ids.role, es.filterBar.role)}
        <select
          id={ids.role}
          className={control}
          value={filters.role ?? ''}
          onChange={(event) => {
            const value = event.target.value
            set({
              role:
                value === 'unknown' ? 'unknown' : (ROLES.find((r: Role) => r === value) ?? null),
            })
          }}
        >
          <option value="">{es.filterBar.all}</option>
          {ROLES.map((role: Role) => (
            <option key={role} value={role}>
              {es.rolePlural[role]}
            </option>
          ))}
          {hasUnknownRole(cards) ? <option value="unknown">{es.unknownRole}</option> : null}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        {label(ids.season, es.filterBar.season)}
        <select
          id={ids.season}
          className={control}
          value={filters.season === null ? '' : String(filters.season)}
          onChange={(event) => {
            set({ season: event.target.value === '' ? null : Number(event.target.value) })
          }}
        >
          <option value="">{es.filterBar.all}</option>
          {availableSeasons(cards).map((season) => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        {label(ids.search, es.filterBar.search)}
        <input
          id={ids.search}
          type="search"
          className={`${control} w-44`}
          placeholder={es.filterBar.searchPlaceholder}
          value={filters.query}
          onChange={(event) => {
            set({ query: event.target.value })
          }}
        />
      </div>

      <label className="flex h-8 items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={filters.trapsOnly}
          onChange={(event) => {
            set({ trapsOnly: event.target.checked })
          }}
        />
        {es.trapsOnly}
      </label>

      <div className="ml-auto flex h-8 items-center gap-3">
        <span className="text-[12px] text-(--color-text-muted)">
          {es.filterBar.results(shown, cards.length)}
        </span>
        <button
          type="button"
          disabled={!isFiltered(filters)}
          onClick={() => {
            onFiltersChange(NO_FILTERS)
          }}
          className="h-8 cursor-pointer border border-(--color-border-strong) bg-(--color-surface-card) px-3 text-[12px] font-semibold disabled:cursor-default disabled:opacity-40"
        >
          {es.filterBar.clear}
        </button>
      </div>
    </div>
  )
}
