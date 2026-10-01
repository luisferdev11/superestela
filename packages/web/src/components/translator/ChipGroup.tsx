'use client'

import { useId } from 'react'

/** Una opcion de un grupo de botones: la etiqueta ya viene traducida. */
export type ChipOption = {
  readonly key: string
  readonly label: string
  readonly isActive: boolean
  readonly onPick: () => void
}

const chip = (active: boolean): string =>
  active
    ? 'cursor-pointer border-0 bg-(--color-ink) px-3 py-1.5 text-xs font-semibold text-white'
    : 'cursor-pointer border-0 bg-(--color-surface-card) px-3 py-1.5 text-xs text-(--color-text)'

/** Un rotulo y sus opciones, como los selectores del Simulador y la Proyeccion. */
export const ChipGroup = ({
  label,
  options,
}: {
  readonly label: string
  readonly options: readonly ChipOption[]
}) => {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <span
        id={id}
        className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase"
      >
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex border border-(--color-ink)">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={o.isActive}
            className={chip(o.isActive)}
            onClick={o.onPick}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
