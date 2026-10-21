import type { CohortSummary } from '@/domain/cohort'
import { es } from '@/i18n/es'

/**
 * Los dos numeros del encabezado, **derivados de lo que la tabla esta
 * mostrando ahora**. Cuando hay filtro se muestra tambien el total, porque un
 * "12" sin denominador no dice si es mucho o poco — y porque el "296
 * evaluados" de la cohorte completa sigue siendo la cifra que respalda el
 * deck.
 */
const Tile = ({
  label,
  value,
  of,
}: {
  readonly label: string
  readonly value: number
  readonly of?: number
}) => (
  <div className="border-r border-(--color-border) px-5 py-3.5 last:border-r-0">
    <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
      {label}
    </div>
    <div className="text-[22px] font-bold tabular-nums">
      {value}
      {of === undefined ? null : (
        <span className="pl-1 text-sm font-normal text-(--color-text-muted)">{es.outOf(of)}</span>
      )}
    </div>
  </div>
)

export const RadarSummary = ({
  shown,
  cohort,
  filtered,
}: {
  readonly shown: CohortSummary
  readonly cohort: CohortSummary
  readonly filtered: boolean
}) => (
  <div className="flex flex-wrap border border-(--color-border) bg-(--color-surface-card)">
    <Tile
      label={es.evaluated}
      value={shown.nPitchers}
      of={filtered ? cohort.nPitchers : undefined}
    />
    <Tile label={es.traps} value={shown.nTraps} of={shown.nPitchers} />
  </div>
)
