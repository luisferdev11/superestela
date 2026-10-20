'use client'

import Link from 'next/link'
import { Fragment, useState } from 'react'
import { TrapFlag, TrapLegend } from '@/components/chip/TrapFlag'
import { MetricValue } from '@/components/metric/MetricValue'
import { hasLargeDelta } from '@/domain/emphasis'
import { dominantPitch } from '@/domain/arsenal'
import { formatSigned } from '@/domain/format'
import { fichaHref } from '@/domain/pitcher'
import { rosterRows, type RosterGrouping } from '@/domain/roster'
import type { PitcherSeason, SeasonEntry } from '@/domain/types'
import { es } from '@/i18n/es'

const GROUPINGS: readonly RosterGrouping[] = ['role', 'all']
const base = 'border-b border-(--color-border-hairline) px-3 py-2 tabular-nums'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

/**
 * La isla de P8: la misma tabla agrupada por rol o de corrido. Las filas las
 * arma `domain/roster.ts`; aqui solo se dibujan.
 */
export const Plantel = ({
  ids,
  cards,
  seasons,
  latestSeason,
}: {
  readonly ids: readonly string[]
  readonly cards: readonly PitcherSeason[]
  /** Serializable: la trayectoria de cada lanzador del plantel. */
  readonly seasons: Readonly<Record<string, readonly SeasonEntry[]>>
  readonly latestSeason: number
}) => {
  const [grouping, setGrouping] = useState<RosterGrouping>('role')
  const rows = rosterRows(ids, cards, new Map(Object.entries(seasons)), grouping)
  const scored = rows.filter((r) => r.card !== null).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-3">
        <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
          {es.plantel.groupBy}
        </span>
        <div className="flex border border-(--color-ink)">
          {GROUPINGS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={g === grouping}
              onClick={() => {
                setGrouping(g)
              }}
              className={
                g === grouping
                  ? 'cursor-pointer border-0 bg-(--color-ink) px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'cursor-pointer border-0 bg-(--color-surface-card) px-3.5 py-1.5 text-xs'
              }
            >
              {es.plantel.groupings[g]}
            </button>
          ))}
        </div>
      </div>
      <section className="border border-(--color-border) bg-(--color-surface-card) p-5">
        <div className="mb-3">
          <TrapLegend />
        </div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[10px] tracking-widest text-(--color-text-muted) uppercase">
              {es.plantel.columns.map((c, i) => (
                <th key={c} className={i === 0 || i === 3 || i === 7 ? cellLeft : cell}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pitcherId, season, status, card, nPitchesHh, nPitchesSea, group }, i) => (
              <Fragment key={`${pitcherId}/${String(season)}`}>
                {/* Grouped by role, each group opens with its name. */}
                {grouping === 'role' && (i === 0 || rows[i - 1]?.group !== group) ? (
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={es.plantel.columns.length}
                      className="border-b border-(--color-border-strong) px-3 pt-4 pb-1.5 text-left text-[11px] font-bold tracking-widest uppercase"
                    >
                      {group === null ? es.unknownRole : es.rolePlural[group]}
                    </th>
                  </tr>
                ) : null}
                <tr
                  className={
                    card === null
                      ? 'text-(--color-text-faint)'
                      : card.altitudeTrap
                        ? 'bg-(--color-diablos-wash)'
                        : undefined
                  }
                >
                  <td className={cellLeft}>
                    {card === null ? (
                      pitcherId
                    ) : (
                      <Link
                        href={fichaHref(pitcherId, season)}
                        className="font-semibold text-inherit no-underline"
                      >
                        {pitcherId}
                      </Link>
                    )}{' '}
                    {card === null ? null : <TrapFlag trap={card.altitudeTrap} />}
                  </td>
                  <td className={cell}>
                    {card === null ? (
                      ''
                    ) : (
                      <span title={es.handLong[card.throws] ?? card.throws}>
                        {es.handShort[card.throws] ?? card.throws}
                      </span>
                    )}
                  </td>
                  <td
                    className={`${cell} ${card !== null && season < latestSeason ? 'text-(--color-semantic-stale)' : ''}`}
                  >
                    {season}
                  </td>
                  <td className={cellLeft}>
                    {card === null ? '—' : card.role === null ? es.unknownRole : es.role[card.role]}
                  </td>
                  {card === null ? (
                    <td colSpan={3} className={cell}>
                      {status === 'absent'
                        ? es.plantel.absent
                        : `${es.insufficientSample} · ${es.plantel.unscored(nPitchesHh ?? 0, nPitchesSea ?? 0)}`}
                    </td>
                  ) : (
                    <>
                      <td className={cell}>
                        <MetricValue metric={card.stuffPlusHh} />
                      </td>
                      <td className={`${cell} text-(--color-text-muted)`}>
                        <MetricValue metric={card.stuffPlusSea} />
                      </td>
                      <td
                        className={`${cell} ${hasLargeDelta(card) ? 'font-semibold text-(--color-diablos)' : ''}`}
                      >
                        {formatSigned(card.stuffPlusDelta)}
                      </td>
                    </>
                  )}
                  <td className={cellLeft}>
                    {card === null ? '' : (dominantPitch(card)?.pitch ?? '')}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap justify-between gap-2 border-t border-(--color-ink) pt-3 text-[12px] text-(--color-text-muted)">
          <span>{es.plantel.summary(scored, rows.length - scored, ids.length)}</span>
          <span>{es.plantel.toFicha}</span>
        </div>
      </section>
    </div>
  )
}
