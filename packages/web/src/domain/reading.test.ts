import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { pitchDeltas, readingOf, verdictOf } from './reading'
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

describe('la lectura de pitcher_00069 2025, la del prototipo', () => {
  it('es Trampa: no fichar al precio de nivel del mar', async () => {
    expect(verdictOf(await find('pitcher_00069', 2025))).toBe('notAtSeaLevelPrice')
  })

  it('la recta pierde 16.6 y la curva 6.6: la curva es la palanca', async () => {
    const reading = readingOf(await find('pitcher_00069', 2025))
    expect(reading.main?.pitch).toBe('Four-Seam')
    expect(reading.main?.delta.value).toBeCloseTo(-16.6, 5)
    expect(reading.lever?.best.pitch).toBe('Curveball')
    expect(reading.lever?.best.delta.value).toBeCloseTo(-6.6, 5)
    expect(reading.lever?.worst.pitch).toBe('Four-Seam')
  })

  it('cada perdida lleva su banda, en cuadratura', async () => {
    const [fastball] = pitchDeltas(await find('pitcher_00069', 2025))
    expect(fastball?.delta.se).toBeCloseTo(Math.hypot(0.9, 1.0), 5)
  })
})

describe('el veredicto en toda la liga', () => {
  it('toda Trampa es «no al precio de nivel del mar», y «fichar» exige la banda entera arriba de 100', async () => {
    for (const card of await cards()) {
      const verdict = verdictOf(card)
      if (card.altitudeTrap) expect(verdict).toBe('notAtSeaLevelPrice')
      if (verdict === 'sign') {
        expect(card.stuffPlusHh.value - card.stuffPlusHh.se).toBeGreaterThanOrEqual(100)
      }
    }
  })

  it('la palanca nunca compara un pitch consigo mismo', async () => {
    for (const card of await cards()) {
      const { lever } = readingOf(card)
      if (lever !== null) expect(lever.best.pitch).not.toBe(lever.worst.pitch)
    }
  })
})
