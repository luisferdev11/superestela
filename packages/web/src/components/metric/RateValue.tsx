import type { Metric } from '@/domain/types'
import { MetricValue } from './MetricValue'
import { InsufficientSample } from './InconclusiveValue'
import { es } from '@/i18n/es'

/**
 * A descriptive rate (K%, BB%, K-BB%, whiff per swing), always with its 95%
 * band. Since 20 oct a rate below the sample minimum is shown too (the team
 * asked for every number), marked with «*» in the muted tone: its wide band
 * says how little it means. Only a rate with no denominator at all reads
 * «muestra insuficiente». `compact` only shortens that label.
 */
export const RateValue = ({
  metric,
  compact = false,
  small = false,
}: {
  readonly metric: Metric | null
  readonly compact?: boolean
  /** Below the product minimum (`MIN_PLATE_APPEARANCES_FOR_RATE`, `MIN_SWINGS_FOR_RATE`). */
  readonly small?: boolean
}) => {
  if (metric === null) return <InsufficientSample short={compact} />
  if (!small) return <MetricValue metric={metric} />
  return (
    <span className="opacity-60" title={es.smallSample}>
      <MetricValue metric={metric} />
      <span aria-label={es.smallSample}>{'*'}</span>
    </span>
  )
}
