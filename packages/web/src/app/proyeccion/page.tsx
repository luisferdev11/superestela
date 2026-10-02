import { ProjectionPage } from '@/components/projection/ProjectionPage'
import { DEFAULT_PITCHER } from '@/domain/simulator'

/** La Proyeccion abre con el lanzador de las historias de `docs/09`; el selector lleva a los demas. */
export const dynamic = 'force-static'

export default function ProyeccionIndexPage() {
  return <ProjectionPage pitcherId={DEFAULT_PITCHER} />
}
