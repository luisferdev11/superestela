import { formatMetric, formatNumber } from '@/domain/format'
import type { Metric } from '@/domain/types'
import { InconclusiveValue } from './InconclusiveValue'

/**
 * `README`, regla 3: ningun score sin su banda.
 *
 * La prop es un `Metric` —un objeto con `value` y `se`— y no dos props
 * sueltas, a proposito: asi **no existe la forma** de pasar el valor sin su
 * incertidumbre, y el compilador sostiene la regla en vez de la disciplina.
 * docs/07 seccion 5.2, regla 2.
 */
export const MetricValue = ({
  metric,
  digits = 1,
}: {
  readonly metric: Metric | null
  readonly digits?: number
}) => {
  // Sin banda finita no hay cifra que mostrar. Una banda no finita es un
  // defecto de datos, y "no concluyente" es la respuesta honesta.
  if (metric === null || !Number.isFinite(metric.se) || !Number.isFinite(metric.value)) {
    return <InconclusiveValue />
  }

  return (
    <span className="tabular-nums whitespace-nowrap" aria-label={formatMetric(metric, digits)}>
      <span className="font-semibold">{formatNumber(metric.value, digits)}</span>{' '}
      <span className="text-(--color-text-muted)">
        {'±'} {formatNumber(metric.se, digits)}
      </span>
    </span>
  )
}
