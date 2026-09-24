'use client'

/**
 * Un filtro es un `<button>` real y no un `div` con `onClick`: `CONVENTIONS.md`
 * seccion 4 y `docs/07` seccion 5.3 — el tabulador tiene que llegar a el.
 * `aria-pressed` comunica el estado sin depender del color.
 *
 * `count` es cuantas filas quedarian al pulsarlo. Se muestra siempre, y cuando
 * es cero el chip se apaga: explorar combinaciones no deberia llevarte a una
 * tabla vacia para descubrir que ese camino no iba a ningun lado.
 */
export const FilterChip = ({
  label,
  active,
  count,
  onToggle,
}: {
  readonly label: string
  readonly active: boolean
  readonly count?: number
  readonly onToggle: () => void
}) => {
  const dead = count === 0 && !active

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={dead}
      aria-pressed={active}
      className={
        active
          ? 'border border-(--color-ink) bg-(--color-ink) px-[11px] py-[5px] text-xs text-white'
          : dead
            ? 'cursor-not-allowed border border-(--color-border) bg-transparent px-[11px] py-[5px] text-xs text-(--color-text-faint) opacity-60'
            : 'border border-(--color-border) bg-(--color-surface-card) px-[11px] py-[5px] text-xs text-(--color-text) hover:border-(--color-ink)'
      }
    >
      {label}
      {count === undefined ? null : (
        <span className={active ? 'pl-1.5 text-white/70' : 'pl-1.5 text-(--color-text-faint)'}>
          {count}
        </span>
      )}
    </button>
  )
}

export const FilterDivider = () => (
  <div className="mx-1 h-[22px] w-px bg-(--color-border)" aria-hidden="true" />
)
