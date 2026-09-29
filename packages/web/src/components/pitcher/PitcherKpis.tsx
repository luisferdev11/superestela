import type { ReactNode } from 'react'
import { MetricValue } from '@/components/metric/MetricValue'
import { InconclusiveValue } from '@/components/metric/InconclusiveValue'
import { formatNumber, formatSigned, formatSignedMetric } from '@/domain/format'
import { isAboveAverage } from '@/domain/pitcher'
import type { PitcherSeason } from '@/domain/types'
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
}: {
  readonly card: PitcherSeason
  readonly rank: { readonly sea: number; readonly hh: number; readonly of: number }
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
        card.altitudeTax === null && card.altitudeTaxMeasured !== null
          ? es.ficha.kpi.taxMeasured(formatSignedMetric(card.altitudeTaxMeasured, 2))
          : undefined
      }
    >
      {card.altitudeTax === null ? (
        <InconclusiveValue />
      ) : (
        <MetricValue metric={card.altitudeTax} digits={2} />
      )}
    </Tile>
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
