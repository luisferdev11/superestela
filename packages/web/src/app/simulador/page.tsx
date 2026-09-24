import { loadDataset } from '@/sources/mockupSource'
import { loadSimulatorDataset } from '@/sources/simulatorSource'
import { NavRail } from '@/components/chrome/NavRail'
import { Simulator } from '@/components/simulator/Simulator'
import { es } from '@/i18n/es'

/**
 * P4, el entregable 4 del reto (`docs/09`). Lo fijo —rangos, arsenales, mapa,
 * veredicto de las compuertas— se lee en el servidor y se prerenderiza; el
 * score lo pide el cliente a la API cada vez que se mueve un slider.
 */
export const dynamic = 'force-static'

export default async function SimuladorPage() {
  const [{ density, nPitches, seasons }, data] = await Promise.all([
    loadDataset(),
    loadSimulatorDataset(),
  ])
  return (
    <div className="flex min-h-screen bg-(--color-surface-page)">
      <NavRail scale={density} nPitches={nPitches} seasons={seasons} current="/simulador" />
      <main className="flex min-w-0 grow flex-col gap-4 px-8 py-7">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{es.sim.title}</h1>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">{es.sim.subtitle}</p>
        </div>
        <Simulator
          distributions={data.distributions}
          maps={data.maps}
          arsenals={data.arsenals}
          scale={density}
          validation={data.validation}
        />
      </main>
    </div>
  )
}
