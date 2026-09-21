import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason } from '@/sources/adapter'
import { dominantPitch, dominantPitchTypes } from './arsenal'
import { hasLargeDelta, isStaleSeason, LARGE_DELTA } from './emphasis'

const cards = async () => {
  const parsed = mockupDataSchema.parse(JSON.parse(await readFile(mockupDataPath(), 'utf8')))
  return parsed.pitchers.map(toPitcherSeason)
}

describe('el lanzamiento dominante', () => {
  it('es el de mayor uso, en todas las tarjetas reales', async () => {
    for (const card of await cards()) {
      const pitch = dominantPitch(card)
      if (card.arsenal.length === 0) {
        expect(pitch).toBeNull()
        continue
      }
      expect(pitch).not.toBeNull()
      const maxUsage = Math.max(...card.arsenal.map((entry) => entry.usagePct))
      expect(pitch?.usagePct).toBe(maxUsage)
    }
  })

  it('los tipos dominantes salen de los seis que el modelo puntua', async () => {
    const types = dominantPitchTypes(await cards())
    expect(types.length).toBeGreaterThan(0)
    expect(types.length).toBeLessThanOrEqual(6)
  })
})

describe('las codificaciones de la tabla', () => {
  it('el delta grande marca a quienes caen 10 puntos o mas', async () => {
    for (const card of await cards()) {
      expect(hasLargeDelta(card)).toBe(card.stuffPlusDelta <= LARGE_DELTA)
    }
  })

  it('la temporada vieja es cualquiera anterior a la mas reciente del dataset', async () => {
    const all = await cards()
    const latest = Math.max(...all.map((card) => card.season))
    expect(all.some((card) => isStaleSeason(card, latest))).toBe(true)
    expect(
      all.filter((card) => card.season === latest).every((c) => !isStaleSeason(c, latest)),
    ).toBe(true)
  })
})
