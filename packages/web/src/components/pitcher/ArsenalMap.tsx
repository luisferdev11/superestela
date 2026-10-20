import { mapHalfSpan, separateLabels, type MapPitch, type Shape } from '@/domain/arsenalMap'
import { MIN_PITCHES_FOR_BASELINE } from '@/domain/simulator'
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

/** Roughly how wide a character reads at `FONT`, to keep labels from overlapping. */
const CHAR_WIDTH = 0.56 * FONT
const LINE_HEIGHT = FONT + 3

const usageText = (pitch: MapPitch): string =>
  pitch.usage === null ? es.ficha.map.noSeaUsage : es.ficha.map.usage(pitch.usage)

type PlacedLabel = {
  readonly pitch: MapPitch
  readonly x: number
  readonly y: number
  readonly anchor: 'start' | 'end'
}

/**
 * Name and usage next to the altitude point, or the sea-level one when only
 * that exists. Close shapes would print one label over another, so they are
 * nudged apart (`separateLabels`).
 */
const placeLabels = (
  pitches: readonly MapPitch[],
  x: (hb: number) => number,
  y: (ivb: number) => number,
): readonly PlacedLabel[] => {
  const raw = pitches.flatMap((pitch) => {
    const at = pitch.hh ?? pitch.sea
    if (at === null) return []
    // Near the arm-side edge the label goes to the left of the point, or it is cut.
    const isNearRight = x(at.hb) > M.left + SIZE * 0.6
    const anchor: 'start' | 'end' = isNearRight ? 'end' : 'start'
    return [
      {
        pitch,
        x: x(at.hb) + (isNearRight ? -10 : 10),
        y: y(at.ivb) + 18,
        anchor,
        width: CHAR_WIDTH * (pitch.pitchType.length + 1 + usageText(pitch).length),
      },
    ]
  })
  const ys = separateLabels(raw, LINE_HEIGHT)
  return raw.map((label, i) => ({ ...label, y: ys[i] ?? label.y }))
}

const PitchLabel = ({ label }: { readonly label: PlacedLabel }) => (
  <text
    x={label.x}
    y={label.y}
    textAnchor={label.anchor}
    fontSize={FONT}
    fill="var(--color-text)"
    stroke="var(--color-surface-card)"
    strokeWidth={3}
    paintOrder="stroke"
  >
    <tspan fontWeight="600">{label.pitch.pitchType}</tspan>
    <tspan dx="4" fill="var(--color-text-muted)">
      {usageText(label.pitch)}
    </tspan>
  </text>
)

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
  const labels = placeLabels(pitches, x, y)
  const fewAtSea = pitches.filter((p) => p.seaBelowMinimum === true).map((p) => p.pitchType)

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
          </g>
        ))}
        {/* Labels last, so no point is drawn over a name. */}
        {labels.map((label) => (
          <PitchLabel key={label.pitch.pitchType} label={label} />
        ))}
      </svg>
      <p className="text-[11px] text-(--color-text-muted)">{note}</p>
      {fewAtSea.length === 0 ? null : (
        <p className="text-[11px] text-(--color-text-muted)">
          {es.ficha.map.belowMinimum(fewAtSea.join(', '), MIN_PITCHES_FOR_BASELINE)}
        </p>
      )}
    </figure>
  )
}
