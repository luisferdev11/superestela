import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  contributions,
  defaultShift,
  planOf,
  shiftHelps,
  shiftOptions,
  shiftUsage,
  SHIFT_STEPS,
  weightedToday,
} from './plan'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason } from '@/sources/adapter'

const cards = async () =>
  mockupDataSchema
    .parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
    .pitchers.map(toPitcherSeason)

const find = async (id: string, season: number) => {
  const card = (await cards()).find((c) => c.pitcherId === id && c.season === season)
  if (card === undefined) throw new Error(`${id} ${String(season)} no esta en el artefacto`)
  return card
}

describe('el plan de pitcher_00069 2025, el del prototipo', () => {
  it('se degrada la recta, de 20.7 a 15.0 de IVB; aguanta el slider', async () => {
    const plan = planOf(await find('pitcher_00069', 2025))
    expect(plan?.degrades).toMatchObject({ pitch: 'Four-Seam', ivbSea: 20.7, ivbHh: 15 })
    expect(plan?.degrades.delta.value).toBeCloseTo(-20.6, 5)
    expect(plan?.holds.pitch).toBe('Slider')
  })

  it('la recta carga sola el deficit: 0.713 × (90.4 − 100)', async () => {
    const card = await find('pitcher_00069', 2025)
    const fastball = contributions(card).find((c) => c.pitch === 'Four-Seam')
    expect(fastball?.contribution.value).toBeCloseTo(-6.8448, 4)
    expect(planOf(card)?.culprit?.pitch).toBe('Four-Seam')
  })

  it('bajar la recta a 50% sube el Stuff+ en altitud extrema ponderado de 93.3 a 95.3', async () => {
    const plan = planOf(await find('pitcher_00069', 2025))
    if (plan === null) throw new Error('sin plan')
    const shift = shiftUsage(plan, 21.3)
    expect(shift.before.value).toBeCloseTo(93.3, 1)
    expect(shift.after.value).toBeCloseTo(95.3, 1)
    expect(shift.after.se).toBeGreaterThan(0)
    expect(shiftHelps(plan)).toBe(true)
  })
})

describe('el reparto de uso, en toda la liga', () => {
  it('nunca da usos negativos, nunca inventa un pitch y el total no cambia', async () => {
    for (const card of await cards()) {
      const plan = planOf(card)
      if (plan === null) continue
      const own = new Set(card.arsenal.map((e) => e.pitch))
      const total = plan.contributions.reduce((s, c) => s + c.share, 0)
      for (const points of [0, ...SHIFT_STEPS, 100]) {
        const shift = shiftUsage(plan, points)
        const shares = [...shift.shares.values()]
        expect(Math.min(...shares)).toBeGreaterThanOrEqual(0)
        expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(total, 9)
        for (const pitch of shift.shares.keys()) expect(own.has(pitch)).toBe(true)
        expect(shift.points).toBeLessThanOrEqual(points)
      }
    }
  })

  it('cuando el plan propone mover uso, el ponderado nunca baja', async () => {
    for (const card of await cards()) {
      const plan = planOf(card)
      if (plan === null || !shiftHelps(plan)) continue
      for (const points of SHIFT_STEPS) {
        const shift = shiftUsage(plan, points)
        expect(shift.after.value).toBeGreaterThanOrEqual(shift.before.value)
      }
    }
  })

  it('el que se degrada y el que aguanta nunca son el mismo pitch', async () => {
    for (const card of await cards()) {
      const plan = planOf(card)
      if (plan !== null) expect(plan.degrades.pitch).not.toBe(plan.holds.pitch)
    }
  })
})

describe('el ponderado de hoy y el deficit dicen lo mismo', () => {
  it('pitcher_00019 2026: el ponderado de hoy es 100 mas el deficit, no el Stuff+ de la tarjeta', async () => {
    const plan = planOf(await find('pitcher_00019', 2026))
    if (plan === null) throw new Error('sin plan')
    const today = weightedToday(plan)
    const total = plan.contributions.reduce((s, c) => s + c.share, 0)
    expect(today.value).toBeCloseTo(100 + plan.deficit.value / total, 9)
    expect(today).toEqual(shiftUsage(plan, 0).before)
  })

  it('pitcher_00019 2026: la recta tiene 13.6% de uso, asi que no se ofrecen 20 ni 30 puntos', async () => {
    const plan = planOf(await find('pitcher_00019', 2026))
    if (plan === null) throw new Error('sin plan')
    const available =
      100 * (plan.contributions.find((c) => c.pitch === plan.degrades.pitch)?.share ?? 0)
    expect(shiftOptions(plan)).toEqual(
      [...SHIFT_STEPS.filter((s) => s < available), available].slice(0, SHIFT_STEPS.length),
    )
    expect(defaultShift(plan)).toBeLessThanOrEqual(available)
  })
})
