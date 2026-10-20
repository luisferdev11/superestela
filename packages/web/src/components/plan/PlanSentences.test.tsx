import { readFile } from 'node:fs/promises'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlanSentences } from './PlanSentences'
import { planOf, shiftHelps, shiftOptions, shiftUsage } from '@/domain/plan'
import { formatMetric, formatNumber } from '@/domain/format'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason } from '@/sources/adapter'
import { es } from '@/i18n/es'

const plans = async () =>
  mockupDataSchema
    .parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
    .pitchers.map(toPitcherSeason)
    .map((card) => ({ card, plan: planOf(card) }))

describe('las frases del Plan', () => {
  it('al elegir 30 puntos, la frase trae el ponderado de 30 puntos', async () => {
    // The first card whose plan moves usage and has 30 points to move.
    const found = (await plans()).find(
      ({ plan }) => plan !== null && shiftHelps(plan) && shiftOptions(plan).includes(30),
    )
    if (found?.plan == null) throw new Error('ningun plan con 30 puntos que mover')
    render(<PlanSentences plan={found.plan} simulatorHref={null} />)
    fireEvent.click(screen.getByRole('button', { name: es.plan.points('30') }))
    const after = formatMetric(shiftUsage(found.plan, 30).after)
    expect(screen.getByText(new RegExp(after.replace(/[.+]/g, '\\$&')))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.plan.points('30') })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('nunca ofrece mover mas uso del que tiene el pitch que se degrada', async () => {
    for (const { plan } of await plans()) {
      if (plan === null) continue
      const available =
        100 * (plan.contributions.find((c) => c.pitch === plan.degrades.pitch)?.share ?? 0)
      for (const step of shiftOptions(plan)) {
        expect(step).toBeLessThanOrEqual(available)
        expect(shiftUsage(plan, step).points).toBeCloseTo(step, 9)
      }
    }
  })

  it('con poco uso, el ultimo boton es «todo su uso» con los puntos que de verdad mueve', async () => {
    const found = (await plans()).find(
      ({ plan }) => plan !== null && shiftHelps(plan) && shiftOptions(plan).length < 3,
    )
    if (found?.plan == null) throw new Error('ningun plan con poco uso que mover')
    render(<PlanSentences plan={found.plan} simulatorHref={null} />)
    const all = shiftOptions(found.plan).at(-1) ?? 0
    expect(
      screen.getByRole('button', { name: es.plan.allOf(formatNumber(all)) }),
    ).toBeInTheDocument()
  })

  it('solo dice «menos ride que perder» cuando de verdad tiene menos', async () => {
    for (const { plan } of await plans()) {
      if (plan === null || plan.holds.ivbSea === null || plan.degrades.ivbSea === null) continue
      const { unmount } = render(<PlanSentences plan={plan} simulatorHref={null} />)
      const args = [
        formatNumber(Math.abs(plan.holds.ivbSea)),
        formatNumber(Math.abs(plan.degrades.ivbSea)),
        plan.degrades.pitch,
      ] as const
      const claim = es.plan.holdsWhy(...args)
      const text = document.body.textContent ?? ''
      expect(text.includes(claim)).toBe(
        Math.abs(plan.holds.ivbSea) < Math.abs(plan.degrades.ivbSea),
      )
      unmount()
    }
  })

  it('si el que aguanta rinde menos en altura, dice que mover uso no compensa y no ofrece botones', async () => {
    const found = (await plans()).find(({ plan }) => plan !== null && !shiftHelps(plan))
    if (found?.plan == null) throw new Error('ninguna tarjeta sin reparto que ayude')
    render(<PlanSentences plan={found.plan} simulatorHref={null} />)
    expect(
      screen.getByText(es.plan.noShift(found.plan.holds.pitch, found.plan.degrades.pitch)),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
