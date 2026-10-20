import type { Metric } from '@/domain/types'
import { MetricValue } from './MetricValue'
import { InsufficientSample } from './InconclusiveValue'

/**
 * A descriptive rate (K%, BB%, K-BB%, whiff per swing), always with its 95%
 * band. Below the sample minimum there is no number but «muestra
 * insuficiente» (`README`, rule 4). `compact` only shortens that label, for
 * dense tables: the band is shown everywhere.
 */
export const RateValue = ({
  metric,
  compact = false,
}: {
  readonly metric: Metric | null
  readonly compact?: boolean
}) => (metric === null ? <InsufficientSample short={compact} /> : <MetricValue metric={metric} />)
