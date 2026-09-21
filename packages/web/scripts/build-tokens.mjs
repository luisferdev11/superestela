#!/usr/bin/env node
/**
 * Genera `src/styles/tokens.generated.css` desde `src/design/tokens.json`.
 * docs/07 seccion 5.2, regla 6: los tokens son una sola fuente. Un test
 * regenera en memoria y compara, asi que editar el CSS a mano falla en CI.
 *
 *   node scripts/build-tokens.mjs            escribe
 *   node scripts/build-tokens.mjs --check    solo compara, sale 1 si difiere
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const SOURCE = new URL('../src/design/tokens.json', import.meta.url)
const TARGET = new URL('../src/styles/tokens.generated.css', import.meta.url)

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** Aplana el arbol a `--<grupo>-<nombre>`, saltando las claves de comentario. */
const flatten = (node, trail = []) =>
  Object.entries(node).flatMap(([key, value]) => {
    if (key.startsWith('$')) return []
    const next = [...trail, kebab(key)]
    if (typeof value === 'object' && value !== null) return flatten(value, next)
    const name = next[next.length - 1] === 'base' ? next.slice(0, -1) : next
    return [[`--${name.join('-')}`, String(value)]]
  })

export const render = (tokens) => {
  const lines = flatten(tokens).map(([name, value]) => `  ${name}: ${value};`)
  return [
    '/* Generado por scripts/build-tokens.mjs desde src/design/tokens.json.',
    '   No editar a mano: `pnpm tokens` lo reescribe y un test lo vigila. */',
    '@theme {',
    ...lines,
    '}',
    '',
  ].join('\n')
}

const main = async () => {
  const css = render(JSON.parse(await readFile(SOURCE, 'utf8')))

  if (process.argv.includes('--check')) {
    const current = await readFile(TARGET, 'utf8').catch(() => '')
    if (current !== css) {
      process.stderr.write(
        'tokens.generated.css no coincide con tokens.json; corre `pnpm tokens`.\n',
      )
      process.exit(1)
    }
    return
  }

  await writeFile(TARGET, css)
}

// Solo al ejecutarlo: importarlo debe dar `render` y nada mas, que es como el
// test lo usa.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
