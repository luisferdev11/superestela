'use client'

import { useState } from 'react'
import { formatMetric, formatNumber } from '@/domain/format'
import {
  bandAgreement,
  checkAgainstMeasured,
  isExtrapolation,
  projectedPitches,
  TARGETS,
  type PitcherProjection,
  type Target,
} from '@/domain/projection'
import { es } from '@/i18n/es'

const base = 'border-b border-(--color-border-hairline) px-3 py-2 tabular-nums'
const cell = `${base} text-right`
const cellLeft = `${base} text-left`

const inches = (v: number): string => `${formatNumber(v)}″`

/**
 * La isla de P7: el estadio destino cambia la proyeccion. Contra lo medido
 * solo se compara en altitud extrema, que es el unico destino con muestra por
 * lanzador. Toda la cuenta vive en `domain/projection.ts`.
 */
export const ProjectionTable = ({
  projection,
  densities,
  factors,
}: {
  readonly projection: PitcherProjection
  readonly densities: Readonly<Record<Target, number>>
  readonly factors: Readonly<Record<Target, number>>
}) => {
  const [target, setTarget] = useState<Target>('hh')
  const pitches = projectedPitches(projection)
  const agreement = bandAgreement(projection)
  const compare = target === 'hh'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
          {es.projection.target}
        </span>
        <div className="flex border border-(--color-ink)">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === target}
              onClick={() => {
                setTarget(t)
              }}
              className={
                t === target
                  ? 'cursor-pointer border-0 bg-(--color-ink) px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'cursor-pointer border-0 bg-(--color-surface-card) px-3.5 py-1.5 text-xs'
              }
            >
              {es.projection.targets[t](formatNumber(densities[t], 3))}
            </button>
          ))}
        </div>
      </div>

      <p className="m-0 border-l-[3px] border-(--color-diablos) bg-(--color-surface-card) px-4 py-3 text-[13px] leading-relaxed">
        {es.projection.physics(
          formatNumber(densities[target], 3),
          formatNumber(factors[target], 3),
        )}
      </p>
      {isExtrapolation(target) ? (
        <p className="m-0 border-l-[3px] border-(--color-semantic-stale) bg-(--color-surface-card) px-4 py-3 text-[12px] leading-relaxed">
          {es.projection.extrapolation}
        </p>
      ) : agreement.checked > 0 ? (
        <p className="m-0 text-[12px] text-(--color-text-muted)">
          {es.projection.measuredNote}{' '}
          {es.projection.agreement(agreement.inBand, agreement.checked)}
        </p>
      ) : null}

      <section className="border border-(--color-border) bg-(--color-surface-card) p-5">
        {pitches.length === 0 ? (
          <p className="m-0 text-[13px]">{es.projection.none}</p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-[10px] tracking-widest text-(--color-text-muted) uppercase">
                {es.projection.columns
                  .filter((_, i) => compare || i < 6)
                  .map((c, i) => (
                    <th key={c} className={i === 0 ? cellLeft : cell}>
                      {c}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {pitches.map((x) => {
                const p = x.projected[target]
                const check = compare ? checkAgainstMeasured(x) : null
                const ok = check !== null && check.ivbInBand && check.horizontalBreakInBand
                return (
                  <tr key={x.pitchType}>
                    <td className={`${cellLeft} font-semibold`}>{x.pitchType}</td>
                    <td className={cell}>{`${formatNumber(100 * x.usage)}%`}</td>
                    <td className={`${cell} text-(--color-text-muted)`}>{inches(x.sea.ivb)}</td>
                    <td className={`${cell} font-semibold`}>{`${formatMetric(p.ivb)}″`}</td>
                    <td className={`${cell} text-(--color-text-muted)`}>
                      {inches(x.sea.horizontalBreak)}
                    </td>
                    <td className={`${cell} font-semibold`}>
                      {`${formatMetric(p.horizontalBreak)}″`}
                    </td>
                    {compare ? (
                      <>
                        <td className={`${cell} text-(--color-text-muted)`}>
                          {check === null
                            ? es.projection.noSample
                            : `${inches(check.measured.ivb)} · ${inches(check.measured.horizontalBreak)}`}
                        </td>
                        <td
                          className={`${cell} ${check === null ? 'text-(--color-text-faint)' : ok ? 'text-(--color-altitude-sea)' : 'font-semibold text-(--color-semantic-stale)'}`}
                        >
                          {check === null
                            ? '—'
                            : ok
                              ? es.projection.inBand
                              : es.projection.outOfBand}
                        </td>
                      </>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="mt-3 mb-0 text-[11px] text-(--color-text-muted)">{es.projection.note}</p>
      </section>
    </div>
  )
}
