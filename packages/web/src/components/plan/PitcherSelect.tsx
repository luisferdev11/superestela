'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { es } from '@/i18n/es'

/** El selector de lanzador del Plan: cada opcion es la pagina estatica de ese plan. */
export const PitcherSelect = ({
  options,
  current,
}: {
  readonly options: readonly { readonly href: Route; readonly label: string }[]
  readonly current: Route
}) => {
  const router = useRouter()
  return (
    <label className="flex items-center gap-2 text-[12px] text-(--color-text-muted)">
      {es.plan.pitcher}
      <select
        value={current}
        onChange={(e) => {
          router.push(e.target.value as Route)
        }}
        className="border border-(--color-border) bg-(--color-surface-card) px-2 py-1 text-[13px] font-semibold text-(--color-text-strong)"
      >
        {options.map((o) => (
          <option key={o.href} value={o.href}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
