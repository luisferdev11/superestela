import { simulatorHref, type PitcherArsenal } from '@/domain/simulator'
import type { TranslatorRow } from '@/domain/translator'
import type { Metric } from '@/domain/types'
import { formatMetric, formatNumber, formatSigned, formatSignedMetric } from '@/domain/format'
import type { SimulateResponse } from '@/sources/simulateResponse'
import { es } from '@/i18n/es'

const cell = 'px-3 py-2 text-right tabular-nums whitespace-nowrap'
const head =
  'px-3 pb-2 text-[10px] font-bold tracking-widest whitespace-nowrap text-(--color-text-muted) uppercase'

/** La forma en los dos aires: la de altitud extrema en negritas, que es la que cambia. */
const Moved = ({ from, to }: { readonly from: Metric; readonly to: Metric }) => (
  <>
    <span className="text-(--color-text-muted)">
      {from.se === 0 ? formatNumber(from.value) : formatMetric(from)}
    </span>
    {' → '}
    <span className="font-semibold">{formatMetric(to)}</span>
  </>
)

const score = (metric: Metric | null): string =>
  metric === null ? es.translator.kpi.none : formatMetric(metric)

/**
 * Pitch por pitch, lo que contesto la API: la forma a nivel del mar y en
 * altitud extrema con su banda, el Stuff+ en los dos, el cambio, y lo que
 * queda del engano contra su recta. Ningun numero se calcula aqui.
 */
export const TranslationTable = ({
  rows,
  shares,
  results,
  simulatorFrom,
}: {
  readonly rows: readonly TranslatorRow[]
  readonly shares: readonly number[]
  readonly results: readonly SimulateResponse[]
  /** El arsenal real del que salio la tabla, si no se ha tocado: cada pitch abre en el Simulador. */
  readonly simulatorFrom: PitcherArsenal | null
}) => (
  <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
    <h2 className="text-[15px] font-bold">{es.translator.results.title}</h2>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-(--color-ink)">
            {es.translator.results.columns.map((c, i) => (
              <th key={c} className={`${head} ${i === 0 ? 'text-left' : 'text-right'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const result = results[i]
            if (result === undefined) return null
            const versus = result.harpHelu.differentials
            return (
              <tr key={r.pitchType} className="border-b border-(--color-border-hairline)">
                <td className="px-3 py-2 text-left">
                  <div className="flex flex-col">
                    <span className="font-semibold whitespace-nowrap">{r.pitchType}</span>
                    {result.plausibility.isPlausible ? null : (
                      <span
                        className="text-[11px] text-(--color-diablos)"
                        title={es.translator.results.unusualNote}
                      >
                        {es.translator.results.unusual}
                      </span>
                    )}
                    {simulatorFrom === null ? null : (
                      <a
                        className="text-[11px] whitespace-nowrap"
                        href={simulatorHref(
                          simulatorFrom.pitcherId,
                          simulatorFrom.season,
                          r.pitchType,
                        )}
                      >
                        {es.translator.results.openInSimulator}
                      </a>
                    )}
                  </div>
                </td>
                <td className={cell}>{`${formatNumber(100 * (shares[i] ?? 0))}%`}</td>
                <td className={cell}>
                  <Moved from={result.sea.shape.ivb} to={result.harpHelu.shape.ivb} />
                </td>
                <td className={cell}>
                  <Moved
                    from={result.sea.shape.horizontalBreak}
                    to={result.harpHelu.shape.horizontalBreak}
                  />
                </td>
                <td className={`${cell} text-(--color-text-muted)`}>
                  {score(result.sea.stuffPlus)}
                </td>
                <td className={`${cell} font-semibold`}>{score(result.harpHelu.stuffPlus)}</td>
                <td className={cell}>
                  {result.altitudeDelta === null
                    ? es.translator.kpi.none
                    : formatSignedMetric(result.altitudeDelta.total)}
                </td>
                <td className={`${cell} text-(--color-text-muted)`}>
                  {result.primaryFastball === null
                    ? es.translator.results.noFastball
                    : versus === null
                      ? es.translator.results.anchor
                      : es.translator.results.versusFastball(
                          formatSigned(versus.releaseSpeed),
                          formatSigned(versus.ivb),
                        )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    <p className="text-[11px] text-(--color-text-muted)">{es.translator.results.note}</p>
  </section>
)
