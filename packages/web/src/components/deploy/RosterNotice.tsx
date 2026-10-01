import { es } from '@/i18n/es'

/** El aviso de ADR 0008, arriba y con la regla: el plantel es una aproximacion. */
export const RosterNotice = ({
  size,
  season,
  min,
}: {
  readonly size: number
  readonly season: number
  readonly min: number
}) => (
  <aside className="flex gap-4 border-l-[3px] border-(--color-semantic-stale) bg-(--color-surface-card) px-4 py-3">
    <span className="shrink-0 pt-0.5 text-[10px] font-bold tracking-widest text-(--color-semantic-stale) uppercase">
      {es.roster.approxTitle}
    </span>
    <p className="m-0 text-[12px] leading-relaxed">{es.roster.approx(size, season, min)}</p>
  </aside>
)
