import { meanPlateHeightIn, STRIKE_ZONE, type LocationPanel } from '@/domain/location'
import { formatMetric, formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

const W = 220
const H = 260
// El marco cuando no hay datos: el mismo rango que usa el prototipo.
const SIDE: readonly [number, number] = [-2, 2]
const HEIGHT: readonly [number, number] = [0.5, 4.5]

/**
 * Donde pone sus lanzamientos, en un entorno (`Arsenal.dc.html`). Si el
 * equipo de datos aun no entrega la ubicacion, dibuja el marco y la zona y lo
 * dice: la estructura de la pantalla queda lista y ninguna cifra se inventa.
 */
export const LocationMap = ({
  title,
  panel,
  max,
}: {
  readonly title: string
  readonly panel: LocationPanel | null
  /** La celda mas densa de los dos entornos, para que compartan escala de color. */
  readonly max: number
}) => {
  const side = panel?.sideRangeFt ?? SIDE
  const height = panel?.heightRangeFt ?? HEIGHT
  const x = (ft: number): number => (W * (ft - side[0])) / (side[1] - side[0])
  const y = (ft: number): number => (H * (height[1] - ft)) / (height[1] - height[0])
  const rows = panel?.grid.length ?? 0
  const cols = panel?.grid[0]?.length ?? 0

  return (
    <figure className="m-0 flex flex-1 flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-[12px]">
        <span className="font-bold">{title}</span>
        <span className="text-(--color-text-muted)">
          {panel === null ? es.ficha.location.view : es.ficha.location.pitches(panel.nPitches)}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="w-full max-w-[260px] self-center border border-(--color-border-hairline) bg-(--color-surface-page)"
        role="img"
        aria-label={
          panel === null
            ? es.ficha.location.pendingLabel(title)
            : es.ficha.location.mapLabel(title, panel.nPitches)
        }
      >
        {panel?.grid.map((row, r) =>
          row.map((v, c) => (
            <rect
              key={`${String(r)}-${String(c)}`}
              x={(W * c) / cols}
              y={(H * r) / rows}
              width={W / cols}
              height={H / rows}
              fill="var(--color-diablos)"
              fillOpacity={v / max}
            />
          )),
        )}
        <rect
          x={x(STRIKE_ZONE.side[0])}
          y={y(STRIKE_ZONE.height[1])}
          width={x(STRIKE_ZONE.side[1]) - x(STRIKE_ZONE.side[0])}
          height={y(STRIKE_ZONE.height[0]) - y(STRIKE_ZONE.height[1])}
          fill="none"
          stroke="var(--color-text)"
          strokeWidth="1.5"
        />
      </svg>
      <p className="text-[11px] leading-snug text-(--color-text-muted)">
        {panel === null
          ? `${es.ficha.location.pending} ${es.ficha.location.pendingDetail}`
          : es.ficha.location.stats(
              formatNumber(meanPlateHeightIn(panel)),
              formatNumber(100 * panel.zoneShare),
              formatNumber(100 * panel.whiffPerSwing),
            )}
      </p>
      {panel?.locationPlus == null ? null : (
        <p className="text-[11px] leading-snug text-(--color-text-muted)">
          {es.ficha.location.locationPlus(formatMetric(panel.locationPlus))}
        </p>
      )}
    </figure>
  )
}
