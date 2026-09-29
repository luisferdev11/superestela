import { notFound } from 'next/navigation'
import { PageShell } from '@/components/chrome/PageShell'
import { MetricValue } from '@/components/metric/MetricValue'
import { PitcherHeader } from '@/components/pitcher/PitcherHeader'
import { PitcherSelect } from './PitcherSelect'
import { PlanDeficit } from './PlanDeficit'
import { cardsOf, fichaArsenalHref, fichaHref, pickSeason, planHref } from '@/domain/pitcher'
import { planOf } from '@/domain/plan'
import { loadDataset } from '@/sources/mockupSource'
import { es } from '@/i18n/es'

/**
 * P5, el Plan de Desarrollo (`docs/02` P5, `docs/10` T4): «¿que le arreglo a
 * este pitcher?». Es la pantalla del pitching coach: dos o tres frases con su
 * mecanismo, no tarjetas.
 */
export const PlanPage = async ({
  pitcherId,
  season,
}: {
  readonly pitcherId: string
  readonly season?: number
}) => {
  const { cards, density, nPitches, seasons } = await loadDataset()
  const own = cardsOf(cards, pitcherId)
  const card = pickSeason(own, season)
  if (card === null) notFound()

  const plan = planOf(card)
  const options = [...cards]
    .sort((a, b) => a.pitcherId.localeCompare(b.pitcherId) || b.season - a.season)
    .map((c) => ({
      href: planHref(c.pitcherId, c.season),
      label: es.sim.pitcherOption(c.pitcherId, c.season),
    }))

  return (
    <PageShell density={density} nPitches={nPitches} seasons={seasons} current="/radar">
      <PitcherHeader
        card={card}
        seasons={own.map((c) => c.season)}
        tab="plan"
        tabHrefs={{
          summary: fichaHref(pitcherId, card.season),
          arsenal: fichaArsenalHref(pitcherId, card.season),
          plan: planHref(pitcherId, card.season),
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight">{es.plan.title}</h2>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">{es.plan.subtitle}</p>
        </div>
        <div className="flex items-center gap-6">
          <PitcherSelect options={options} current={planHref(pitcherId, card.season)} />
          <div className="flex items-baseline gap-2.5">
            <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
              {es.plan.today}
            </span>
            <span className="text-[26px]">
              <MetricValue metric={card.stuffPlusHh} />
            </span>
          </div>
        </div>
      </div>
      {plan === null ? (
        <p className="border border-(--color-border) bg-(--color-surface-card) p-5 text-[13px]">
          {es.plan.none}
        </p>
      ) : (
        <PlanDeficit plan={plan} />
      )}
      <aside className="flex gap-4 border-l-[3px] border-(--color-diablos) bg-(--color-diablos-wash) px-4.5 py-3.5">
        <span className="shrink-0 pt-0.5 text-[10px] font-bold tracking-widest text-(--color-diablos) uppercase">
          {es.plan.limitTitle}
        </span>
        <p className="m-0 text-[12px] leading-relaxed">{es.plan.limit}</p>
      </aside>
    </PageShell>
  )
}
