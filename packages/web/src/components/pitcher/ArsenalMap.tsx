import { mapHalfSpan, type MapPitch, type Shape } from '@/domain/arsenalMap'
import { formatNumber } from '@/domain/format'
import { MovementMapHelp } from '@/components/map/MovementMapHelp'
import { es } from '@/i18n/es'

const SIZE = 360
// La letra en unidades del lienzo: el mapa se dibuja a ~400 px, casi 1 a 1.
const FONT = 14
const M = { left: 46, right: 16, top: 16, bottom: 2 * FONT + 18 }
const WIDTH = SIZE + M.left + M.right
const HEIGHT = SIZE + M.top + M.bottom
const STEP_IN = 6

const shapeText = (s: Shape | null): string =>
  s === null ? es.ficha.map.none : `${formatNumber(s.ivb)}″ IVB, ${formatNumber(s.hb)}″ HB`

/** El nombre y el uso junto al punto de altura, o al del mar si solo ahi hay muestra. */
const PitchLabel = ({
  pitch,
  x,
  y,
}: {
  readonly pitch: MapPitch
  readonly x: (hb: number) => number
  readonly y: (ivb: number) => number
}) => {
  const at = pitch.hh ?? pitch.sea
  if (at === null) return null
  // Cerca del borde del brazo, la etiqueta va a la izquierda del punto: si no, se corta.
  const isNearRight = x(at.hb) > M.left + SIZE * 0.6
  return (
    <text
      x={x(at.hb) + (isNearRight ? -10 : 10)}
      y={y(at.ivb) + 18}
      textAnchor={isNearRight ? 'end' : 'start'}
      fontSize={FONT}
      fill="var(--color-text)"
    >
      <tspan fontWeight="600">{pitch.pitchType}</tspan>
      <tspan dx="4" fill="var(--color-text-muted)">
        {es.ficha.map.usage(pitch.usage)}
      </tspan>
    </text>
  )
}

/**
 * El arsenal completo sobre el plano de break (`Ficha.dc.html`): cada pitch a
 * nivel del mar y en altitud extrema, unidos por la flecha de lo que pierde, con
 * el promedio de la liga de su tipo como referencia. Todo medido, nada
 * simulado. SVG a mano (`docs/07` seccion 5.1), con las cifras en la etiqueta
 * para un lector de pantalla.
 */
export const ArsenalMap = ({
  pitches,
  legend = { sea: es.ficha.map.sea, hh: es.ficha.map.hh },
  note = es.ficha.map.note,
}: {
  readonly pitches: readonly MapPitch[]
  /** El Traductor dibuja formas proyectadas, no medidas, y lo dice en la leyenda y la nota. */
  readonly legend?: { readonly sea: string; readonly hh: string }
  readonly note?: string
}) => {
  const half = mapHalfSpan(pitches)
  const x = (hb: number): number => M.left + (SIZE * (hb + half)) / (2 * half)
  const y = (ivb: number): number => M.top + (SIZE * (half - ivb)) / (2 * half)
  const ticks: number[] = []
  for (let t = -half; t <= half; t += STEP_IN) ticks.push(t)

  return (
    <figure className="m-0 flex flex-col gap-2 border border-(--color-border) bg-(--color-surface-card) p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="flex w-full items-start justify-between gap-3">
          <span className="text-[15px] font-bold">{es.ficha.map.title}</span>
          <MovementMapHelp />
        </span>
        <span className="flex gap-4 text-[11px] text-(--color-text-muted)">
          <span>
            <span aria-hidden="true" className="text-(--color-altitude-sea)">
              {'○ '}
            </span>
            {legend.sea}
          </span>
          <span>
            <span aria-hidden="true" className="text-(--color-diablos)">
              {'● '}
            </span>
            {legend.hh}
          </span>
          {pitches.some((p) => p.league !== null) ? (
            <span>
              <span aria-hidden="true">{'+ '}</span>
              {es.ficha.map.league}
            </span>
          ) : null}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        className="w-full max-w-[520px] self-center"
        role="img"
        aria-label={pitches
          .map((p) => es.ficha.map.label(p.pitchType, shapeText(p.sea), shapeText(p.hh)))
          .join('. ')}
      >
        <defs>
          <marker
            id="arsenal-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="var(--color-text-faint)" />
          </marker>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={M.top}
              y2={M.top + SIZE}
              stroke="var(--color-border-hairline)"
              strokeWidth={t === 0 ? 1.5 : 1}
            />
            <line
              x1={M.left}
              x2={M.left + SIZE}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-border-hairline)"
              strokeWidth={t === 0 ? 1.5 : 1}
            />
            <text
              x={x(t)}
              y={M.top + SIZE + FONT + 4}
              textAnchor="middle"
              fontSize={FONT}
              fill="var(--color-text-muted)"
            >
              {t}
            </text>
            <text
              x={M.left - 6}
              y={y(t) + FONT / 3}
              textAnchor="end"
              fontSize={FONT}
              fill="var(--color-text-muted)"
            >
              {t}
            </text>
          </g>
        ))}
        <text
          x={M.left + SIZE}
          y={M.top + SIZE + 2 * FONT + 10}
          textAnchor="end"
          fontSize={FONT}
          fill="var(--color-text-muted)"
        >
          {es.ficha.map.arm}
        </text>
        <text
          x={M.left}
          y={M.top + SIZE + 2 * FONT + 10}
          fontSize={FONT}
          fill="var(--color-text-muted)"
        >
          {es.ficha.map.glove}
        </text>
        <text
          x={M.left + SIZE / 2}
          y={M.top + SIZE + 2 * FONT + 10}
          textAnchor="middle"
          fontSize={FONT}
          fill="var(--color-text-muted)"
        >
          {es.ficha.map.axisX}
        </text>
        <text x={M.left + 4} y={M.top + 10} fontSize={FONT} fill="var(--color-text-muted)">
          {`${es.ficha.map.axisY} · ${es.ficha.map.up}`}
        </text>
        <text x={M.left + 4} y={M.top + SIZE - 4} fontSize={FONT} fill="var(--color-text-muted)">
          {es.ficha.map.down}
        </text>

        {pitches.map((p) => (
          <g key={p.pitchType}>
            {p.league === null ? null : (
              <text
                x={x(p.league.hb)}
                y={y(p.league.ivb) + 4}
                textAnchor="middle"
                fontSize="13"
                fill="var(--color-text-faint)"
              >
                {'+'}
              </text>
            )}
            {p.sea !== null && p.hh !== null ? (
              <line
                x1={x(p.sea.hb)}
                y1={y(p.sea.ivb)}
                x2={x(p.hh.hb)}
                y2={y(p.hh.ivb)}
                stroke="var(--color-text-faint)"
                strokeWidth="1.2"
                markerEnd="url(#arsenal-arrow)"
              />
            ) : null}
            {p.sea === null ? null : (
              <circle
                cx={x(p.sea.hb)}
                cy={y(p.sea.ivb)}
                r="6"
                fill="var(--color-surface-card)"
                stroke="var(--color-altitude-sea)"
                strokeWidth="2"
              />
            )}
            {p.hh === null ? null : (
              <circle cx={x(p.hh.hb)} cy={y(p.hh.ivb)} r="6" fill="var(--color-diablos)" />
            )}
            <PitchLabel pitch={p} x={x} y={y} />
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-(--color-text-muted)">{note}</p>
    </figure>
  )
}
