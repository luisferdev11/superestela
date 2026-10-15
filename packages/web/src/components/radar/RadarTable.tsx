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
import { DEFAULT_RADAR_SORT, firstDirection, sortRadar, type RadarSortKey } from '@/domain/ranking'
import { nextSort, type SortState } from '@/domain/tableSort'
import { RadarGuide } from './RadarGuide'
import type { PitcherSeason } from '@/domain/types'
import type { ScaleKind } from '@/domain/scale'
import { es } from '@/i18n/es'

/**
 * Las columnas en el orden de `es.columns`, con la llave por la que se ordenan.
 * `null`: Mano, Rol y Pitch no se ordenan.
 */
const SORT_KEYS: readonly (RadarSortKey | null)[] = [
  'pitcher',
  'season',
  null,
  'hh',
  'sea',
  'delta',
  'tax',
  'kMinusBb',
  'whiff',
  null,
  null,
  'usage',
]

/** Pitcher, Rol y Pitch principal: las columnas de texto, por su posicion en `es.columns`. */
const LEFT_ALIGNED = new Set([0, 9, 10])

/** El encabezado de una columna con el pitch elegido: «Stuff+ Slider alt. extrema». */
const headerOf = (index: number, column: string, pitch: string | null): string => {
  if (pitch === null) return column
  if (index === 3) return es.pitchColumns.hh(pitch)
  if (index === 4) return es.pitchColumns.sea(pitch)
  if (index === 10) return es.pitchColumns.pitch
  return column
}

/**
 * La unica isla de cliente de la pantalla, y lo mas abajo posible del arbol
 * (`CONVENTIONS.md` seccion 4, regla 5). La carga y el parseo del JSON se
 * quedan en el servidor; aqui solo se filtra y se reordena lo que ya llego.
 *
 * Se ordena con un clic en el encabezado, como cualquier tabla: el primero en
 * el sentido natural de la columna, el segundo al reves (14 de octubre).
 */
export const RadarTable = ({
  cards,
  latestSeason,
  cohortSummary,
  scale = 'league',
}: {
  readonly cards: readonly PitcherSeason[]
  readonly latestSeason: number
  readonly cohortSummary: CohortSummary
  /** Como se define el 100 (`domain/scale.ts`): cambia la ayuda del Δ y la guia. */
  readonly scale?: ScaleKind
}) => {
  // La ayuda del Δ depende de la escala; las demas columnas no.
  const help = [...es.columnHelp.slice(0, 5), es.scale[scale].deltaHelp, ...es.columnHelp.slice(5)]
  const [sort, setSort] = useState<SortState<RadarSortKey>>(DEFAULT_RADAR_SORT)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  const handleFiltersChange = (next: Filters): void => {
    // Elegir otro pitch reinicia el orden a su Stuff+ en altitud extrema: es la pregunta.
    if (next.pitch !== filters.pitch) setSort(DEFAULT_RADAR_SORT)
    setFilters(next)
  }

  const matching = applyFilters(cards, filters)
  const rows = sortRadar(matching, sort, filters.pitch)
  const shown = summarize(matching)

  return (
    <div className="flex flex-col gap-4">
      <RadarSummary shown={shown} cohort={cohortSummary} filtered={isFiltered(filters)} />

      <RadarFilters
        cards={cards}
        filters={filters}
        shown={rows.length}
        onFiltersChange={handleFiltersChange}
      />

      <RadarGuide scale={scale} />

      <div className="border border-(--color-border) bg-(--color-surface-card) p-5">
        <p className="mb-1 text-[12px] text-(--color-text)">{es.taxExplainer}</p>
        <p className="mb-3 text-[11px] text-(--color-text-muted)">
          {filters.pitch === null ? es.sortHint : es.filterBar.pitchNote(filters.pitch)}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {es.columns.map((column, index) => {
                  const key = SORT_KEYS[index] ?? null
                  const isActive = key !== null && sort.key === key
                  const label = headerOf(index, column, filters.pitch)
                  const thClass = `border-b border-(--color-border-strong) px-2 pb-2 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase ${
                    LEFT_ALIGNED.has(index) ? 'text-left' : 'text-right'
                  } ${isActive ? 'text-(--color-ink)' : 'text-(--color-text-muted)'}`
                  return (
                    <th
                      key={column}
                      scope="col"
                      title={help[index]}
                      aria-sort={
                        isActive
                          ? sort.direction === 'desc'
                            ? 'descending'
                            : 'ascending'
                          : undefined
                      }
                      className={thClass}
                    >
                      {key === null ? (
                        label
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSort(nextSort(sort, key, firstDirection(key)))
                          }}
                          className="cursor-pointer border-0 bg-transparent p-0 text-inherit uppercase hover:underline"
                        >
                          {label}
                          <span aria-hidden="true" className="pl-1">
                            {isActive ? (sort.direction === 'desc' ? '▼' : '▲') : '↕'}
                          </span>
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {rows.map((card) => (
                <RadarRow
                  key={`${card.pitcherId}:${String(card.season)}`}
                  card={card}
                  latestSeason={latestSeason}
                  pitch={filters.pitch}
                />
              ))}
            </tbody>
          </table>
        </div>

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
