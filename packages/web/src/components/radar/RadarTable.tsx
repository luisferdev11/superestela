'use client'

import { useState } from 'react'
import { RadarRow } from './RadarRow'
import { RadarLegend } from './RadarLegend'
import { rankBy } from '@/domain/ranking'
import type { Environment, PitcherSeason } from '@/domain/types'
import { es } from '@/i18n/es'

/**
 * La unica isla de cliente de la pantalla, y lo mas abajo posible del arbol
 * (`CONVENTIONS.md` seccion 4, regla 5). La carga y el parseo del JSON se
 * quedan en el servidor; aqui solo se reordena lo que ya llego.
 */
export const RadarTable = ({
  cards,
  latestSeason,
  significant,
}: {
  readonly cards: readonly PitcherSeason[]
  readonly latestSeason: number
  readonly significant: number
}) => {
  const [environment, setEnvironment] = useState<Environment>('hh')
  const handleSortChange = (next: Environment) => () => {
    setEnvironment(next)
  }

  const rows = rankBy(cards, environment)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
          {es.sortBy}
        </span>
        <div className="flex border border-(--color-border-strong)">
          {(['hh', 'sea'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={handleSortChange(option)}
              aria-pressed={environment === option}
              className={
                environment === option
                  ? 'bg-(--color-ink) px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'bg-(--color-surface-card) px-3.5 py-1.5 text-xs text-(--color-text)'
              }
            >
              {es.environment[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-(--color-border) bg-(--color-surface-card) p-5">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {es.columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`border-b border-(--color-border-strong) px-3 pb-2 text-[10px] font-bold tracking-wider whitespace-nowrap text-(--color-text-muted) uppercase ${
                    index === 0 || index === 7 || index === 8 ? 'text-left' : 'text-right'
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

        <RadarLegend
          shown={rows.length}
          total={cards.length}
          significant={significant}
          significantOver={cards.length}
        />
      </div>
    </div>
  )
}
