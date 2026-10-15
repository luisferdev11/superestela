'use client'

import { useState, type ReactNode } from 'react'
import { ManyPitchers } from './ManyPitchers'
import { es } from '@/i18n/es'

type Mode = 'single' | 'many'

const chip = (active: boolean): string =>
  active
    ? 'cursor-pointer border-0 bg-(--color-ink) px-3.5 py-1.5 text-xs font-semibold text-white'
    : 'cursor-pointer border-0 bg-(--color-surface-card) px-3.5 py-1.5 text-xs text-(--color-text)'

/**
 * Los dos modos del Traductor (14 de octubre): un lanzador, pitch por pitch y
 * con su ejemplo de validacion; o varios lanzadores de un archivo, una fila por
 * lanzador. Conviven: el primero explica, el segundo compara.
 */
export const TranslatorModes = ({ single }: { readonly single: ReactNode }) => {
  const [mode, setMode] = useState<Mode>('single')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
          {es.translator.modes.label}
        </span>
        <div className="flex border border-(--color-ink)" role="group">
          {(['single', 'many'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={chip(mode === m)}
              onClick={() => {
                setMode(m)
              }}
            >
              {es.translator.modes[m]}
            </button>
          ))}
        </div>
      </div>
      {/* Los dos se quedan montados: cambiar de modo no borra lo capturado ni el archivo. */}
      <div className={mode === 'single' ? '' : 'hidden'}>{single}</div>
      <div className={mode === 'many' ? '' : 'hidden'}>
        <ManyPitchers />
      </div>
    </div>
  )
}
