import {
  countShares,
  meanPlateHeightIn,
  STRIKE_ZONE,
  type CountMap,
  type LocationPanel,
} from '@/domain/location'
import { formatNumber } from '@/domain/format'
import type { Metric } from '@/domain/types'
import { es } from '@/i18n/es'

const W = 220
const H = 260
// El marco cuando no hay datos: el mismo rango que usa el prototipo.
const SIDE: readonly [number, number] = [-2, 2]
const HEIGHT: readonly [number, number] = [0.5, 4.5]

/**
 * Location+ en grande: el equipo lo pidio asi (20 oct), porque es la cifra de
 * la pestana y quedaba como una nota al pie.
 */
export const LocationPlusFigure = ({ metric }: { readonly metric: Metric | null }) => (
  <div className="flex flex-col gap-0.5 border-l-4 border-(--color-ink) pl-3">
    <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
      {es.ficha.location.locationPlusTitle}
    </span>
    {metric === null ? (
      <span className="text-[13px] text-(--color-text-muted)">
        {es.ficha.location.locationPlusNone}
      </span>
    ) : (
      <span className="tabular-nums">
        <span className="text-[30px] leading-none font-bold">{formatNumber(metric.value)}</span>{' '}
        <span className="text-[14px] text-(--color-text-muted)">
          {'±'} {formatNumber(metric.se)}
        </span>
      </span>
    )}
    <span className="text-[11px] leading-snug text-(--color-text-muted)">
      {es.ficha.location.locationPlusHelp}
    </span>
  </div>
)

/**
 * Los dos lados de la zona, escritos: el mapa es la vista del catcher y se
 * confundia con la del lanzador, que usan los mapas de movimiento (20 oct).
 */
const ZoneSides = () => (
  <div className="flex justify-between gap-2 text-[11px] leading-tight text-(--color-text-muted)">
    <span>{es.ficha.location.sides.left}</span>
    <span className="text-right">{es.ficha.location.sides.right}</span>
  </div>
)

/** La zona de strike con una celda por conteo, vista del catcher, con sus dos lados escritos. */
export const ZoneGrid = ({
  grid,
  max,
  side = SIDE,
  height = HEIGHT,
  label,
  tone = 'var(--color-diablos)',
}: {
  readonly grid: readonly (readonly number[])[] | null
  readonly max: number
  readonly side?: readonly [number, number]
  readonly height?: readonly [number, number]
  readonly label: string
  readonly tone?: string
}) => {
  const x = (ft: number): number => (W * (ft - side[0])) / (side[1] - side[0])
  const y = (ft: number): number => (H * (height[1] - ft)) / (height[1] - height[0])
  const rows = grid?.length ?? 0
  const cols = grid?.[0]?.length ?? 0
  return (
    <div className="flex w-full max-w-[280px] flex-col gap-1 self-center">
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="w-full border border-(--color-border-hairline) bg-(--color-surface-page)"
        role="img"
        aria-label={label}
      >
        {grid?.map((row, r) =>
          row.map((v, c) => (
            <rect
              key={`${String(r)}-${String(c)}`}
              x={(W * c) / cols}
              y={(H * r) / rows}
              width={W / cols}
              height={H / rows}
              fill={tone}
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
      <ZoneSides />
    </div>
  )
}

/** Un mapa de conteos ya hecho proporciones, con la celda mas densa como referencia. */
export const sharesOf = (map: CountMap | null): readonly (readonly number[])[] | null =>
  map === null || map.nPitches === 0 ? null : countShares(map)

/**
 * Donde pone sus lanzamientos, en un entorno (`Arsenal.dc.html`). Si el
 * equipo de datos aun no entrega la ubicacion, dibuja el marco y la zona y lo
 * dice: la estructura de la pantalla queda lista y ninguna cifra se inventa.
 *
 * Con `focus`, dibuja solo un tipo de pitch: su mapa, su muestra y su
 * Location+ (el filtro por tipo que pidio el equipo, 20 oct).
 */
export const LocationMap = ({
  title,
  panel,
  max,
  focus,
}: {
  readonly title: string
  readonly panel: LocationPanel | null
  /** La celda mas densa de los dos entornos, para que compartan escala de color. */
  readonly max: number
  readonly focus?: { readonly pitch: string; readonly map: CountMap | null }
}) => {
  const grid = focus === undefined ? (panel?.grid ?? null) : sharesOf(focus.map)
  const n = focus === undefined ? (panel?.nPitches ?? null) : (focus.map?.nPitches ?? null)
  const locationPlus =
    focus === undefined ? (panel?.locationPlus ?? null) : (focus.map?.locationPlus ?? null)
  const pending = focus === undefined ? panel === null : focus.map === null

  return (
    <figure className="m-0 flex flex-1 flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-[12px]">
        <span className="font-bold">{title}</span>
        <span className="text-(--color-text-muted)">
          {n === null ? es.ficha.location.view : es.ficha.location.pitches(n)}
        </span>
      </figcaption>
      <LocationPlusFigure metric={pending ? null : locationPlus} />
      <span className="text-center text-[10px] tracking-widest text-(--color-text-muted) uppercase">
        {es.ficha.location.view}
      </span>
      <ZoneGrid
        grid={grid}
        max={max}
        side={panel?.sideRangeFt}
        height={panel?.heightRangeFt}
        label={
          n === null ? es.ficha.location.pendingLabel(title) : es.ficha.location.mapLabel(title, n)
        }
      />
      <p className="text-[11px] leading-snug text-(--color-text-muted)">
        {focus !== undefined
          ? focus.map === null
            ? es.ficha.location.fewOfType(focus.pitch)
            : es.ficha.location.onlyType(focus.pitch)
          : panel === null
            ? `${es.ficha.location.pending} ${es.ficha.location.pendingDetail}`
            : es.ficha.location.stats(
                formatNumber(meanPlateHeightIn(panel)),
                formatNumber(100 * panel.zoneShare),
                formatNumber(100 * panel.whiffPerSwing),
              )}
      </p>
    </figure>
  )
}
