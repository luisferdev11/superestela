'use client'

import type { Route } from 'next'
import { useId } from 'react'
import { useRouter } from 'next/navigation'
import { es } from '@/i18n/es'

/**
 * Que temporada del lanzador se ve, en cualquier pestana de la Ficha (14 de
 * octubre). Solo las temporadas con score; con una sola, el control lo dice en
 * vez de ofrecer una eleccion que no existe.
 */
export const SeasonSelect = ({
  options,
  current,
}: {
  readonly options: readonly { readonly season: number; readonly href: Route }[]
  readonly current: number
}) => {
  const router = useRouter()
  const id = useId()
  const isOnly = options.length < 2
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
          if (next !== undefined) router.push(next.href)
        }}
        className="h-8 border border-(--color-border-strong) bg-(--color-surface-card) px-2 text-[13px] font-semibold text-(--color-text-strong) disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.season} value={o.season}>
            {o.season}
          </option>
        ))}
      </select>
      {isOnly ? (
        <span className="text-[11px] text-(--color-text-muted)">{es.ficha.onlySeason}</span>
      ) : null}
    </div>
  )
}
