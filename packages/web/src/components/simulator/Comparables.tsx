import { formatNumber } from '@/domain/format'
import type { SimulateResponse } from '@/sources/simulateResponse'
import { es } from '@/i18n/es'

/**
 * Los pitches reales con la forma mas parecida, con lo que de verdad lograron.
 * El equipo pidio sacarlos de la vista principal (14 de octubre): en el
 * Simulador viven en un plegable cerrado, solo en el laboratorio.
 */
export const Comparables = ({ result }: { readonly result: SimulateResponse }) => {
  const { sea, harpHelu: hh } = result
  return (
    <div className="flex flex-col gap-2">
      <div className="border-b-2 border-(--color-ink) pb-2 text-[13px] font-semibold">
        {es.sim.comparables.title}
      </div>
      {(
        [
          ['sea', sea],
          ['hh', hh],
        ] as const
      ).map(([env, r]) => (
        <div key={env} className="flex flex-col gap-1">
          <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
            {es.sim.map.panel[env]}
          </div>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs">
            {r.comparables.map((c) => (
              <li
                key={`${c.pitcherId}:${String(c.season)}`}
                className="flex justify-between tabular-nums"
              >
                <span>{es.sim.comparables.row(c.pitcherId, c.season, c.n)}</span>
                <span className="text-(--color-text-muted)">
                  {formatNumber(c.releaseSpeed)} · {formatNumber(c.ivb)}″ ·{' '}
                  {formatNumber(c.horizontalBreak)}″ ·{' '}
                  {c.whiffPerSwing === null
                    ? '—'
                    : es.sim.comparables.whiff(`${formatNumber(100 * c.whiffPerSwing, 0)}%`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
