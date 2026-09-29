import type { Route } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { NavRail } from '@/components/chrome/NavRail'
import { PitcherHeader } from './PitcherHeader'
import { ArsenalMap } from './ArsenalMap'
import { ArsenalTable } from './ArsenalTable'
import { LocationMap } from './LocationMap'
import { PitcherKpis } from './PitcherKpis'
import { PitcherPhysics } from './PitcherPhysics'
import { PitcherReading } from './PitcherReading'
import { SeasonTable } from './SeasonTable'
import { arsenalMapPitches } from '@/domain/arsenalMap'
import { locationKey, sharedMax } from '@/domain/location'
import type { FichaTab } from '@/domain/navigation'
import {
  cardsOf,
  fichaArsenalHref,
  fichaHref,
  pickSeason,
  rankInSeason,
  seasonTimeline,
} from '@/domain/pitcher'
import { canSimulate, simulatorHref } from '@/domain/simulator'
import { loadLocations } from '@/sources/locationSource'
import { loadDataset } from '@/sources/mockupSource'
import { loadSimulatorDataset } from '@/sources/simulatorSource'
import { es } from '@/i18n/es'

/**
 * P2, la Ficha (`docs/02` P2, `docs/10` T3): «¿que tengo enfrente y que le
 * pasa en la altura?». Todas sus rutas la dibujan con esto; cambia la pestana.
 * El rail marca el Radar porque es de donde se llega.
 */
export const FichaPage = async ({
  pitcherId,
  season,
  tab = 'summary',
}: {
  readonly pitcherId: string
  readonly season?: number
  readonly tab?: Extract<FichaTab, 'summary' | 'arsenal'>
}) => {
  const [
    { cards, seasonsByPitcher, density, nPitches, seasons, pitchersWithGap, leagueShapes },
    { arsenals },
    locations,
  ] = await Promise.all([loadDataset(), loadSimulatorDataset(), loadLocations()])
  const own = cardsOf(cards, pitcherId)
  const card = pickSeason(own, season)
  if (card === null) notFound()

  // `typedRoutes` no reconoce la consulta armada en tiempo de ejecucion.
  const simulatorHrefs = Object.fromEntries(
    card.arsenal
      .filter((e) => canSimulate(arsenals, pitcherId, card.season, e.pitch))
      .map((e) => [e.pitch, simulatorHref(pitcherId, card.season, e.pitch) as Route]),
  )
  const header = (
    <PitcherHeader
      card={card}
      seasons={own.map((c) => c.season)}
      tab={tab}
      tabHrefs={{
        summary: fichaHref(pitcherId, card.season),
        arsenal: fichaArsenalHref(pitcherId, card.season),
      }}
    />
  )

  if (tab === 'arsenal') {
    const location = locations?.get(locationKey(pitcherId, card.season)) ?? null
    const sea = location?.sea ?? null
    const hh = location?.hh ?? null
    const max = sharedMax([sea, hh])
    return (
      <Shell density={density} nPitches={nPitches} seasons={seasons}>
        {header}
        <p className="text-[13px] text-(--color-text-muted)">
          {es.ficha.location.subtitle}{' '}
          {sea === null || hh === null
            ? null
            : es.ficha.location.withSample(sea.nPitches + hh.nPitches)}
        </p>
        <section className="flex flex-wrap gap-6 border border-(--color-border) bg-(--color-surface-card) p-5">
          <LocationMap title={es.ficha.location.panel.sea} panel={sea} max={max} />
          <LocationMap title={es.ficha.location.panel.hh} panel={hh} max={max} />
        </section>
        <ArsenalTable card={card} simulatorHrefs={simulatorHrefs} />
        <section className="flex flex-col gap-1.5 border border-(--color-border) bg-(--color-surface-card) p-5">
          <h2 className="text-[15px] font-bold">{es.ficha.location.readTitle}</h2>
          <p className="text-[13px] text-(--color-text-muted)">{es.ficha.location.readPending}</p>
        </section>
      </Shell>
    )
  }

  const rankSea = rankInSeason(cards, card, 'sea')
  const rankHh = rankInSeason(cards, card, 'hh')
  const measured = arsenals.find((a) => a.pitcherId === pitcherId && a.season === card.season)
  return (
    <Shell density={density} nPitches={nPitches} seasons={seasons}>
      {header}
      <PitcherKpis card={card} rank={{ sea: rankSea.rank, hh: rankHh.rank, of: rankSea.of }} />
      {measured === undefined ? null : (
        <ArsenalMap pitches={arsenalMapPitches(measured, leagueShapes)} />
      )}
      <ArsenalTable card={card} simulatorHrefs={simulatorHrefs} />
      <PitcherPhysics scale={density} />
      <SeasonTable
        rows={seasonTimeline(seasonsByPitcher.get(pitcherId) ?? [], own)}
        pitchersWithGap={pitchersWithGap}
      />
      <PitcherReading card={card} />
    </Shell>
  )
}

const Shell = ({
  density,
  nPitches,
  seasons,
  children,
}: {
  readonly density: Parameters<typeof NavRail>[0]['scale']
  readonly nPitches: number
  readonly seasons: readonly number[]
  readonly children: ReactNode
}) => (
  <div className="flex min-h-screen bg-(--color-surface-page)">
    <NavRail scale={density} nPitches={nPitches} seasons={seasons} current="/radar" />
    <main className="flex min-w-0 grow flex-col gap-5 px-8 py-7">{children}</main>
  </div>
)
