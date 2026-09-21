'use client'

/**
 * Un filtro es un `<button>` real y no un `div` con `onClick`: `CONVENTIONS.md`
 * seccion 4 y `docs/07` seccion 5.3 — el tabulador tiene que llegar a el.
 * `aria-pressed` comunica el estado sin depender del color.
 */
export const FilterChip = ({
  label,
  active,
  onToggle,
}: {
  readonly label: string
  readonly active: boolean
  readonly onToggle: () => void
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={active}
    className={
      active
        ? 'border border-(--color-ink) bg-(--color-ink) px-[11px] py-[5px] text-xs text-white'
        : 'border border-(--color-border) bg-(--color-surface-card) px-[11px] py-[5px] text-xs text-(--color-text)'
    }
  >
    {label}
  </button>
)

export const FilterDivider = () => (
  <div className="mx-1 h-[22px] w-px bg-(--color-border)" aria-hidden="true" />
)
