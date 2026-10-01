'use client'

import { useState } from 'react'
import { RadarRow } from './RadarRow'
import { RadarLegend } from './RadarLegend'
import { RadarFilters } from './RadarFilters'
import { RadarSummary } from './RadarSummary'
import {
  applyFilters,
  isFiltered,
  NO_FILTERS,
  type RadarFilters as Filters,
} from '@/domain/filters'
import { summarize, type CohortSummary } from '@/domain/cohort'
import { RADAR_SORTS, sortRadar, type RadarSort } from '@/domain/ranking'
import { RadarGuide } from './RadarGuide'
import type { PitcherSeason } from '@/domain/types'
import { es } from '@/i18n/es'

/** Pitcher, Rol y Pitch principal: las columnas de texto, por su posicion en `es.columns`. */
const LEFT_ALIGNED = new Set([0, 9, 10])

/**
 * La unica isla de cliente de la pantalla, y lo mas abajo posible del arbol
 * (`CONVENTIONS.md` seccion 4, regla 5). La carga y el parseo del JSON se
 * quedan en el servidor; aqui solo se reordena lo que ya llego.
 */
export const RadarTable = ({
  cards,
  latestSeason,
  cohortSummary,
  pitches,
}: {
  readonly cards: readonly PitcherSeason[]
  readonly latestSeason: number
  readonly cohortSummary: CohortSummary
  readonly pitches: readonly string[]
}) => {
  const [sort, setSort] = useState<RadarSort>('hh')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const handleSortChange = (next: RadarSort) => () => {
    setSort(next)
  }

  const matching = applyFilters(cards, filters)
  const rows = sortRadar(matching, sort)
  const shown = summarize(matching)

  return (
    <div className="flex flex-col gap-4">
      <RadarSummary shown={shown} cohort={cohortSummary} filtered={isFiltered(filters)} />

      <RadarFilters
        cards={cards}
        pitches={pitches}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <div className="flex items-center justify-end gap-3">
        <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
          {es.sortBy}
        </span>
        <div className="flex border border-(--color-border-strong)">
          {RADAR_SORTS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={handleSortChange(option)}
              aria-pressed={sort === option}
              className={
                sort === option
                  ? 'bg-(--color-ink) px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'bg-(--color-surface-card) px-3.5 py-1.5 text-xs text-(--color-text)'
              }
            >
              {es.radarSort[option]}
            </button>
          ))}
        </div>
      </div>

      <RadarGuide />

      <div className="border border-(--color-border) bg-(--color-surface-card) p-5">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {es.columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  title={es.columnHelp[index]}
                  className={`border-b border-(--color-border-strong) px-3 pb-2 text-[10px] font-bold tracking-wider whitespace-nowrap text-(--color-text-muted) uppercase ${
                    LEFT_ALIGNED.has(index) ? 'text-left' : 'text-right'
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {rows.map((card) => (
              <RadarRow
                key={`${card.pitcherId}:${String(card.season)}`}
                card={card}
                latestSeason={latestSeason}
              />
            ))}
          </tbody>
        </table>

        {/* El estado vacio, uno de los cuatro de docs/07 seccion 5.2 regla 3. */}
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-(--color-text-muted)">{es.noMatches}</p>
        ) : null}

        <RadarLegend
          shown={rows.length}
          total={cards.length}
          significant={shown.nConclusiveTax}
          significantOver={rows.length}
        />
      </div>
    </div>
  )
}
