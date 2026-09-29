import { notFound } from 'next/navigation'
import { NavRail } from '@/components/chrome/NavRail'
import { PitcherHeader } from './PitcherHeader'
import { ArsenalTable } from './ArsenalTable'
import { PitcherKpis } from './PitcherKpis'
import { PitcherPhysics } from './PitcherPhysics'
import { SeasonTable } from './SeasonTable'
import { cardsOf, fichaHref, pickSeason, rankInSeason, seasonTimeline } from '@/domain/pitcher'
import { loadDataset } from '@/sources/mockupSource'

/**
 * P2, la Ficha (`docs/02` P2, `docs/10` T3): «¿que tengo enfrente y que le
 * pasa en la altura?». Las dos rutas —con y sin temporada— la dibujan igual.
 * El rail marca el Radar porque es de donde se llega.
 */
export const FichaPage = async ({
  pitcherId,
  season,
}: {
  readonly pitcherId: string
  readonly season?: number
}) => {
  const { cards, seasonsByPitcher, density, nPitches, seasons, pitchersWithGap } =
    await loadDataset()
  const own = cardsOf(cards, pitcherId)
  const card = pickSeason(own, season)
  if (card === null) notFound()

  const sea = rankInSeason(cards, card, 'sea')
  const hh = rankInSeason(cards, card, 'hh')
  const self = fichaHref(pitcherId, card.season)

  return (
    <div className="flex min-h-screen bg-(--color-surface-page)">
      <NavRail scale={density} nPitches={nPitches} seasons={seasons} current="/radar" />
      <main className="flex min-w-0 grow flex-col gap-5 px-8 py-7">
        <PitcherHeader
          card={card}
          seasons={own.map((c) => c.season)}
          tab="summary"
          tabHrefs={{ summary: self }}
        />
        <PitcherKpis card={card} rank={{ sea: sea.rank, hh: hh.rank, of: sea.of }} />
        <ArsenalTable card={card} />
        <PitcherPhysics scale={density} />
        <SeasonTable
          rows={seasonTimeline(seasonsByPitcher.get(pitcherId) ?? [], own)}
          pitchersWithGap={pitchersWithGap}
        />
      </main>
    </div>
  )
}
