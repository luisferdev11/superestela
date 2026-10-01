import { MetricValue } from '@/components/metric/MetricValue'
import { formatMetric, formatNumber, formatSigned, formatSignedMetric } from '@/domain/format'
import type { SimulateResponse } from '@/sources/simulateResponse'
import { es } from '@/i18n/es'

/**
 * Los tres numeros de arriba, siempre lado a lado: nivel del mar, altitud extrema y
 * lo que cuesta la altura, partido en forma y entorno (`docs/09` seccion 3.9).
 * Si el modelo no paso sus compuertas no hay Stuff+ que mostrar, y se dice por
 * que en vez de dejar un hueco.
 */
export const StuffPlusKpis = ({
  result,
  baseline,
}: {
  readonly result: SimulateResponse
  /** La respuesta para el pitch real, para decir de donde se partio. */
  readonly baseline: SimulateResponse | null
}) => {
  if (!result.stuffPlusShown || result.stuffPlusReason !== null) {
    return (
      <div className="border border-(--color-border) bg-(--color-surface-card) px-5 py-4 text-sm text-(--color-text-muted)">
        {result.stuffPlusReason === null ? null : es.sim.reasons[result.stuffPlusReason]}
      </div>
    )
  }
  const delta = result.altitudeDelta
  const tile = (label: string, env: 'sea' | 'harpHelu', accent: string) => (
    <div
      className="flex min-w-0 grow basis-0 flex-col gap-1 border border-t-[3px] border-(--color-border) bg-(--color-surface-card) px-5 py-4"
      style={{ borderTopColor: `var(${accent})` }}
    >
      <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
        {label}
      </div>
      <div className="text-[32px] leading-none tracking-tight 2xl:text-[40px]">
        <MetricValue metric={result[env].stuffPlus} />
      </div>
      {baseline?.[env].stuffPlus ? (
        <div className="text-xs text-(--color-text-muted) tabular-nums">
          {es.sim.kpi.real}: {formatMetric(baseline[env].stuffPlus)}
        </div>
      ) : null}
    </div>
  )
  return (
    <div className="flex gap-4">
      {tile(es.sim.kpi.sea, 'sea', '--color-altitude-sea')}
      {tile(es.sim.kpi.hh, 'harpHelu', '--color-altitude-extreme')}
      <div className="flex min-w-0 grow basis-0 flex-col gap-1 bg-(--color-ink) px-5 py-4 text-white">
        <div className="text-[10px] font-bold tracking-widest text-(--color-text-faint) uppercase">
          {es.sim.kpi.delta}
        </div>
        {delta === null ? null : (
          <>
            <div className="text-[32px] leading-none tracking-tight whitespace-nowrap tabular-nums 2xl:text-[40px]">
              {formatSigned(delta.total.value)}
              <span className="pl-2 text-base text-(--color-text-faint)">
                {'±'} {formatNumber(delta.total.se)}
              </span>
            </div>
            <div className="text-xs text-(--color-text-faint) tabular-nums">
              {formatSignedMetric(delta.shape)} {es.sim.kpi.shape} ·{' '}
              {formatSignedMetric(delta.environment)} {es.sim.kpi.environment}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
