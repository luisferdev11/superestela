import { PageShell } from '@/components/chrome/PageShell'
import { Translator } from '@/components/translator/Translator'
import { loadDataset } from '@/sources/mockupSource'
import { loadProjections } from '@/sources/projectionSource'
import { loadSimulatorDataset } from '@/sources/simulatorSource'
import { es } from '@/i18n/es'

/**
 * El unico arsenal real del Traductor, como validacion: la recta que colapsa de
 * `docs/09` seccion 5.2, y de los tres de esa seccion el que mas lanzo en
 * altitud extrema (243 rectas, 63 sliders y 32 curvas en 2025), asi que lo
 * medido ahi alcanza para juzgar lo proyectado.
 */
const EXAMPLE = 'pitcher_00069/2025'

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
        example={data.arsenals.find((a) => a.key === EXAMPLE) ?? null}
        densities={projections.densities}
        factors={projections.factors}
      />
    </PageShell>
  )
}
