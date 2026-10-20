import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mockupDataPath } from '@/sources/paths'
import { mockupDataSchema } from '@/sources/schema'
import { toPitcherSeason } from '@/sources/adapter'
import { arsenalRows, dominantPitch, dominantPitchTypes } from './arsenal'
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

describe('la tabla del arsenal de la Ficha', () => {
  it('va de mayor a menor uso y no pierde ningun pitch, en todas las tarjetas', async () => {
    for (const card of await cards()) {
      const rows = arsenalRows(card)
      expect(rows).toHaveLength(card.arsenal.length)
      for (let i = 1; i < rows.length; i += 1) {
        expect(rows[i - 1]?.usagePct ?? 0).toBeGreaterThanOrEqual(rows[i]?.usagePct ?? 0)
      }
    }
  })

  it('pitcher_00069 2025: la recta pasa de 20.7 a 15.0 de IVB y de 115.2 a 98.6 de Stuff+', async () => {
    const card = (await cards()).find((c) => c.pitcherId === 'pitcher_00069' && c.season === 2025)
    const fastball = card === undefined ? undefined : arsenalRows(card)[0]
    expect(fastball).toMatchObject({
      pitch: 'Four-Seam',
      usagePct: 71.3,
      ivbSea: 20.7,
      ivbHh: 15,
      absHbSea: 8.2,
      absHbHh: 5.2,
      stuffPlusSea: { value: 115.2, se: 0.9 },
      stuffPlusHh: { value: 98.6, se: 1 },
    })
  })

  it('el break horizontal siempre sale en valor absoluto', async () => {
    for (const row of (await cards()).flatMap(arsenalRows)) {
      if (row.absHbHh !== null) expect(row.absHbHh).toBeGreaterThanOrEqual(0)
      if (row.absHbSea !== null) expect(row.absHbSea).toBeGreaterThanOrEqual(0)
    }
  })
})
