import { NextResponse, type NextRequest } from 'next/server'

/**
 * Una contrasena para la demo publicada (`deploy/hf-space`): los datos son de
 * ISAC y del club, y una URL abierta los expone. Solo se activa si existe
 * `SUPERESTELA_BASIC_AUTH` («usuario:contrasena»); en local no cambia nada.
 */
export function proxy(request: NextRequest): NextResponse {
  const expected = process.env.SUPERESTELA_BASIC_AUTH
  if (expected === undefined || expected === '') return NextResponse.next()
  const header = request.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme === 'Basic' && encoded !== undefined && atob(encoded) === expected) {
    return NextResponse.next()
  }
  return new NextResponse('Acceso restringido', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="SuperEstela", charset="UTF-8"' },
  })
}

export const config = {
  // Static chunks carry no data; leaving them out keeps the prompt to one.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
