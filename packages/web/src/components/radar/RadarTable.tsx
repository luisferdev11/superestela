'use client'

import { useState } from 'react'
import { MetricValue } from '@/components/metric/MetricValue'
import { InconclusiveValue } from '@/components/metric/InconclusiveValue'
import { RoleChip } from '@/components/chip/RoleChip'
import { TrapFlag } from '@/components/chip/TrapFlag'
import { formatNumber, formatSigned } from '@/domain/format'
import { rankBy } from '@/domain/ranking'
import type { Environment, PitcherSeason } from '@/domain/types'
import { es } from '@/i18n/es'

/**
 * La unica isla de cliente de la pantalla, y lo mas abajo posible del arbol
 * (`CONVENTIONS.md` seccion 4, regla 5). La carga y el parseo del JSON se
 * quedan en el servidor; aqui solo se reordena lo que ya llego.
 */
export const RadarTable = ({ cards }: { readonly cards: readonly PitcherSeason[] }) => {
  const [environment, setEnvironment] = useState<Environment>('hh')
  const handleSortChange = (next: Environment) => () => {
    setEnvironment(next)
  }

  const rows = rankBy(cards, environment)

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-3">
        <span className="text-xs font-bold tracking-widest text-(--color-text-muted) uppercase">
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
                  ? 'bg-(--color-ink) px-4 py-2 text-xs font-semibold text-white'
                  : 'bg-(--color-surface-card) px-4 py-2 text-xs text-(--color-text)'
              }
            >
              {es.environment[option]}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full border-collapse bg-(--color-surface-card) text-sm">
        <thead>
          <tr>
            {es.columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`border-b border-(--color-border-strong) px-3 pb-2 text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase ${
                  index === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((card) => (
            <tr
              key={`${card.pitcherId}:${String(card.season)}`}
              className={
                card.altitudeTrap
                  ? 'bg-(--color-diablos-wash)'
                  : 'border-b border-(--color-border-hairline)'
              }
            >
              <td className="px-3 py-2">
                {card.pitcherId} <TrapFlag trap={card.altitudeTrap} />
              </td>
              <td className="px-3 py-2 text-right">{card.season}</td>
              <td className="px-3 py-2 text-right">{card.throws}</td>
              <td className="px-3 py-2 text-right">
                <MetricValue metric={card.stuffPlusHh} />
              </td>
              <td className="px-3 py-2 text-right text-(--color-text-muted)">
                {formatNumber(card.stuffPlusSea.value)}
              </td>
              <td className="px-3 py-2 text-right">{formatSigned(card.stuffPlusDelta)}</td>
              <td className="px-3 py-2 text-right">
                {card.altitudeTax === null ? (
                  <InconclusiveValue short />
                ) : (
                  <MetricValue metric={card.altitudeTax} digits={2} />
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <RoleChip role={card.role} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
