import { notFound } from 'next/navigation'
import { FichaPage } from '@/components/pitcher/FichaPage'
import { pitcherSeasonParams } from '@/domain/pitcher'
import { loadDataset } from '@/sources/mockupSource'

/** La pestana Arsenal de la Ficha: la forma de cada pitch y donde los pone. */
export const dynamicParams = false

export async function generateStaticParams() {
  const { cards } = await loadDataset()
  return pitcherSeasonParams(cards)
}

export default async function PitcherArsenalPage({
  params,
}: PageProps<'/pitchers/[pitcherId]/[season]/arsenal'>) {
  const { pitcherId, season } = await params
  const year = Number(season)
  if (!Number.isInteger(year)) notFound()
  return <FichaPage pitcherId={pitcherId} season={year} tab="arsenal" />
}
