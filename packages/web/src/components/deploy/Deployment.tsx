'use client'

import Link from 'next/link'
import { useState } from 'react'
import { TrapFlag } from '@/components/chip/TrapFlag'
import { MetricValue } from '@/components/metric/MetricValue'
import { dominantPitch } from '@/domain/arsenal'
import { isStaleSeason } from '@/domain/emphasis'
import { fichaHref } from '@/domain/pitcher'
import { deploymentBoard, deploymentGroups } from '@/domain/roster'
import type { Environment, PitcherSeason } from '@/domain/types'
import { es } from '@/i18n/es'

const ENVS: readonly Environment[] = ['hh', 'sea']
const base = 'border-b border-(--color-border-hairline) px-2.5 py-1.5 tabular-nums'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

const PitcherLink = ({ card }: { readonly card: PitcherSeason }) => (
  <Link
    href={fichaHref(card.pitcherId, card.season)}
    className="font-semibold text-inherit no-underline"
  >
    {card.pitcherId}
  </Link>
)

/**
 * La isla de P6: el estadio de la serie cambia el orden de los grupos. El
 * tablero completo muestra los dos entornos a la vez, porque lo que cuenta es
 * cuanto se mueve cada uno. La cuenta vive en `domain/roster.ts`.
 */
export const Deployment = ({
  cards,
  latestSeason,
  densities,
}: {
  readonly cards: readonly PitcherSeason[]
  readonly latestSeason: number
  readonly densities: Readonly<Record<Environment, string>>
}) => {
  const [env, setEnv] = useState<Environment>('hh')
  const board = deploymentBoard(cards)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
          {es.deploy.stadium}
        </span>
        <div className="flex border border-(--color-ink)">
          {ENVS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={e === env}
              onClick={() => {
                setEnv(e)
              }}
              className={
                e === env
                  ? 'cursor-pointer border-0 bg-(--color-ink) px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'cursor-pointer border-0 bg-(--color-surface-card) px-3.5 py-1.5 text-xs'
              }
            >
              {es.deploy.envs[e](densities[e])}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {deploymentGroups(cards, env).map((group) => (
          <section key={group.role ?? 'none'} className="flex min-w-[260px] flex-1 flex-col gap-2">
            <div className="flex items-baseline justify-between border-b-2 border-(--color-ink) pb-1.5">
              <h2 className="text-[13px] font-semibold">
                {group.role === null ? es.deploy.noRole : es.rolePlural[group.role]}
              </h2>
              <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
                {es.deploy.groupCount(group.cards.length)}
              </span>
            </div>
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {group.cards.map((card, i) => (
                <li
                  key={card.pitcherId}
                  className={`flex items-center gap-3 border border-l-[3px] border-(--color-border) bg-(--color-surface-card) px-3 py-2 ${group.role === 'starter' ? 'border-l-(--color-altitude-extreme)' : 'border-l-(--color-altitude-sea)'}`}
                >
                  <span className="w-5 text-[16px] font-bold text-(--color-text-faint) tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex grow flex-col text-[13px]">
                    <span>
                      <PitcherLink card={card} /> <TrapFlag trap={card.altitudeTrap} />
                    </span>
                    <span className="text-[11px] text-(--color-text-muted)">
                      {`${dominantPitch(card)?.pitch ?? ''} · ${String(card.season)}`}
                    </span>
                  </span>
                  <span className="text-[15px]">
                    <MetricValue metric={env === 'hh' ? card.stuffPlusHh : card.stuffPlusSea} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
        <h2 className="text-[13px] font-semibold">{es.deploy.boardTitle}</h2>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[10px] tracking-widest text-(--color-text-muted) uppercase">
              {es.deploy.columns.map((c, i) => (
                <th key={c} className={i === 0 || i === 3 || i === 9 ? cellLeft : cell}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.map(({ card, rankHh, rankSea, move }) => (
              <tr
                key={card.pitcherId}
                className={card.altitudeTrap ? 'bg-(--color-diablos-wash)' : undefined}
              >
                <td className={cellLeft}>
                  <PitcherLink card={card} /> <TrapFlag trap={card.altitudeTrap} />
                </td>
                <td
                  className={`${cell} ${isStaleSeason(card, latestSeason) ? 'text-(--color-semantic-stale)' : ''}`}
                >
                  {card.season}
                </td>
                <td className={cell}>{card.throws}</td>
                <td className={cellLeft}>
                  {card.role === null ? es.unknownRole : es.role[card.role]}
                </td>
                <td className={cell}>
                  <MetricValue metric={card.stuffPlusHh} />
                </td>
                <td className={`${cell} text-(--color-text-muted)`}>
                  <MetricValue metric={card.stuffPlusSea} />
                </td>
                <td className={`${cell} text-(--color-text-faint)`}>{rankHh}</td>
                <td className={`${cell} text-(--color-text-faint)`}>{rankSea}</td>
                <td
                  className={`${cell} font-semibold ${move > 0 ? 'text-(--color-altitude-sea)' : move < 0 ? 'text-(--color-semantic-stale)' : 'text-(--color-text-faint)'}`}
                >
                  {move === 0 ? '=' : move > 0 ? `▲ ${String(move)}` : `▼ ${String(-move)}`}
                </td>
                <td className={cellLeft}>{dominantPitch(card)?.pitch ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap justify-between gap-2 border-t border-(--color-ink) pt-3 text-[12px] text-(--color-text-muted)">
          <span>{es.deploy.moveNote}</span>
          <span>{es.deploy.band}</span>
        </div>
      </section>
    </div>
  )
}
