import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIN_PITCHES_FOR_SCORE,
  MIN_PLATE_APPEARANCES_FOR_RATE,
  MIN_SWINGS_FOR_RATE,
  ROLES,
} from './constants'

/**
 * Guardia de deriva entre lenguajes. `packages/contracts/` es la frontera entre
 * datos y producto, y estas dos constantes existen a los dos lados. Si alguien
 * mueve el umbral en Python y no aqui, la app empieza a mostrar cifras que el
 * contrato rechazaria — y nadie se entera hasta el deck.
 */

// Ruta armada con `path` y no con `new URL(..., import.meta.url)`: el plugin
// de React reescribe esa forma como si fuera un asset del bundle.
const contracts = async (file: string): Promise<string> =>
  readFile(path.join(import.meta.dirname, '..', '..', '..', 'contracts', file), 'utf8')

describe('las constantes no se separan de packages/contracts', () => {
  it('el umbral de muestra coincide con MIN_PITCHES_FOR_SCORE', async () => {
    const match = /^MIN_PITCHES_FOR_SCORE\s*=\s*(\d+)/m.exec(await contracts('schemas.py'))
    expect(match?.[1], 'no se encontro MIN_PITCHES_FOR_SCORE en schemas.py').toBeDefined()
    expect(Number(match?.[1])).toBe(MIN_PITCHES_FOR_SCORE)
  })

  it('los minimos de las tasas coinciden con los de Python', async () => {
    const source = await contracts('schemas.py')
    const pa = /^MIN_PLATE_APPEARANCES_FOR_RATE\s*=\s*(\d+)/m.exec(source)
    const swings = /^MIN_SWINGS_FOR_RATE\s*=\s*(\d+)/m.exec(source)
    expect(Number(pa?.[1])).toBe(MIN_PLATE_APPEARANCES_FOR_RATE)
    expect(Number(swings?.[1])).toBe(MIN_SWINGS_FOR_RATE)
  })

  it('los roles coinciden con ROLES, y siguen siendo dos', async () => {
    const match = /^ROLES\s*=\s*\[([^\]]*)\]/m.exec(await contracts('schemas.py'))
    expect(match?.[1], 'no se encontro ROLES en schemas.py').toBeDefined()
    const fromPython = [...(match?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(fromPython).toEqual([...ROLES])
    // docs/adr/0004: el rol de tres categorias se retiro. Dos es lo que el dato separa.
    expect(fromPython).toHaveLength(2)
  })
})
