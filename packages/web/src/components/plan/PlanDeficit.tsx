import { formatNumber, formatSignedMetric } from '@/domain/format'
import type { Plan } from '@/domain/plan'
import { es } from '@/i18n/es'

/**
 * «Donde se pierde» (`Plan.dc.html`): cuanto aporta cada pitch al deficit
 * contra 100. Las barras salen del centro, a la izquierda lo que resta y a la
 * derecha lo que suma, con la misma escala para todos.
 */
export const PlanDeficit = ({ plan }: { readonly plan: Plan }) => {
  const max = Math.max(1e-9, ...plan.contributions.map((c) => Math.abs(c.contribution.value)))
  const isDeficit = plan.deficit.value < 0
  return (
    <section className="flex flex-col gap-3 border border-(--color-border) bg-(--color-surface-card) p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold">
          {isDeficit
            ? es.plan.deficitTitle(formatNumber(Math.abs(plan.deficit.value)))
            : es.plan.surplusTitle}
        </h2>
        <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
          {es.plan.deficitRule}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {plan.contributions.map((c) => {
          const width = `${String((50 * Math.abs(c.contribution.value)) / max)}%`
          const negative = c.contribution.value < 0
          return (
            <li key={c.pitch} className="flex items-center gap-3.5 text-[13px]">
              <span className="w-[110px] shrink-0 font-semibold">{c.pitch}</span>
              <span className="w-[130px] shrink-0 text-[12px] text-(--color-text-muted) tabular-nums">
                {es.plan.share(formatNumber(100 * c.share), formatNumber(c.stuffPlusHh.value))}
              </span>
              <span className="relative h-5 grow bg-(--color-surface-page)" aria-hidden="true">
                <span className="absolute top-0 left-1/2 h-5 w-px bg-(--color-border)" />
                <span
                  className={`absolute top-0 h-5 ${negative ? 'right-1/2 bg-(--color-diablos)' : 'left-1/2 bg-(--color-altitude-sea)'}`}
                  style={{ width }}
                />
              </span>
              <span
                className={`w-[110px] shrink-0 text-right font-bold tabular-nums ${negative ? '' : 'text-(--color-altitude-sea)'}`}
              >
                {formatSignedMetric(c.contribution, 2)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-(--color-border-hairline) pt-2.5 text-[13px] leading-relaxed">
        {!isDeficit
          ? es.plan.noDeficit
          : plan.culprit === null
            ? es.plan.spread
            : es.plan.culprit(plan.culprit.pitch)}
      </p>
    </section>
  )
}
