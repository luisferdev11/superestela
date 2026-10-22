/**
 * Todas las llamadas del navegador a la API pasan por aqui. Normalmente es un
 * `fetch` al proxy de Next. En la version estatica (GitHub Pages, `docs/17`)
 * no hay API: se sirve la respuesta que el modelo dio al compilar para esa
 * misma peticion (`public/precomputed/`, escrita por `static/record.test.ts`),
 * y si no se precalculo, un 503 que la pantalla explica.
 */

/** Built with `scripts/build-static.sh`: no API, answers read from files. */
export const IS_STATIC = process.env.NEXT_PUBLIC_SUPERESTELA_STATIC === '1'

/** Where the static site lives under the domain (`/superestela` on Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** FNV-1a over the string's UTF-16 units, as 8 hex digits. */
const fnv1a = (text: string, seed: number): string => {
  let hash = seed >>> 0
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * The file name of a precomputed answer: the path (with its query) and the
 * exact body, hashed twice with two seeds so 3,000 answers do not collide.
 */
export const precomputedKey = (path: string, body: string): string => {
  const text = `${path}\n${body}`
  return `${fnv1a(text, 0x811c9dc5)}${fnv1a(text, 0x01000193)}`
}

export const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  if (!IS_STATIC) return init === undefined ? fetch(path) : fetch(path, init)
  const body = typeof init?.body === 'string' ? init.body : ''
  const response = await fetch(`${BASE_PATH}/precomputed/${precomputedKey(path, body)}.json`, {
    signal: init?.signal ?? null,
  })
  return response.ok ? response : Response.json({ error: 'static' }, { status: 503 })
}
