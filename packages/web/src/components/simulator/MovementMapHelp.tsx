'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { es } from '@/i18n/es'

const copy = es.sim.map.help

/**
 * El diagrama de referencia: los dos ejes del mapa con sus nombres de beisbol,
 * el lanzador visto desde atras con el brazo a la derecha, y dos pitches
 * tipicos. SVG a mano, sin imagenes externas (`docs/07` seccion 5.1).
 */
const Diagram = () => (
  <svg viewBox="0 0 440 250" role="img" aria-label={copy.title} className="w-full max-w-[480px]">
    <line x1="20" y1="120" x2="420" y2="120" stroke="var(--color-border-strong)" />
    <line x1="220" y1="20" x2="220" y2="230" stroke="var(--color-border-strong)" />
    <text x="22" y="112" fontSize="11" fill="var(--color-text-muted)">
      {copy.diagram.glove}
    </text>
    <text x="418" y="112" fontSize="11" textAnchor="end" fill="var(--color-text-muted)">
      {copy.diagram.arm}
    </text>
    <text x="226" y="30" fontSize="11" fill="var(--color-text-muted)">
      {copy.diagram.rises}
    </text>
    <text x="226" y="226" fontSize="11" fill="var(--color-text-muted)">
      {copy.diagram.drops}
    </text>
    {/* El lanzador de espaldas: el brazo de lanzar sube a la derecha. */}
    <g stroke="var(--color-ink)" strokeWidth="2" fill="none" strokeLinecap="round">
      <circle cx="220" cy="155" r="7" fill="var(--color-surface-card)" />
      <line x1="220" y1="162" x2="220" y2="190" />
      <line x1="220" y1="170" x2="205" y2="183" />
      <line x1="220" y1="168" x2="237" y2="151" />
      <line x1="220" y1="190" x2="210" y2="207" />
      <line x1="220" y1="190" x2="230" y2="207" />
    </g>
    <text x="220" y="244" fontSize="10" textAnchor="middle" fill="var(--color-text-muted)">
      {copy.diagram.pitcher}
    </text>
    {/* Una recta: sube y se carga al brazo. Un slider: casi no sube y se va al guante. */}
    <circle cx="330" cy="55" r="6" fill="var(--color-diablos)" />
    <text x="320" y="44" fontSize="10" textAnchor="middle" fill="var(--color-text)">
      {copy.diagram.fourSeam}
    </text>
    <circle cx="100" cy="135" r="6" fill="var(--color-ink)" />
    <text x="100" y="156" fontSize="10" textAnchor="middle" fill="var(--color-text)">
      {copy.diagram.slider}
    </text>
  </svg>
)

/**
 * «¿Como leer este mapa?»: un boton junto al titulo que abre la explicacion y
 * el diagrama. Se cierra con el boton, con Escape o tocando fuera. Lo usan el
 * Simulador y la Ficha.
 */
export const MovementMapHelp = () => {
  const [isOpen, setOpen] = useState(false)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="cursor-pointer border border-(--color-border-strong) bg-(--color-surface-card) px-2 py-0.5 text-[11px] font-semibold"
      >
        {copy.open}
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-full w-full max-w-[640px] flex-col gap-3 overflow-y-auto border border-(--color-border) bg-(--color-surface-card) p-6 text-[13px]"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="m-0 text-[16px] font-bold">
                {copy.title}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => {
                  setOpen(false)
                }}
                className="cursor-pointer border border-(--color-border-strong) bg-(--color-surface-card) px-2 py-1 text-[12px]"
              >
                {copy.close}
              </button>
            </div>
            <Diagram />
            <ul className="m-0 flex flex-col gap-1.5 pl-5">
              {copy.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
