import type { ReactNode } from 'react'
import { MetricValue } from '@/components/metric/MetricValue'
import { InconclusiveValue } from '@/components/metric/InconclusiveValue'
import { formatNumber, formatSigned, formatSignedMetric } from '@/domain/format'
import { isAboveAverage } from '@/domain/pitcher'
import type { PitcherSeason } from '@/domain/types'
import type { PitcherRuns } from '@/sources/runsSource'
import { es } from '@/i18n/es'

const Tile = ({
  label,
  children,
  note,
}: {
  readonly label: string
  readonly children: ReactNode
  readonly note?: string
}) => (
  <div className="flex min-w-[150px] flex-1 flex-col gap-1 border-r border-(--color-border) px-5 py-3.5 last:border-r-0">
    <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
      {label}
    </div>
    <div className="text-[22px] tabular-nums">{children}</div>
    {note === undefined ? null : (
      <p className="text-[11px] leading-snug text-(--color-text-muted)">{note}</p>
    )}
  </div>
)

/**
 * Los cinco numeros de la Ficha. El impuesto no concluyente dice cuanto midio,
 * para que se vea que la banda cruza el cero: «no concluyente» es la regla
 * funcionando, no un dato que falta.
 */
export const PitcherKpis = ({
  card,
  rank,
  runs = null,
}: {
  readonly card: PitcherSeason
  readonly rank: { readonly sea: number; readonly hh: number; readonly of: number }
  /** RA/9 por entorno (`analysis/pitcher_runs.py`); `null` si el artefacto no existe. */
  readonly runs?: { readonly minInnings: number; readonly pitcher: PitcherRuns | null } | null
}) => (
  <div className="flex flex-wrap border border-(--color-border) bg-(--color-surface-card)">
    <Tile label={es.ficha.kpi.hh}>
      <MetricValue metric={card.stuffPlusHh} />
    </Tile>
    <Tile label={es.ficha.kpi.sea}>
      <MetricValue metric={card.stuffPlusSea} />
    </Tile>
    <Tile label={es.ficha.kpi.delta}>
      <span className="font-semibold text-(--color-diablos)">
        {formatSigned(card.stuffPlusDelta)}
      </span>
    </Tile>
    <Tile
      label={es.ficha.kpi.tax}
      note={
        [
          card.altitudeTax === null && card.altitudeTaxMeasured !== null
            ? es.ficha.kpi.taxMeasured(formatSignedMetric(card.altitudeTaxMeasured, 2))
            : '',
          // RA/9 sits next to it and does not reconcile: say they measure different things.
          runs === null ? '' : es.ficha.kpi.taxDefinition,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      {card.altitudeTax === null ? (
        <InconclusiveValue />
      ) : (
        <MetricValue metric={card.altitudeTax} digits={2} />
      )}
    </Tile>
    {runs === null ? null : (
      <Tile label={es.ficha.kpi.runs} note={es.ficha.kpi.runsNote(runs.minInnings)}>
        <div className="flex flex-col gap-0.5 text-[15px]">
          {(['hh', 'sea'] as const).map((env) => {
            const value = runs.pitcher?.[env] ?? null
            return (
              <div key={env} className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-(--color-text-muted)">
                  {es.ficha.kpi.runsIn[env]}
                </span>
                {value === null ? (
                  <span className="text-[12px] text-(--color-semantic-inconclusive)">
                    {es.insufficientSample}
                  </span>
                ) : (
                  <MetricValue metric={value.ra9} digits={2} />
                )}
              </div>
            )
          })}
        </div>
      </Tile>
    )}
    <Tile
      label={es.ficha.kpi.loss}
      note={[
        es.ficha.kpi.lossUnit,
        es.ficha.kpi.rank(rank.sea, rank.hh, rank.of),
        isAboveAverage(card.stuffPlusHh.value) ? '' : es.ficha.kpi.belowAverage,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {card.meanIvbLossIn === null ? (
        <span className="text-[13px] text-(--color-semantic-inconclusive)">
          {es.insufficientSample}
        </span>
      ) : (
        <span className="font-semibold">{`${formatNumber(card.meanIvbLossIn, 2)}″`}</span>
      )}
    </Tile>
  </div>
)
