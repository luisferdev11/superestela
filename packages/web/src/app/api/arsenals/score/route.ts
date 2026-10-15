/**
 * El Traductor (varios lanzadores) manda el archivo a la API de Python a traves de este
 * proxy, igual que el Simulador con `/api/simulate`: el navegador no sabe donde
 * vive la API, y la direccion es `SUPERESTELA_API_URL`.
 *
 * No hay logica aqui (`CONVENTIONS.md` seccion 4, regla 6): el archivo se lee
 * en Python porque las columnas del proveedor solo se renombran en
 * `contracts/mapping.py`.
 */

const DEFAULT_API = 'http://localhost:8000'

export async function POST(request: Request): Promise<Response> {
  const api = process.env.SUPERESTELA_API_URL ?? DEFAULT_API
  try {
    const upstream = await fetch(`${api}/api/v1/arsenals/score`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch {
    return Response.json({ error: 'api_unreachable' }, { status: 503 })
  }
}
