import { relativeWhiff, type Extent, type MapPanel } from '@/domain/movementMap'
import { formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

type Point = { readonly ivb: number; readonly horizontalBreak: number }

const SIZE = 300
// La letra en unidades del lienzo: el panel se dibuja a ~240 px, asi que 16
// unidades quedan en ~12 px de pantalla. Con 9, eran 5 px (14 oct).
const FONT = 22
const MARGIN = { left: 56, right: 14, top: 14, bottom: 2 * FONT + 14 }
const WIDTH = SIZE + MARGIN.left + MARGIN.right
const HEIGHT = SIZE + MARGIN.top + MARGIN.bottom
const TICK_EVERY_IN = 6

/**
 * Un panel del mapa del reto: whiff por swing observado sobre el plano de break,
 * con los pitches mas y menos efectivos del tipo encima y el pitch simulado.
 * SVG a mano (`docs/07` seccion 5.1). `role="img"` con las cifras en la
 * etiqueta, para que un lector de pantalla lea lo mismo que se ve.
 *
 * El color es la distancia a la media **a nivel del mar** del tipo, con la
 * misma escala en los dos paneles: si el panel de altitud extrema sale mas naranja,
 * es la altura, no la leyenda.
 */
export const MovementMap = ({
  title,
  panel,
  reference,
  range,
  extent,
  pitch,
  ghost,
  label,
  showExtremes = true,
}: {
  readonly title: string
  readonly panel: MapPanel
  readonly reference: number
  readonly range: number
  readonly extent: Extent
  readonly pitch: Point
  /** En el panel de altura, la forma a nivel del mar, para ver cuanto se movio. */
  readonly ghost: Point | null
  readonly label: string
  /** Los pitches mas y menos efectivos de la liga. En el laboratorio no se dibujan. */
  readonly showExtremes?: boolean
}) => {
  const x = (hb: number): number =>
    MARGIN.left + (SIZE * (hb - extent.hbMin)) / (extent.hbMax - extent.hbMin)
  const y = (ivb: number): number =>
    MARGIN.top + (SIZE * (extent.ivbMax - ivb)) / (extent.ivbMax - extent.ivbMin)
  const inches = SIZE / (extent.hbMax - extent.hbMin)
  const ticks = (lo: number, hi: number): number[] => {
    const out = []
    for (let t = Math.ceil(lo / TICK_EVERY_IN) * TICK_EVERY_IN; t <= hi; t += TICK_EVERY_IN) {
      out.push(t)
    }
    return out
  }

  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <figcaption className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
        {title}
      </figcaption>
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={label}
        className="w-full"
      >
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={SIZE}
          height={SIZE}
          fill="var(--color-surface-card)"
          stroke="var(--color-border)"
        />
        {panel.cells.map((c) => {
          const rel = relativeWhiff(c, reference)
          const strength = range === 0 ? 0 : Math.min(1, Math.abs(rel) / range)
          return (
            <rect
              key={`${String(c.ivb)}:${String(c.horizontalBreak)}`}
              x={x(c.horizontalBreak - panel.binIn / 2)}
              y={y(c.ivb + panel.binIn / 2)}
              width={panel.binIn * inches}
              height={panel.binIn * inches}
              fill={rel >= 0 ? 'var(--color-altitude-sea)' : 'var(--color-altitude-extreme)'}
              fillOpacity={0.12 + 0.7 * strength}
            />
          )
        })}
        {ticks(extent.hbMin, extent.hbMax).map((t) => (
          <g key={`x${String(t)}`}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={MARGIN.top}
              y2={MARGIN.top + SIZE}
              stroke={t === 0 ? 'var(--color-border-strong)' : 'var(--color-border-hairline)'}
            />
            <text
              x={x(t)}
              y={MARGIN.top + SIZE + FONT + 2}
              textAnchor="middle"
              fontSize={FONT}
              fill="var(--color-text-muted)"
            >
              {formatNumber(t, 0)}
            </text>
          </g>
        ))}
        {ticks(extent.ivbMin, extent.ivbMax).map((t) => (
          <g key={`y${String(t)}`}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + SIZE}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? 'var(--color-border-strong)' : 'var(--color-border-hairline)'}
            />
            <text
              x={MARGIN.left - 6}
              y={y(t) + FONT / 3}
              textAnchor="end"
              fontSize={FONT}
              fill="var(--color-text-muted)"
            >
              {formatNumber(t, 0)}
            </text>
          </g>
        ))}
        <text
          x={MARGIN.left + SIZE - 4}
          y={MARGIN.top + SIZE + 2 * FONT + 6}
          textAnchor="end"
          fontSize={FONT}
          fill="var(--color-text-muted)"
        >
          {es.sim.map.armSide}
        </text>
        <text
          x={MARGIN.left + 4}
          y={MARGIN.top + SIZE + 2 * FONT + 6}
          fontSize={FONT}
          fill="var(--color-text-muted)"
        >
          {es.sim.map.gloveSide}
        </text>
        <text
          x={MARGIN.left + 5}
          y={MARGIN.top + FONT}
          fontSize={FONT}
          fill="var(--color-text-muted)"
        >
          {es.sim.map.rises}
        </text>
        {(showExtremes ? panel.extremes : []).map((e) => (
          <circle
            key={`${e.pitcherId}:${String(e.season)}`}
            cx={x(e.horizontalBreak)}
            cy={y(e.ivb)}
            r={2.6}
            fill={e.tier === 'most' ? 'var(--color-ink)' : 'var(--color-surface-card)'}
            stroke="var(--color-ink)"
            strokeWidth={1}
          />
        ))}
        {ghost === null ? null : (
          <>
            <line
              x1={x(ghost.horizontalBreak)}
              y1={y(ghost.ivb)}
              x2={x(pitch.horizontalBreak)}
              y2={y(pitch.ivb)}
              stroke="var(--color-ink)"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(ghost.horizontalBreak)}
              cy={y(ghost.ivb)}
              r={7}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={1.5}
              strokeDasharray="2.5 2"
            />
          </>
        )}
        <circle
          cx={x(pitch.horizontalBreak)}
          cy={y(pitch.ivb)}
          r={7}
          fill="var(--color-diablos)"
          stroke="var(--color-surface-card)"
          strokeWidth={2}
        />
      </svg>
    </figure>
  )
}
