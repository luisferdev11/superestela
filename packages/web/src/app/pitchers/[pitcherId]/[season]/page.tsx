import { notFound } from 'next/navigation'
import { FichaPage } from '@/components/pitcher/FichaPage'
import { pitcherSeasonParams } from '@/domain/pitcher'
import { loadDataset } from '@/sources/mockupSource'

/** La Ficha en una temporada. Un segmento y no `?season=`, para seguir siendo estatica. */
export const dynamicParams = false

export async function generateStaticParams() {
  const { cards } = await loadDataset()
  return pitcherSeasonParams(cards)
}

export default async function PitcherSeasonPage({
  params,
}: PageProps<'/pitchers/[pitcherId]/[season]'>) {
  const { pitcherId, season } = await params
  const year = Number(season)
  if (!Number.isInteger(year)) notFound()
  return <FichaPage pitcherId={pitcherId} season={year} />
}
