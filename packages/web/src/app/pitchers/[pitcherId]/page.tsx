import { FichaPage } from '@/components/pitcher/FichaPage'
import { pitcherParams } from '@/domain/pitcher'
import { loadDataset } from '@/sources/mockupSource'

/**
 * La Ficha en su ultima temporada con score. Se prerenderizan los 296
 * lanzadores con score; un id que no esta da el 404 de Next, no un error.
 */
export const dynamicParams = false

export async function generateStaticParams() {
  const { cards } = await loadDataset()
  return pitcherParams(cards)
}

export default async function PitcherPage({ params }: PageProps<'/pitchers/[pitcherId]'>) {
  const { pitcherId } = await params
  return <FichaPage pitcherId={pitcherId} />
}
