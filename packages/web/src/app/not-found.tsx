import Link from 'next/link'
import { PageShell } from '@/components/chrome/PageShell'
import { loadDataset } from '@/sources/mockupSource'
import { es } from '@/i18n/es'

/**
 * The 404, in Spanish and inside the app's chrome. Next's default one is in
 * English and drops the rail, which leaves a scout with no way back.
 */
export default async function NotFound() {
  const { density, nPitches, seasons } = await loadDataset()
  return (
    <PageShell density={density} nPitches={nPitches} seasons={seasons} current="">
      <div className="flex max-w-[560px] flex-col gap-3 border border-(--color-border) bg-(--color-surface-card) p-6">
        <h1 className="text-[22px] font-bold tracking-tight">{es.notFound.title}</h1>
        <p className="text-[13px] text-(--color-text-muted)">{es.notFound.body}</p>
        <Link href="/radar" className="text-[13px]">
          {es.notFound.back}
        </Link>
      </div>
    </PageShell>
  )
}
