'use client'

import type { Control, SliderSpec } from '@/domain/simulator'
import { formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

/** Cuantas cifras decimales lee un coach en cada perilla. */
const DIGITS: Readonly<Record<Control, number>> = {
  releaseSpeed: 1,
  ivb: 1,
  horizontalBreak: 1,
  extension: 2,
  releaseHeight: 2,
  releaseSide: 2,
  spinRate: 0,
  spinAxis: 0,
}

const fraction = (value: number, spec: SliderSpec): number =>
  Math.min(1, Math.max(0, (value - spec.min) / (spec.max - spec.min)))

/** El pulgar mide 14 px: su centro recorre el riel menos medio pulgar a cada lado. */
const along = (f: number): string => `calc(7px + (100% - 14px) * ${String(f)})`

/**
 * Un slider que dice donde esta respecto a la liga y respecto al pitch real.
 * La banda p5-p95 va detras del riel y la marca del pitch real encima; asi el
 * coach ve de un vistazo si esta moviendo a su pitcher hacia lo normal o hacia
 * donde nadie lanza. `muted` es para el spin: se muestra, pero no domina
 * (`docs/02` P4, decision no negociable).
 */
export const PitchSlider = ({
  control,
  value,
  spec,
  baseline,
  muted = false,
  onChange,
}: {
  readonly control: Control
  readonly value: number
  readonly spec: SliderSpec
  readonly baseline: number
  readonly muted?: boolean
  readonly onChange: (control: Control, value: number) => void
}) => {
  const id = `slider-${control}`
  const low = fraction(spec.league.p5, spec)
  const high = fraction(spec.league.p95, spec)
  const mark = fraction(baseline, spec)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className={muted ? 'text-xs text-(--color-text-muted)' : 'text-xs text-(--color-text)'}
        >
          {es.sim.controls[control]}
        </label>
        <span
          className={
            muted
              ? 'text-[13px] font-semibold text-(--color-text-muted) tabular-nums'
              : 'text-[15px] font-bold tabular-nums'
          }
        >
          {formatNumber(value, DIGITS[control])}{' '}
          <span className="text-[11px] font-normal text-(--color-text-muted)">
            {es.sim.units[control]}
          </span>
        </span>
      </div>
      <div className="relative h-4">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[7px] h-0.5 bg-(--color-border-hairline)"
        />
        <div
          aria-hidden="true"
          title={es.sim.leagueBand}
          className="absolute top-[5px] h-1.5 bg-(--color-border)"
          style={{ left: along(low), width: `calc((100% - 14px) * ${String(high - low)})` }}
        />
        <div
          aria-hidden="true"
          title={es.sim.baselineMark}
          className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-(--color-altitude-sea)"
          style={{ left: along(mark) }}
        />
        <input
          id={id}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => {
            onChange(control, Number(e.target.value))
          }}
          className="pitch-slider absolute inset-0 m-0 w-full"
        />
      </div>
    </div>
  )
}
