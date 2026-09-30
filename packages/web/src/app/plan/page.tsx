import { PlanPage } from '@/components/plan/PlanPage'
import { DEFAULT_PITCHER } from '@/domain/simulator'

/** El Plan abre con el lanzador de las historias de `docs/09`; el selector lleva a los demas. */
export const dynamic = 'force-static'

export default function PlanIndexPage() {
  return <PlanPage pitcherId={DEFAULT_PITCHER} />
}
