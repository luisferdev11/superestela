import { NavRail } from '@/components/chrome/NavRail'
import { Deployment } from '@/components/deploy/Deployment'
import { RosterNotice } from '@/components/deploy/RosterNotice'
import { selectRadarCohort } from '@/domain/cohort'
import { formatNumber } from '@/domain/format'
import {
  approximateRoster,
  latestCards,
  MIN_HOME_PITCHES,
  orderShift,
  ROSTER_SIZE,
} from '@/domain/roster'
import { loadDataset } from '@/sources/mockupSource'
import { es } from '@/i18n/es'

/**
 * P6, el Tablero de Despliegue (`docs/02` P6, `docs/10` T5): «¿quienes son
 * los mejores para el estadio donde se juega?». El plantel es aproximado
 * (ADR 0008) y la pantalla lo dice antes que nada.
 */
export const dynamic = 'force-static'

export default async function DeploymentPage() {
  const { cards, seasonsByPitcher, density, nPitches, seasons } = await loadDataset()
  const latest = Math.max(...seasons)
  const roster = latestCards(cards, approximateRoster(seasonsByPitcher, latest))
  const shift = orderShift(selectRadarCohort(cards, seasonsByPitcher))

  return (
    <div className="flex min-h-screen bg-(--color-surface-page)">
      <NavRail scale={density} nPitches={nPitches} seasons={seasons} current="/despliegue" />
      <main className="flex min-w-0 grow flex-col gap-4 px-8 py-7">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{es.deploy.title}</h1>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">
            {es.deploy.subtitle(roster.length)}
          </p>
        </div>
        <RosterNotice size={ROSTER_SIZE} season={latest} min={MIN_HOME_PITCHES} />
        <div className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) px-4.5 py-3.5 text-[13px] leading-relaxed">
          <p className="m-0">
            <span className="pr-2 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
              {es.deploy.ruleTitle}
            </span>
            {es.deploy.rule}
          </p>
          <p className="m-0">
            <span className="pr-2 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
              {es.deploy.whyTitle}
            </span>
            {es.deploy.why(
              formatNumber(shift.rankCorrelation, 3),
              formatNumber(shift.medianMove, 0),
              shift.topTenTurnover,
              shift.n,
            )}{' '}
            {es.deploy.noMedium}
          </p>
        </div>
        <Deployment
          cards={roster}
          latestSeason={latest}
          densities={{
            hh: formatNumber(density.extreme.densityRatio, 3),
            sea: formatNumber(density.sea.densityRatio, 3),
          }}
        />
      </main>
    </div>
  )
}
