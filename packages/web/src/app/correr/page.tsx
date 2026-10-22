import { PageShell } from '@/components/chrome/PageShell'
import { loadDataset } from '@/sources/mockupSource'
import { es } from '@/i18n/es'

export const dynamic = 'force-static'

const Code = ({ lines }: { readonly lines: readonly string[] }) => (
  <pre className="overflow-x-auto border border-(--color-border) bg-(--color-surface-page) p-4 text-[13px] leading-relaxed">
    {lines.join('\n')}
  </pre>
)

/**
 * Como correr SuperEstela completo: la version en linea es estatica, y el
 * repositorio es privado, asi que las instrucciones viven tambien aqui.
 */
export default async function CorrerPage() {
  const { density, nPitches, seasons } = await loadDataset()
  const r = es.run
  return (
    <PageShell density={density} nPitches={nPitches} seasons={seasons} current="/correr">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">{r.title}</h1>
        <p className="mt-0.5 max-w-3xl text-[13px] text-(--color-text-muted)">{r.subtitle}</p>
      </div>
      <section className="flex max-w-3xl flex-col gap-3 border border-(--color-border) bg-(--color-surface-card) p-5 text-[13px]">
        <h2 className="text-[15px] font-bold">{r.needs.title}</h2>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
          {r.needs.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h2 className="text-[15px] font-bold">{r.steps.title}</h2>
        <Code lines={r.steps.commands} />
        <p className="text-(--color-text-muted)">{r.steps.note}</p>
        <h2 className="text-[15px] font-bold">{r.why.title}</h2>
        <p>{r.why.text}</p>
      </section>
    </PageShell>
  )
}
