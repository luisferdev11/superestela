import { NavRail } from '@/components/chrome/NavRail'
import { RosterNotice } from '@/components/deploy/RosterNotice'
import { Plantel } from '@/components/plantel/Plantel'
import { MIN_PITCHES_FOR_SCORE } from '@/domain/constants'
import { approximateRoster, MIN_HOME_PITCHES, ROSTER_SIZE } from '@/domain/roster'
import { loadDataset } from '@/sources/mockupSource'
import { es } from '@/i18n/es'

/**
 * P8, el Plantel (`docs/10` T7): la contraparte del Radar y la puerta a la
 * Ficha. El plantel es aproximado (ADR 0008) y se dice arriba.
 */
export const dynamic = 'force-static'

export default async function PlantelPage() {
  const { cards, seasonsByPitcher, density, nPitches, seasons } = await loadDataset()
  const latest = Math.max(...seasons)
  const ids = approximateRoster(seasonsByPitcher, latest)
  const own = new Set(ids)

  return (
    <div className="flex min-h-screen bg-(--color-surface-page)">
      <NavRail scale={density} nPitches={nPitches} seasons={seasons} current="/plantel" />
      <main className="flex min-w-0 grow flex-col gap-4 px-8 py-7">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{es.plantel.title}</h1>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">{es.plantel.subtitle}</p>
        </div>
        <RosterNotice size={ROSTER_SIZE} season={latest} min={MIN_HOME_PITCHES} />
        <p className="m-0 border border-(--color-border) bg-(--color-surface-card) px-4.5 py-3.5 text-[13px] leading-relaxed">
          <span className="pr-2 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
            {es.plantel.howTitle}
          </span>
          {es.plantel.how(MIN_PITCHES_FOR_SCORE)}
        </p>
        <Plantel
          ids={ids}
          cards={cards.filter((c) => own.has(c.pitcherId))}
          seasons={Object.fromEntries(ids.map((id) => [id, seasonsByPitcher.get(id) ?? []]))}
          latestSeason={latest}
        />
      </main>
    </div>
  )
}
