import { notFound } from 'next/navigation'
import { ProjectionPage } from '@/components/projection/ProjectionPage'
import { pitcherSeasonParams } from '@/domain/pitcher'
import { loadDataset } from '@/sources/mockupSource'

/** La Proyeccion de una temporada: estatica, y 404 si no hay tarjeta. */
export const dynamicParams = false

export async function generateStaticParams() {
  const { cards } = await loadDataset()
  return pitcherSeasonParams(cards)
}

export default async function ProyeccionSeasonPage({
  params,
}: PageProps<'/proyeccion/[pitcherId]/[season]'>) {
  const { pitcherId, season } = await params
  const year = Number(season)
  if (!Number.isInteger(year)) notFound()
  return <ProjectionPage pitcherId={pitcherId} season={year} />
}
