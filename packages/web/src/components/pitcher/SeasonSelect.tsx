'use client'

import type { Route } from 'next'
import { useId } from 'react'
import { useRouter } from 'next/navigation'
import { MIN_PITCHES_FOR_SCORE } from '@/domain/constants'
import { es } from '@/i18n/es'

/**
 * Que temporada del lanzador se ve, en cualquier pestana de la Ficha (14 de
 * octubre). Solo las temporadas con score; con una sola, el control lo dice en
 * vez de ofrecer una eleccion que no existe.
 */
export type SeasonOption = {
  readonly season: number
  /** Null for a season without score: listed, but it cannot be opened. */
  readonly href: Route | null
  /** Its pitches in each environment, when it has no score. */
  readonly sample: { readonly hh: number; readonly sea: number } | null
}

export const SeasonSelect = ({
  options,
  current,
}: {
  readonly options: readonly SeasonOption[]
  readonly current: number
}) => {
  const router = useRouter()
  const id = useId()
  const isOnly = options.length < 2
  const scoredCount = options.filter((o) => o.href !== null).length
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase"
      >
        {es.ficha.season}
      </label>
      <select
        id={id}
        value={current}
        disabled={isOnly}
        title={isOnly ? es.ficha.onlySeason : undefined}
        onChange={(event) => {
          const next = options.find((o) => o.season === Number(event.target.value))
          if (next?.href != null) router.push(next.href)
        }}
        className="h-8 border border-(--color-border-strong) bg-(--color-surface-card) px-2 text-[13px] font-semibold text-(--color-text-strong) disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.season} value={o.season} disabled={o.href === null}>
            {o.sample === null
              ? o.season
              : es.ficha.seasonWithoutScore(
                  o.season,
                  o.sample.hh,
                  o.sample.sea,
                  MIN_PITCHES_FOR_SCORE,
                )}
          </option>
        ))}
      </select>
      {isOnly ? (
        <span className="text-[11px] whitespace-nowrap text-(--color-text-muted)">
          {es.ficha.onlySeason}
        </span>
      ) : scoredCount < 2 ? (
        <span className="text-[11px] whitespace-nowrap text-(--color-text-muted)">
          {es.ficha.otherSeasonsWithoutScore}
        </span>
      ) : null}
    </div>
  )
}
