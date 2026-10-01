import { formatMetric, formatNumber } from '@/domain/format'
import type { Metric } from '@/domain/types'
import { MetricValue } from './MetricValue'
import { InsufficientSample } from './InconclusiveValue'

/**
 * Una tasa descriptiva (K%, BB%, K-BB%, whiff por swing). Debajo del minimo de
 * turnos no hay numero: hay «muestra insuficiente» (`README`, regla 4). En una
 * tabla compacta sale solo el valor y la banda va en el `title`.
 */
export const RateValue = ({
  metric,
  compact = false,
}: {
  readonly metric: Metric | null
  readonly compact?: boolean
}) => {
  if (metric === null) return <InsufficientSample short={compact} />
  if (!compact) return <MetricValue metric={metric} />
  return (
    <span className="tabular-nums" title={formatMetric(metric)}>
      {formatNumber(metric.value)}
    </span>
  )
}
