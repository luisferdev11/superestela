import { loadPitchEffectiveness } from '@/sources/locationSource'

/**
 * Donde caen los pitches mas y menos efectivos de un lanzador-temporada, por
 * tipo (`analysis/pitcher_locations.py`). El Simulador lo pide al elegir
 * lanzador: mandar los 710 a la pagina pesaria casi un mega.
 */
export async function GET(request: Request): Promise<Response> {
  const key = new URL(request.url).searchParams.get('key') ?? ''
  const all = await loadPitchEffectiveness()
  const maps = all?.get(key) ?? null
  return maps === null
    ? Response.json({ error: 'not_found' }, { status: 404 })
    : Response.json(maps, { headers: { 'cache-control': 'public, max-age=3600' } })
}
