import type { Route } from 'next'
import Link from 'next/link'
import { MetricValue } from '@/components/metric/MetricValue'
import { arsenalRows } from '@/domain/arsenal'
import { formatNumber } from '@/domain/format'
import type { Metric, PitcherSeason } from '@/domain/types'
import { es } from '@/i18n/es'

const base = 'border-b border-(--color-border-hairline) px-3 py-2 tabular-nums'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

const Arrow = () => (
  <span aria-hidden="true" className="px-1 text-(--color-text-faint)">
    {'→'}
  </span>
)

/** Una forma medida en los dos entornos: la de altitud extrema en negritas, que es la que cambia. */
const Shape = ({ sea, hh }: { readonly sea: number | null; readonly hh: number | null }) => (
  <>
    <span className="text-(--color-text-muted)">{sea === null ? '—' : formatNumber(sea)}</span>
    <Arrow />
    <span className="font-semibold">{hh === null ? '—' : formatNumber(hh)}</span>
  </>
)

/** Un Stuff+ sin muestra a nivel del mar no es «no concluyente»: es que no hay con que comparar. */
const Score = ({ metric }: { readonly metric: Metric | null }) =>
  metric === null ? (
    <span className="text-(--color-semantic-inconclusive)">{es.ficha.arsenal.noSea}</span>
  ) : (
    <MetricValue metric={metric} />
  )

const SimulateLink = ({ pitch, href }: { readonly pitch: string; readonly href?: Route }) =>
  href === undefined ? null : (
    <Link href={href} aria-label={es.ficha.arsenal.simulateLabel(pitch)}>
      {es.ficha.arsenal.simulate}
    </Link>
  )

/**
 * El arsenal pitch por pitch, en los dos entornos (`Ficha.dc.html`). Cada
 * Stuff+ lleva su banda (#36); ninguna cifra se escribe aqui, todas salen de
 * la tarjeta.
 */
export const ArsenalTable = ({
  card,
  simulatorHrefs,
}: {
  readonly card: PitcherSeason
  /** El enlace al Simulador de cada pitch que tiene de donde partir; los demas no llevan. */
  readonly simulatorHrefs: Readonly<Partial<Record<string, Route>>>
}) => (
  <section className="flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
    <h2 className="text-[15px] font-bold">{es.ficha.arsenal.title}</h2>
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-[10px] tracking-widest text-(--color-text-muted) uppercase">
          {es.ficha.arsenal.columns.map((c, i) => (
            <th key={c} className={i === 0 ? cellLeft : cell}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {arsenalRows(card).map((row) => (
          <tr key={row.pitch}>
            <td className={`${cellLeft} font-semibold`}>{row.pitch}</td>
            <td className={cell}>{`${formatNumber(row.usagePct)}%`}</td>
            <td className={cell}>{row.velo === null ? '—' : formatNumber(row.velo)}</td>
            <td className={cell}>
              <Shape sea={row.ivbSea} hh={row.ivbHh} />
            </td>
            <td className={cell}>
              <Shape sea={row.absHbSea} hh={row.absHbHh} />
            </td>
            <td className={cell}>{row.spin ?? '—'}</td>
            <td className={cell}>
              <Score metric={row.stuffPlusSea} />
              <Arrow />
              <Score metric={row.stuffPlusHh} />
            </td>
            <td className={cell}>
              {row.whiffPerSwing === null ? '—' : `${formatNumber(row.whiffPerSwing)}%`}
            </td>
            <td className={cell}>
              <SimulateLink pitch={row.pitch} href={simulatorHrefs[row.pitch]} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="text-[11px] text-(--color-text-muted)">{es.ficha.arsenal.measuredAt}</p>
  </section>
)
