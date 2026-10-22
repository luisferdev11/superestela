'use client'

import { apiFetch } from '@/sources/apiClient'
import { useEffect, useState } from 'react'
import type { TranslatorRequest } from '@/domain/translator'
import { simulateResponseSchema, type SimulateResponse } from '@/sources/simulateResponse'

export type Translation =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly last: Answer | null }
  | { readonly status: 'ready'; readonly results: readonly SimulateResponse[] }
  | {
      readonly status: 'error'
      readonly kind: 'rejected' | 'unreachable'
      readonly last: Answer | null
    }

/**
 * Las respuestas anteriores junto con lo que preguntaban. Sin las preguntas,
 * la pantalla emparejaria por posicion respuestas de un Slider con una fila que
 * ya es Curveball.
 */
export type Answer = {
  readonly requests: readonly TranslatorRequest[]
  readonly results: readonly SimulateResponse[]
}

/** Se captura con teclado: se espera a que deje de teclear antes de preguntar. */
const DEBOUNCE_MS = 300

class Rejected extends Error {}

/**
 * Una pregunta por pitch a `/api/simulate`, todas a la vez, y la respuesta solo
 * cuando contestaron todas: un arsenal a medias se pondera mal. Mientras llega
 * la nueva, la pantalla conserva la anterior, como el Simulador.
 *
 * `requests` vacio (la tabla no esta lista) no pregunta nada.
 */
export const useTranslation = (requests: readonly TranslatorRequest[]): Translation => {
  const body = JSON.stringify(requests)
  const [settled, setSettled] = useState<{
    readonly body: string
    readonly answer: Answer | null
    readonly failed: 'rejected' | 'unreachable' | null
  } | null>(null)

  useEffect(() => {
    if (requests.length === 0) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const ask = (request: TranslatorRequest): Promise<SimulateResponse> =>
        apiFetch('/api/simulate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        }).then(async (response) => {
          if (!response.ok) {
            console.error(`simulate ${String(response.status)}`, await response.text())
            throw response.status >= 500 ? new Error('unreachable') : new Rejected('rejected')
          }
          return simulateResponseSchema.parse(await response.json())
        })

      Promise.all(requests.map(ask))
        .then((results) => {
          setSettled({ body, answer: { requests, results }, failed: null })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          console.error(error)
          const kind =
            error instanceof Rejected || (error instanceof Error && error.name === 'ZodError')
              ? 'rejected'
              : 'unreachable'
          setSettled((prev) => ({ body, answer: prev?.answer ?? null, failed: kind }))
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // `body` es la llave: `requests` cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

  if (requests.length === 0) return { status: 'idle' }
  const last = settled?.answer ?? null
  if (settled?.body !== body) return { status: 'loading', last }
  if (settled.failed !== null) return { status: 'error', kind: settled.failed, last }
  if (last === null) return { status: 'error', kind: 'unreachable', last }
  return { status: 'ready', results: last.results }
}
