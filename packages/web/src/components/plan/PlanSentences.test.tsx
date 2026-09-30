import { readFile } from 'node:fs/promises'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlanSentences } from './PlanSentences'
import { planOf, shiftHelps, shiftUsage } from '@/domain/plan'
import { formatMetric } from '@/domain/format'
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
  it('pitcher_00069: al elegir 30 puntos, la frase trae el ponderado de 30 puntos', async () => {
    const found = (await plans()).find(
      ({ card }) => card.pitcherId === 'pitcher_00069' && card.season === 2025,
    )
    if (found?.plan == null) throw new Error('sin plan para pitcher_00069 2025')
    render(<PlanSentences plan={found.plan} simulatorHref={null} />)
    fireEvent.click(screen.getByRole('button', { name: es.plan.points(30) }))
    const after = formatMetric(shiftUsage(found.plan, 30).after)
    expect(screen.getByText(new RegExp(after.replace(/[.+]/g, '\\$&')))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.plan.points(30) })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
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
