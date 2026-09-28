import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mockupDataPath } from './paths'
import { mockupDataSchema } from './schema'
import { toPitcherSeason } from './adapter'
import { MIN_PITCHES_FOR_SCORE } from '@/domain/constants'

/**
 * El contrato con el equipo de datos, ejecutable. Corre sobre el
 * `mockup_data.json` real, no sobre un fixture: un fixture nunca detecta que
 * `analysis/evidence.py` cambio de forma, y detectarlo es justo el trabajo de
 * este archivo.
 */

const readMockup = async (): Promise<unknown> =>
  JSON.parse(await readFile(mockupDataPath(), 'utf8'))

describe('el artefacto de analisis cumple el contrato', () => {
  it('parsea completo en modo estricto', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    expect(parsed.pitchers.length).toBeGreaterThan(0)
    expect(Object.keys(parsed.pitcher_seasons).length).toBeGreaterThan(0)
  })

  it('toda tarjeta llega con su banda en ambos entornos', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    for (const card of parsed.pitchers) {
      expect(card.stuff_plus_hh_ci95).toBeTypeOf('number')
      expect(card.stuff_plus_sea_ci95).toBeTypeOf('number')
    }
  })

  it('todo Stuff+ por pitch llega con su banda, y la banda sin score tampoco', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    for (const card of parsed.pitchers) {
      for (const entry of card.arsenal) {
        expect(entry.stuff_plus_hh_ci95 === null).toBe(entry.stuff_plus_hh === null)
        expect(entry.stuff_plus_sea_ci95 === null).toBe(entry.stuff_plus_sea === null)
      }
    }
  })

  it('ninguna tarjeta baja del umbral de muestra en ningun entorno', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    for (const card of parsed.pitchers) {
      expect(Math.min(card.n_pitches_hh, card.n_pitches_sea)).toBeGreaterThanOrEqual(
        MIN_PITCHES_FOR_SCORE,
      )
    }
  })

  it('`scored` significa exactamente el umbral en ambos entornos', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    for (const seasons of Object.values(parsed.pitcher_seasons)) {
      for (const season of seasons) {
        const qualifies =
          season.n_pitches_hh >= MIN_PITCHES_FOR_SCORE &&
          season.n_pitches_sea >= MIN_PITCHES_FOR_SCORE
        expect(season.scored).toBe(qualifies)
      }
    }
  })
})

describe('el adaptador', () => {
  it('convierte las tarjetas sin perder ninguna', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    const cards = parsed.pitchers.map(toPitcherSeason)
    expect(cards).toHaveLength(parsed.pitchers.length)
  })

  it('deja el impuesto en null cuando no es significativo', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    const cards = parsed.pitchers.map(toPitcherSeason)

    for (const [index, card] of cards.entries()) {
      const raw = parsed.pitchers[index]
      expect(raw).toBeDefined()
      if (raw?.altitude_tax_significant) {
        expect(card.altitudeTax).not.toBeNull()
      } else {
        expect(card.altitudeTax).toBeNull()
      }
    }
  })

  it('no deja ningun campo del dominio en undefined', async () => {
    const parsed = mockupDataSchema.parse(await readMockup())
    for (const card of parsed.pitchers.map(toPitcherSeason)) {
      for (const [key, value] of Object.entries(card)) {
        expect(value, `${card.pitcherId} ${String(card.season)}: ${key}`).not.toBeUndefined()
      }
    }
  })
})
