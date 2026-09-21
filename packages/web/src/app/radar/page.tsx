import { loadDataset } from '@/sources/mockupSource'
import { selectRadarCohort, summarize } from '@/domain/cohort'
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

const Tile = ({
  label,
  value,
  note,
}: {
  readonly label: string
  readonly value: number
  readonly note?: string
}) => (
  <div className="border-r border-(--color-border) px-5 py-3.5 last:border-r-0">
    <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
      {label}
    </div>
    <div className="text-[22px] font-bold tabular-nums">
      {value}
      {note === undefined ? null : (
        <span className="pl-1 text-sm font-normal text-(--color-text-muted)">{note}</span>
      )}
    </div>
  </div>
)

export default async function RadarPage() {
  const { cards, seasonsByPitcher, density, nPitches, seasons } = await loadDataset()
  const cohort = selectRadarCohort(cards, seasonsByPitcher)
  const summary = summarize(cohort)
  const all = summarize(cards)

  return (
    <div className="flex min-h-screen bg-(--color-surface-page)">
      <NavRail scale={density} nPitches={nPitches} seasons={seasons} current="/radar" />

      <main className="flex min-w-0 grow flex-col gap-4 px-8 py-7">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{es.title}</h1>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">{es.subtitle}</p>
        </div>

        {/*
          Las cifras se derivan de la cohorte en tiempo de render, nunca se
          escriben aqui. Un test las compara contra `evidence.json`, que es la
          corrida que las respalda (`README`, regla 2).
        */}
        <div className="flex border border-(--color-border) bg-(--color-surface-card)">
          <Tile label={es.evaluated} value={summary.nPitchers} />
          <Tile label={es.trapsOver(all.nPitchers)} value={all.nTraps} />
          <Tile
            label={es.conclusiveTax}
            value={summary.nConclusiveTax}
            note={es.outOf(summary.nPitchers)}
          />
        </div>

        <RadarTable
          cards={cohort}
          latestSeason={Math.max(...seasons)}
          significant={summary.nConclusiveTax}
        />
      </main>
    </div>
  )
}
