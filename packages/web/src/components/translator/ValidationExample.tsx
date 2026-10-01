import Link from 'next/link'
import { fichaHref } from '@/domain/pitcher'
import type { ValidationRow } from '@/domain/translator'
import { formatMetric, formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

const cell = 'px-3 py-2 text-right tabular-nums whitespace-nowrap'
const head =
  'px-3 pb-2 text-[10px] font-bold tracking-widest whitespace-nowrap text-(--color-text-muted) uppercase'

/**
 * El unico ejemplo del Traductor, presentado como lo que es: una validacion.
 * Un lanzador que si lanzo en altitud extrema entra con su arsenal del mar, y
 * lo proyectado se pone junto a lo medido. Ningun numero se calcula aqui: la
 * proyeccion es la de la API y lo medido es el de `arsenals.json`.
 */
export const ValidationExample = ({
  pitcherId,
  season,
  rows,
}: {
  readonly pitcherId: string
  readonly season: number
  readonly rows: readonly ValidationRow[]
}) => {
  const copy = es.translator.example
  const measured = (value: number | undefined): string =>
    value === undefined ? copy.noSample : formatNumber(value)
  return (
    <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
      <h2 className="text-[15px] font-bold">{copy.title}</h2>
      <p className="text-[13px]">{copy.lead(pitcherId, String(season))}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-(--color-ink)">
              {copy.columns.map((c, i) => (
                <th key={c} className={`${head} ${i === 0 ? 'text-left' : 'text-right'}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pitchType} className="border-b border-(--color-border-hairline)">
                <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.pitchType}</td>
                <td className={cell}>{formatMetric(r.projected.ivb)}</td>
                <td className={cell}>{measured(r.measured?.ivb)}</td>
                <td className={cell}>{formatMetric(r.projected.horizontalBreak)}</td>
                <td className={cell}>{measured(r.measured?.horizontalBreak)}</td>
                <td className={cell}>
                  {r.measured === null ? copy.noSample : formatNumber(r.measured.n, 0)}
                </td>
                <td className={`${cell} font-semibold`}>
                  {r.isWithinBand === null
                    ? copy.noSample
                    : r.isWithinBand
                      ? copy.within
                      : copy.outside}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-(--color-text-muted)">{copy.note}</p>
      <Link
        href={fichaHref(pitcherId, season)}
        className="text-[13px] font-semibold text-(--color-diablos) underline"
      >
        {copy.ficha}
      </Link>
    </section>
  )
}
