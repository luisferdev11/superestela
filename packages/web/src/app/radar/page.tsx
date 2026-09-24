import { loadDataset } from '@/sources/mockupSource'
import { selectRadarCohort, summarize } from '@/domain/cohort'
import { dominantPitchTypes } from '@/domain/arsenal'
import { NavRail } from '@/components/chrome/NavRail'
import { RadarTable } from '@/components/radar/RadarTable'
import { es } from '@/i18n/es'

/**
 * P1, la pantalla de aterrizaje (`docs/02` seccion 2).
 *
 * `force-static`: el `fs.readFile` ocurre en build, asi que la pagina se sirve
 * prerenderizada y la demo del 13 de octubre no depende de leer un archivo en
 * vivo. En `pnpm dev` se relee en cada peticion.
 */
export const dynamic = 'force-static'

export default async function RadarPage() {
  const { cards, seasonsByPitcher, density, nPitches, seasons } = await loadDataset()
  const cohort = selectRadarCohort(cards, seasonsByPitcher)
  const summary = summarize(cohort)

  return (
    <div className="flex min-h-screen bg-(--color-surface-page)">
      <NavRail scale={density} nPitches={nPitches} seasons={seasons} current="/radar" />

      <main className="flex min-w-0 grow flex-col gap-4 px-8 py-7">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{es.title}</h1>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">{es.subtitle}</p>
        </div>

        <RadarTable
          cards={cohort}
          latestSeason={Math.max(...seasons)}
          cohortSummary={summary}
          pitches={dominantPitchTypes(cohort)}
        />
      </main>
    </div>
  )
}
