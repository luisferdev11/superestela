import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { arsenalsPath, pitchEffectivenessPath, pitchLocationsPath } from './paths'
import { pitchEffectivenessSchema, pitchLocationsSchema } from './locationSource'

vi.mock('server-only', () => ({}))

const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'))

describe('los mapas por tipo de pitch cumplen su contrato', () => {
  it('pitch_locations.json: cada lanzador-temporada es de arsenals.json y sus celdas caben en la rejilla', async () => {
    const parsed = pitchLocationsSchema.parse(await read(pitchLocationsPath()))
    const keys = new Set(Object.keys((await read(arsenalsPath())) as Record<string, unknown>))
    for (const [key, pitches] of Object.entries(parsed)) {
      expect(keys.has(key)).toBe(true)
      for (const maps of Object.values(pitches)) {
        for (const m of [maps.sea, maps.hh]) {
          if (m === null) continue
          const located = m.cells.reduce((total, [, , n]) => total + n, 0)
          expect(located).toBeLessThanOrEqual(m.n_pitches)
          for (const [r, c] of m.cells) expect(Math.max(r, c)).toBeLessThan(10)
        }
      }
    }
  })

  it('pitch_effectiveness.json: los mas y los menos efectivos son pitches distintos', async () => {
    const parsed = pitchEffectivenessSchema.parse(await read(pitchEffectivenessPath()))
    expect(Object.keys(parsed).length).toBeGreaterThan(0)
    for (const pitches of Object.values(parsed)) {
      for (const { most, least } of Object.values(pitches)) {
        expect(most.location_plus).toBeNull()
        expect(least.location_plus).toBeNull()
      }
    }
  })
})
