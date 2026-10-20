import { notFound } from 'next/navigation'
import { PageShell } from '@/components/chrome/PageShell'
import { PitcherHeader } from '@/components/pitcher/PitcherHeader'
import { ProjectionTable } from './ProjectionTable'
import {
  cardsOf,
  fichaArsenalHref,
  fichaHref,
  pickSeason,
  planHref,
  projectionHref,
} from '@/domain/pitcher'
import { locationKey } from '@/domain/location'
import { loadDataset } from '@/sources/mockupSource'
import { loadProjections } from '@/sources/projectionSource'
import { es } from '@/i18n/es'

/**
 * P7, la Proyeccion (`docs/02` P7, `docs/10` T6): «¿como se veria este
 * lanzador en el estadio de la proxima serie?». Es el Traductor aplicado a
 * alguien que ya esta en los datos.
 */
export const ProjectionPage = async ({
  pitcherId,
  season,
}: {
  readonly pitcherId: string
  readonly season?: number
}) => {
  const [{ cards, density, nPitches, seasons, seasonsByPitcher }, projections] = await Promise.all([
    loadDataset(),
    loadProjections(),
  ])
  const own = cardsOf(cards, pitcherId)
  const card = pickSeason(own, season)
  if (card === null) notFound()
  const projection = projections.pitchers.get(locationKey(pitcherId, card.season))

  return (
    <PageShell density={density} nPitches={nPitches} seasons={seasons} current="/radar">
      <PitcherHeader
        card={card}
        seasons={own.map((c) => c.season)}
        history={seasonsByPitcher.get(pitcherId) ?? []}
        tab="projection"
        tabHrefs={{
          summary: fichaHref(pitcherId, card.season),
          arsenal: fichaArsenalHref(pitcherId, card.season),
          projection: projectionHref(pitcherId, card.season),
          plan: planHref(pitcherId, card.season),
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight">{es.projection.title}</h2>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">{es.projection.subtitle}</p>
        </div>
      </div>
      <section className="flex flex-col gap-1.5 border-l-[3px] border-(--color-altitude-extreme) bg-(--color-surface-card) px-4 py-3 text-[13px]">
        <h3 className="m-0 text-[13px] font-bold">{es.projection.purpose.title}</h3>
        <ul className="m-0 flex flex-col gap-1 pl-5">
          {es.projection.purpose.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      {projection === undefined ? (
        <p className="border border-(--color-border) bg-(--color-surface-card) p-5 text-[13px]">
          {es.projection.none}
        </p>
      ) : (
        <ProjectionTable
          projection={projection}
          densities={{ hh: projections.densities.hh, medium: projections.densities.medium }}
          factors={projections.factors}
        />
      )}
    </PageShell>
  )
}
