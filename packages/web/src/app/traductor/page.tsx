import { PageShell } from '@/components/chrome/PageShell'
import { Translator } from '@/components/translator/Translator'
import { loadDataset } from '@/sources/mockupSource'
import { loadProjections } from '@/sources/projectionSource'
import { loadSimulatorDataset } from '@/sources/simulatorSource'
import { es } from '@/i18n/es'

/**
 * Los arsenales reales que se ofrecen como ejemplo, uno por historia de
 * `docs/09` seccion 5.2: la recta que colapsa, el slider que aguanta y la curva
 * de un abridor con seis pitches.
 */
const EXAMPLES = ['pitcher_00069/2025', 'pitcher_00566/2025', 'pitcher_00191/2025']

/**
 * P3, el Traductor de Altitud (`docs/02` P3, `docs/10` T2): «este pitcher nunca
 * ha lanzado aqui, ¿cuanto vale en altitud extrema?». Lo fijo —arsenales,
 * densidades y factores— se lee en el servidor; cada pitch lo puntua la API,
 * como en el Simulador.
 */
export const dynamic = 'force-static'

export default async function TraductorPage() {
  const [{ density, nPitches, seasons }, data, projections] = await Promise.all([
    loadDataset(),
    loadSimulatorDataset(),
    loadProjections(),
  ])
  return (
    <PageShell density={density} nPitches={nPitches} seasons={seasons} current="/traductor">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">{es.translator.title}</h1>
        <p className="mt-0.5 text-[13px] text-(--color-text-muted)">{es.translator.subtitle}</p>
      </div>
      <Translator
        arsenals={data.arsenals.filter((a) => EXAMPLES.includes(a.key))}
        examples={EXAMPLES}
        densities={projections.densities}
        factors={projections.factors}
      />
    </PageShell>
  )
}
