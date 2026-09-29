'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { formatNumber, formatSignedMetric, formatMetric } from '@/domain/format'
import {
  DEFAULT_SHIFT,
  SHIFT_STEPS,
  shiftHelps,
  shiftUsage,
  type Plan,
  type ShapeLoss,
} from '@/domain/plan'
import { es } from '@/i18n/es'

const Row = ({
  label,
  children,
  first = false,
}: {
  readonly label: string
  readonly children: ReactNode
  readonly first?: boolean
}) => (
  <div
    className={`flex items-start gap-4 ${first ? '' : 'border-t border-(--color-border-hairline) pt-3.5'}`}
  >
    <div className="w-[92px] shrink-0 pt-0.5 text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
      {label}
    </div>
    <div className="flex flex-col gap-2 text-[15px] leading-relaxed">{children}</div>
  </div>
)

const seaOf = (p: ShapeLoss, plan: Plan): number => {
  const hh = plan.contributions.find((c) => c.pitch === p.pitch)?.stuffPlusHh.value ?? Number.NaN
  return hh - p.delta.value
}
const hhOf = (p: ShapeLoss, plan: Plan): number =>
  plan.contributions.find((c) => c.pitch === p.pitch)?.stuffPlusHh.value ?? Number.NaN

const ivbText = (p: ShapeLoss): string =>
  p.ivbSea === null || p.ivbHh === null
    ? ''
    : es.plan.ivb(formatNumber(p.ivbSea), formatNumber(p.ivbHh))

/**
 * Las tres frases de `docs/02` P5. La unica parte interactiva es cuanto uso se
 * mueve: el coach prueba 10, 20 o 30 puntos y ve el Stuff+ ponderado con su
 * banda. Toda la cuenta vive en `domain/plan.ts`.
 */
export const PlanSentences = ({
  plan,
  simulatorHref,
}: {
  readonly plan: Plan
  /** Para probar en el Simulador el pitch que aguanta, si tiene de donde partir. */
  readonly simulatorHref: Route | null
}) => {
  const [points, setPoints] = useState<number>(DEFAULT_SHIFT)
  const { degrades, holds } = plan
  const shift = shiftUsage(plan, points)
  const helps = shiftHelps(plan)
  const fromBefore = plan.contributions.find((c) => c.pitch === shift.from)?.share ?? 0

  return (
    <section className="flex border border-(--color-border) bg-(--color-surface-card)">
      <div className="w-1.5 shrink-0 bg-(--color-ink)" />
      <div className="flex grow flex-col gap-3.5 px-6 py-5">
        <Row label={es.plan.labels.degrades} first>
          <p className="m-0">
            {es.plan.degrades(
              degrades.pitch,
              formatSignedMetric(degrades.delta),
              formatNumber(seaOf(degrades, plan)),
              formatNumber(hhOf(degrades, plan)),
              ivbText(degrades),
            )}
          </p>
        </Row>
        <Row label={es.plan.labels.holds}>
          <p className="m-0">
            {es.plan.holds(
              holds.pitch,
              formatSignedMetric(holds.delta),
              formatNumber(seaOf(holds, plan)),
              formatNumber(hhOf(holds, plan)),
              holds.ivbSea !== null && degrades.ivbSea !== null
                ? es.plan.holdsWhy(
                    formatNumber(Math.abs(holds.ivbSea)),
                    formatNumber(Math.abs(degrades.ivbSea)),
                    degrades.pitch,
                  )
                : '',
            )}
          </p>
        </Row>
        <Row label={es.plan.labels.changes}>
          {helps ? (
            <>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-(--color-text-muted)">{es.plan.shiftBy}</span>
                {SHIFT_STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    aria-pressed={step === points}
                    onClick={() => {
                      setPoints(step)
                    }}
                    className={
                      step === points
                        ? 'cursor-pointer border-0 bg-(--color-ink) px-2.5 py-1 font-semibold text-white'
                        : 'cursor-pointer border border-(--color-border) bg-(--color-surface-card) px-2.5 py-1'
                    }
                  >
                    {es.plan.points(step)}
                  </button>
                ))}
              </div>
              <p className="m-0" aria-live="polite">
                {es.plan.changes(
                  shift.from,
                  formatNumber(100 * fromBefore),
                  formatNumber(100 * fromBefore - shift.points),
                  shift.to,
                  formatMetric(shift.before),
                  formatMetric(shift.after),
                )}
              </p>
            </>
          ) : (
            <p className="m-0">{es.plan.noShift(holds.pitch, degrades.pitch)}</p>
          )}
          {simulatorHref === null ? null : (
            <Link href={simulatorHref} className="text-[13px]">
              {es.plan.tryInSimulator(holds.pitch)}
            </Link>
          )}
        </Row>
      </div>
    </section>
  )
}
