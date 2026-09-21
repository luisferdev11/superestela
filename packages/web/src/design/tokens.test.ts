import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render } from '../../scripts/build-tokens.mjs'

/**
 * docs/07 seccion 5.2, regla 6: los tokens son una sola fuente. El CSS es
 * generado; este test regenera en memoria y compara, asi que editarlo a mano
 * falla en CI en vez de convivir en silencio con `tokens.json`.
 */

const root = path.join(import.meta.dirname, '..', '..')
const read = async (rel: string): Promise<string> => readFile(path.join(root, rel), 'utf8')

describe('los tokens generados', () => {
  it('coinciden con tokens.json', async () => {
    const tokens: unknown = JSON.parse(await read('src/design/tokens.json'))
    const current = await read('src/styles/tokens.generated.css')
    expect(current).toBe(render(tokens))
  })

  it('exponen la escala de altitud completa', async () => {
    const css = await read('src/styles/tokens.generated.css')
    for (const name of ['sea', 'medium', 'extreme']) {
      expect(css).toContain(`--color-altitude-${name}:`)
    }
  })
})
