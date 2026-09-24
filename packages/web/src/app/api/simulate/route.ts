/**
 * El Simulador pide el score a la API de Python a traves de este proxy. Asi el
 * navegador no necesita saber donde vive la API ni la API abrir CORS, y la
 * direccion es configuracion del servidor: `SUPERESTELA_API_URL`.
 *
 * No hay logica aqui (`CONVENTIONS.md` seccion 4, regla 6): el cuerpo pasa tal
 * cual y la respuesta vuelve tal cual. La validacion vive en la API, que
 * contesta 422, y en el cliente, que parsea con Zod.
 */

const DEFAULT_API = 'http://localhost:8000'

export async function POST(request: Request): Promise<Response> {
  const api = process.env.SUPERESTELA_API_URL ?? DEFAULT_API
  try {
    const upstream = await fetch(`${api}/api/v1/simulate`, {
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
