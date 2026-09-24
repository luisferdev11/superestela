import { formatMetric, formatNumber } from '@/domain/format'
import type { DensityScale } from '@/domain/density'
import type { SimulateResponse } from '@/sources/simulateResponse'
import { es } from '@/i18n/es'

/**
 * La fisica visible (`docs/00` seccion 6, principio 3): que le hace el aire a
 * esta forma, eje por eje, y por que. El break de Harp Helu lleva su banda
 * medida; la velocidad de salida y el spin no se tocan, y se dice.
 */
export const AltitudePhysics = ({
  result,
  scale,
  spinRate,
}: {
  readonly result: SimulateResponse
  readonly scale: DensityScale
  readonly spinRate: number
}) => {
  const { sea, harpHelu: hh } = result
  const rows: readonly { label: string; from: string; to: string; strong: boolean }[] = [
    {
      label: es.sim.controls.ivb,
      from: `${formatNumber(sea.shape.ivb.value)}″`,
      to: `${formatMetric(hh.shape.ivb)}″`,
      strong: true,
    },
    {
      label: es.sim.controls.horizontalBreak,
      from: `${formatNumber(sea.shape.horizontalBreak.value)}″`,
      to: `${formatMetric(hh.shape.horizontalBreak)}″`,
      strong: true,
    },
    {
      label: es.sim.physics.plateSpeed,
      from: `${formatNumber(sea.approach.plateSpeed)} ${es.sim.units.releaseSpeed}`,
      to: `${formatNumber(hh.approach.plateSpeed)} ${es.sim.units.releaseSpeed}`,
      strong: false,
    },
    {
      label: es.sim.physics.vaa,
      from: `${formatNumber(sea.approach.vaa, 2)}°`,
      to: `${formatNumber(hh.approach.vaa, 2)}°`,
      strong: false,
    },
    {
      label: es.sim.controls.spinRate,
      from: `${formatNumber(spinRate, 0)} ${es.sim.units.spinRate}`,
      to: es.sim.physics.unchanged,
      strong: false,
    },
  ]
  return (
    <div className="flex flex-col gap-3">
      <div className="border-b-2 border-(--color-ink) pb-2 text-[13px] font-semibold">
        {es.sim.physics.title}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-(--color-border-hairline)">
              <th scope="row" className="py-2 text-left font-normal">
                {r.label}
              </th>
              <td className="py-2 text-right text-(--color-text-muted) tabular-nums">{r.from}</td>
              <td className="px-2 py-2 text-(--color-text-muted)">→</td>
              <td
                className={
                  r.strong
                    ? 'py-2 text-right font-bold text-(--color-semantic-stale) tabular-nums'
                    : 'py-2 text-right tabular-nums'
                }
              >
                {r.to}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bg-(--color-surface-page) p-3 text-xs leading-relaxed text-(--color-text-muted)">
        {es.sim.physics.explanation(
          formatNumber(scale.extreme.densityRatio, 3),
          formatNumber(scale.extreme.magnusRatio, 3),
        )}
      </p>
    </div>
  )
}
