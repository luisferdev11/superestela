import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `CONVENTIONS.md` seccion 2.1: el espanol se mapea en el archivo i18n, nunca
 * en linea. Hoy no lo vigilaba nadie.
 */

const SRC = path.join(import.meta.dirname, '..')
const ACCENTED = /[áéíóúñÁÉÍÓÚÑ¿¡]/

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const found = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return /\.tsx?$/.test(entry.name) ? [full] : []
    }),
  )
  return found.flat()
}

describe('el espanol vive en un solo archivo', () => {
  it('ningun componente ni pagina lleva texto acentuado en linea', async () => {
    const files = [
      ...(await walk(path.join(SRC, 'components'))),
      ...(await walk(path.join(SRC, 'app'))),
    ]
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      // Los comentarios documentan en espanol y eso esta bien; lo que no puede
      // llevar espanol es el codigo.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n')
      expect(ACCENTED.test(code), `${path.relative(SRC, file)} lleva espanol en linea`).toBe(false)
    }
  })
})
