import { notFound } from 'next/navigation'
import { PlanPage } from '@/components/plan/PlanPage'
import { pitcherSeasonParams } from '@/domain/pitcher'
import { loadDataset } from '@/sources/mockupSource'

/** El Plan de una temporada: estatico, y 404 si no hay tarjeta. */
export const dynamicParams = false

export async function generateStaticParams() {
  const { cards } = await loadDataset()
  return pitcherSeasonParams(cards)
}

export default async function PlanSeasonPage({ params }: PageProps<'/plan/[pitcherId]/[season]'>) {
  const { pitcherId, season } = await params
  const year = Number(season)
  if (!Number.isInteger(year)) notFound()
  return <PlanPage pitcherId={pitcherId} season={year} />
}
