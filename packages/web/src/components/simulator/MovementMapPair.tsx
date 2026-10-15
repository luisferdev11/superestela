import { MovementMap } from './MovementMap'
import { MovementMapHelp } from './MovementMapHelp'
import { cellAt, sharedExtent, sharedWhiffRange, type MapPanel } from '@/domain/movementMap'
import type { Environment } from '@/domain/types'
import type { PitchType } from '@/domain/simulator'
import type { SimulateResponse } from '@/sources/simulateResponse'
import { formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

const pct = (share: number): string => `${formatNumber(100 * share, 0)}%`

const Swatch = ({ fill, ring = false }: { readonly fill: string; readonly ring?: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
    {ring ? (
      <circle cx="6" cy="6" r="4" fill="var(--color-surface-card)" stroke="var(--color-ink)" />
    ) : (
      <rect x="1" y="1" width="10" height="10" fill={fill} />
    )}
  </svg>
)

/**
 * El tercer punto del entregable 4, literal: «visualizacion del mapa de
 * movimiento de los pitches mas y menos efectivos». Dos paneles con el mismo
 * encuadre y la misma escala de color, y debajo lo que la liga hace en la
 * zona donde cae el pitch, en cada entorno. Todo es dato observado
 * (`docs/09` seccion 3.10): no espera al modelo final.
 */
export const MovementMapPair = ({
  pitchType,
  panels,
  result,
  showExtremes,
  onShowExtremesChange,
}: {
  readonly pitchType: PitchType
  readonly panels: Readonly<Record<Environment, MapPanel>>
  readonly result: SimulateResponse
  /** Si se dibujan los pitches mas y menos efectivos de la liga. */
  readonly showExtremes: boolean
  /** Solo en modo lanzador: la casilla para mostrarlos u ocultarlos. Sin ella, no hay casilla. */
  readonly onShowExtremesChange?: (next: boolean) => void
}) => {
  const at = {
    sea: {
      ivb: result.sea.shape.ivb.value,
      horizontalBreak: result.sea.shape.horizontalBreak.value,
    },
    hh: {
      ivb: result.harpHelu.shape.ivb.value,
      horizontalBreak: result.harpHelu.shape.horizontalBreak.value,
    },
  }
  const reference = panels.sea.meanWhiffPerSwing
  const range = sharedWhiffRange([panels.sea, panels.hh], reference)
  const extent = sharedExtent([panels.sea, panels.hh], [at.sea, at.hh])
  const envs = ['sea', 'hh'] as const

  return (
    <div className="flex flex-col gap-3">
      <div className="border-b-2 border-(--color-ink) pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[13px] font-semibold">{es.sim.map.title}</div>
          <MovementMapHelp />
        </div>
        <div className="text-[11px] text-(--color-text-muted)">
          {es.sim.map.subtitle(pitchType)}
        </div>
        {onShowExtremesChange === undefined ? null : (
          <label className="mt-1.5 flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={showExtremes}
              onChange={(event) => {
                onShowExtremesChange(event.target.checked)
              }}
            />
            {es.sim.map.showExtremes}
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {envs.map((env) => (
          <MovementMap
            key={env}
            title={es.sim.map.panel[env]}
            panel={panels[env]}
            reference={reference}
            range={range}
            extent={extent}
            pitch={at[env]}
            ghost={env === 'hh' ? at.sea : null}
            showExtremes={showExtremes}
            label={es.sim.map.label(
              pitchType,
              es.sim.map.panel[env],
              formatNumber(at[env].ivb),
              formatNumber(at[env].horizontalBreak),
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-(--color-text-muted)">
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill="var(--color-altitude-sea)" />
          {es.sim.map.legend.more}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill="var(--color-altitude-extreme)" />
          {es.sim.map.legend.less}
        </span>
        {showExtremes ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Swatch fill="var(--color-ink)" />
              {es.sim.map.legend.most}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Swatch fill="" ring />
              {es.sim.map.legend.least}
            </span>
          </>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill="var(--color-diablos)" />
          {es.sim.map.legend.simulated}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs">
        {envs.map((env) => {
          const cell = cellAt(panels[env], at[env].ivb, at[env].horizontalBreak)
          return (
            <li key={env} className="tabular-nums">
              {cell === null
                ? es.sim.map.noZone(es.sim.map.panel[env])
                : es.sim.map.zone(es.sim.map.panel[env], pct(cell.whiffPerSwing), pct(reference))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
