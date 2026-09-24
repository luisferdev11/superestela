'use client'

import { useEffect, useState } from 'react'
import type { SimulateRequest } from '@/domain/simulator'
import { simulateResponseSchema, type SimulateResponse } from '@/sources/simulateResponse'

export type Simulation =
  | { readonly status: 'loading'; readonly last: SimulateResponse | null }
  | { readonly status: 'ready'; readonly result: SimulateResponse }
  | {
      readonly status: 'error'
      /** `rejected`: la API contesto que la peticion no es valida; `unreachable`: no contesto. */
      readonly kind: 'rejected' | 'unreachable'
      readonly last: SimulateResponse | null
    }

/**
 * Espera a que el slider se detenga antes de pedir: un arrastre son decenas de
 * eventos y solo el ultimo importa. 150 ms no se percibe como retraso y evita
 * que respuestas viejas pisen a las nuevas.
 */
const DEBOUNCE_MS = 150

/**
 * Pide el score a la API por el proxy de `/api/simulate`. Mientras llega la
 * respuesta nueva, la pantalla conserva la anterior (`last`) en vez de
 * vaciarse: un coach que arrastra un slider no debe ver parpadear los numeros.
 */
export const useSimulation = (request: SimulateRequest): Simulation => {
  const body = JSON.stringify(request)
  // Solo se guarda lo que ya contesto; "cargando" se deriva de que la peticion
  // actual todavia no es la que contesto, sin un setState dentro del efecto.
  const [settled, setSettled] = useState<{
    readonly body: string
    readonly result: SimulateResponse | null
    readonly failed: 'rejected' | 'unreachable' | null
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const kind = response.status >= 500 ? 'unreachable' : 'rejected'
            console.error(`simulate ${String(response.status)}`, await response.text())
            setSettled((prev) => ({ body, result: prev?.result ?? null, failed: kind }))
            return
          }
          const parsed = simulateResponseSchema.parse(await response.json())
          setSettled({ body, result: parsed, failed: null })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          console.error(error)
          // Una respuesta que no pasa el esquema tambien es un rechazo: no se dibuja a medias.
          const kind =
            error instanceof Error && error.name === 'ZodError' ? 'rejected' : 'unreachable'
          setSettled((prev) => ({ body, result: prev?.result ?? null, failed: kind }))
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [body])

  const last = settled?.result ?? null
  if (settled?.body !== body) return { status: 'loading', last }
  if (settled.failed !== null) return { status: 'error', kind: settled.failed, last }
  if (last === null) return { status: 'error', kind: 'unreachable', last }
  return { status: 'ready', result: last }
}
