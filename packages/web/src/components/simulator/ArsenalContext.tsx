import { formatSigned } from '@/domain/format'
import type { SimulateResponse } from '@/sources/simulateResponse'
import { es } from '@/i18n/es'

/**
 * El arsenal, que el reto hace criterio de evaluacion: el pitch contra su recta
 * primaria en los dos entornos. Los diferenciales de movimiento se encogen en
 * la altura y los de velocidad no; la tabla lo deja ver sin explicarlo dos
 * veces. Los pitches reales parecidos viven aparte (`Comparables`).
 */
export const ArsenalContext = ({
  result,
  pitchType,
}: {
  readonly result: SimulateResponse
  readonly pitchType: string
}) => {
  const { sea, harpHelu: hh, primaryFastball } = result
  const rows =
    sea.differentials === null || hh.differentials === null
      ? []
      : ([
          [
            es.sim.arsenal.velocity,
            sea.differentials.releaseSpeed,
            hh.differentials.releaseSpeed,
            es.sim.units.releaseSpeed,
          ],
          [es.sim.controls.ivb, sea.differentials.ivb, hh.differentials.ivb, '″'],
          [
            es.sim.controls.horizontalBreak,
            sea.differentials.horizontalBreak,
            hh.differentials.horizontalBreak,
            '″',
          ],
          [
            es.sim.arsenal.release,
            sea.differentials.releaseDistance,
            hh.differentials.releaseDistance,
            'ft',
          ],
        ] as const)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="border-b-2 border-(--color-ink) pb-2 text-[13px] font-semibold">
          {primaryFastball === null ? es.sim.arsenal.none : es.sim.arsenal.title(primaryFastball)}
        </div>
        {primaryFastball !== null && rows.length === 0 ? (
          <p className="m-0 text-xs text-(--color-text-muted)">
            {primaryFastball === pitchType ? es.sim.arsenal.anchor : es.sim.arsenal.none}
          </p>
        ) : null}
        {rows.length === 0 ? null : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] tracking-widest text-(--color-text-muted) uppercase">
                  <th scope="col" className="pb-1 text-left font-bold" />
                  <th scope="col" className="pb-1 text-right font-bold">
                    {es.sim.map.panel.sea}
                  </th>
                  <th scope="col" className="pb-1 text-right font-bold">
                    {es.sim.map.panel.hh}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, atSea, atHh, unit]) => (
                  <tr key={label} className="border-t border-(--color-border-hairline)">
                    <th scope="row" className="py-1.5 text-left font-normal">
                      {label}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatSigned(atSea)} {unit}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {formatSigned(atHh)} {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 text-[11px] leading-relaxed text-(--color-text-muted)">
              {es.sim.arsenal.shrink}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
