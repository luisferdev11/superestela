import { loadDataset } from '@/sources/mockupSource'
import { selectRadarCohort, summarize } from '@/domain/cohort'
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

const Tile = ({ label, value }: { readonly label: string; readonly value: number }) => (
  <div className="border-r border-(--color-border) px-5 py-3 last:border-r-0">
    <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
      {label}
    </div>
    <div className="text-2xl font-bold tabular-nums">{value}</div>
  </div>
)

export default async function RadarPage() {
  const { cards, seasonsByPitcher } = await loadDataset()
  const cohort = selectRadarCohort(cards, seasonsByPitcher)
  const summary = summarize(cohort)

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">{es.title}</h1>
      <p className="mt-1 mb-5 text-sm text-(--color-text-muted)">{es.subtitle}</p>

      {/*
        Las tres cifras se derivan de la cohorte en tiempo de render, nunca se
        escriben aqui. Un test las compara contra `evidence.json`, que es la
        corrida que las respalda (`README`, regla 2).
      */}
      <div className="mb-6 flex border border-(--color-border) bg-(--color-surface-card)">
        <Tile label={es.evaluated} value={summary.nPitchers} />
        <Tile label={es.conclusiveTax} value={summary.nConclusiveTax} />
        <Tile label={es.traps} value={summary.nTraps} />
      </div>

      <RadarTable cards={cohort} />
    </main>
  )
}
