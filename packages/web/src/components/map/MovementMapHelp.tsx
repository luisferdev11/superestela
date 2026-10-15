'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { es } from '@/i18n/es'

const copy = es.sim.map.help

const ink = 'var(--color-ink)'
const muted = 'var(--color-text-muted)'
const faint = 'var(--color-border-strong)'
const arm = 'var(--color-diablos)'

/**
 * Detras de un lanzador diestro: las dos cajas de bateo y el plato al fondo,
 * las flechas de guante y brazo, el lanzador con el brazo de lanzar en rojo, y
 * la flecha de «sube». Es la «vista del lanzador» que usan todos los mapas.
 */
const Behind = () => (
  <svg viewBox="0 0 360 300" role="img" aria-label={copy.behind.title} className="w-full">
    <defs>
      <marker
        id="help-arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto"
      >
        <path d="M0,0 L10,5 L0,10 z" fill={ink} />
      </marker>
    </defs>
    <text x="180" y="22" textAnchor="middle" fontSize="15" fontWeight="700" fill={ink}>
      {copy.behind.title}
    </text>
    {/* Al fondo: el plato entre las dos cajas de bateo. */}
    <rect x="62" y="48" width="58" height="72" fill="none" stroke={faint} strokeDasharray="5 4" />
    <rect x="200" y="48" width="58" height="72" fill="none" stroke={faint} strokeDasharray="5 4" />
    <path
      d="M136,70 L184,70 L184,84 L160,98 L136,84 Z"
      fill="none"
      stroke={ink}
      strokeWidth="1.5"
    />
    <text x="91" y="140" textAnchor="middle" fontSize="12" fill={muted}>
      {copy.behind.leftBatter}
    </text>
    <text x="229" y="140" textAnchor="middle" fontSize="12" fill={muted}>
      {copy.behind.rightBatter}
    </text>
    {/* Las dos direcciones, desde el lanzador. */}
    <line
      x1="120"
      y1="172"
      x2="40"
      y2="172"
      stroke={ink}
      strokeWidth="1.5"
      markerEnd="url(#help-arrow)"
    />
    <text x="80" y="164" textAnchor="middle" fontSize="13" fontWeight="600" fill={ink}>
      {copy.behind.glove}
    </text>
    <line
      x1="200"
      y1="172"
      x2="280"
      y2="172"
      stroke={ink}
      strokeWidth="1.5"
      markerEnd="url(#help-arrow)"
    />
    <text x="240" y="164" textAnchor="middle" fontSize="13" fontWeight="600" fill={ink}>
      {copy.behind.arm}
    </text>
    {/* El lanzador de espaldas: el guante a su izquierda y el brazo de lanzar en alto. */}
    <circle
      cx="160"
      cy="214"
      r="12"
      fill="var(--color-surface-card)"
      stroke={ink}
      strokeWidth="2"
    />
    <line x1="160" y1="226" x2="160" y2="282" stroke={ink} strokeWidth="2" />
    <line x1="160" y1="246" x2="124" y2="262" stroke={ink} strokeWidth="2" />
    <line x1="160" y1="240" x2="194" y2="204" stroke={arm} strokeWidth="3" strokeLinecap="round" />
    <circle cx="198" cy="200" r="5" fill="var(--color-surface-card)" stroke={arm} strokeWidth="2" />
    <text x="208" y="204" fontSize="12" fill={arm}>
      {copy.behind.throwingArm}
    </text>
    <text x="104" y="278" textAnchor="middle" fontSize="12" fill={muted}>
      {copy.behind.gloveHand}
    </text>
    <line
      x1="318"
      y1="282"
      x2="318"
      y2="206"
      stroke={ink}
      strokeWidth="1.5"
      markerEnd="url(#help-arrow)"
    />
    <text x="326" y="250" fontSize="13" fontWeight="600" fill={ink}>
      {copy.behind.rises}
    </text>
  </svg>
)

/** Donde vive cada tipo de pitch en el plano: posiciones tipicas de un diestro, en el marco del brazo. */
const TYPICAL: readonly { readonly name: string; readonly hb: number; readonly ivb: number }[] = [
  { name: 'Four-Seam', hb: 8, ivb: 16 },
  { name: 'Sinker', hb: 14, ivb: 9 },
  { name: 'Changeup', hb: 13, ivb: 4 },
  { name: 'Cutter', hb: -1, ivb: 10 },
  { name: 'Slider', hb: -6, ivb: 2 },
  { name: 'Curveball', hb: -9, ivb: -12 },
]

/** El plano: break horizontal contra IVB, con los nombres de cada lado y un pitch tipico de cada tipo. */
const Plane = () => {
  const half = 20
  const size = 250
  const left = 45
  const top = 52
  const x = (hb: number): number => left + (size * (hb + half)) / (2 * half)
  const y = (ivb: number): number => top + (size * (half - ivb)) / (2 * half)
  return (
    <svg viewBox="0 0 360 320" role="img" aria-label={copy.plane.title} className="w-full">
      <text x="180" y="22" textAnchor="middle" fontSize="15" fontWeight="700" fill={ink}>
        {copy.plane.title}
      </text>
      <rect x={left} y={top} width={size} height={size} fill="none" stroke={faint} />
      <line x1={x(0)} y1={top} x2={x(0)} y2={top + size} stroke={ink} strokeWidth="1.2" />
      <line x1={left} y1={y(0)} x2={left + size} y2={y(0)} stroke={ink} strokeWidth="1.2" />
      <text x={x(0) + 6} y={top + 16} fontSize="12" fill={muted}>
        {copy.plane.rises}
      </text>
      <text x={x(0) + 6} y={top + size - 8} fontSize="12" fill={muted}>
        {copy.plane.drops}
      </text>
      <text x={left + 6} y={y(0) + 17} fontSize="12" fill={muted}>
        {copy.plane.glove}
      </text>
      <text x={left + size - 6} y={y(0) + 17} textAnchor="end" fontSize="12" fill={muted}>
        {copy.plane.arm}
      </text>
      <text x={left + size + 8} y={y(0) + 4} fontSize="12" fill={muted}>
        HB
      </text>
      <text x={x(0)} y={top - 6} textAnchor="middle" fontSize="12" fill={muted}>
        IVB
      </text>
      {TYPICAL.map((p) => (
        // Del lado del brazo, el nombre va a la izquierda del punto para no salirse del plano.
        <g key={p.name}>
          <circle
            cx={x(p.hb)}
            cy={y(p.ivb)}
            r="6"
            fill={p.name === 'Four-Seam' ? arm : 'var(--color-surface-card)'}
            stroke={p.name === 'Four-Seam' ? arm : ink}
            strokeWidth="1.5"
          />
          <text
            x={x(p.hb) + (p.hb > 10 ? -10 : 10)}
            y={y(p.ivb) + 4}
            textAnchor={p.hb > 10 ? 'end' : 'start'}
            fontSize="12"
            fill={ink}
          >
            {p.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

/**
 * «¿Como leer este mapa?»: un boton junto al titulo de cada mapa de movimiento
 * (Simulador, Ficha y Traductor) que abre la explicacion con dos diagramas:
 * donde quedan guante y brazo detras del lanzador, y el plano con un pitch
 * tipico de cada tipo. Se cierra con el boton, con Escape o tocando fuera.
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
        className="cursor-pointer border border-(--color-border-strong) bg-(--color-surface-card) px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      >
        {copy.open}
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-full w-full max-w-[900px] flex-col gap-4 overflow-y-auto border border-(--color-border) bg-(--color-surface-card) p-7 text-[14px] text-(--color-text)"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold tracking-widest text-(--color-text-muted) uppercase">
                  {copy.eyebrow}
                </div>
                <h2 id={titleId} className="m-0 text-[26px] font-bold tracking-tight">
                  {copy.title}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => {
                  setOpen(false)
                }}
                className="cursor-pointer border border-(--color-border-strong) bg-(--color-surface-card) px-3 py-1 text-[12px]"
              >
                {copy.close}
              </button>
            </div>
            <p className="m-0 max-w-[680px] leading-relaxed">{copy.intro}</p>
            <div className="grid grid-cols-1 gap-4 border border-(--color-border) bg-(--color-surface-page) p-4 md:grid-cols-2">
              <Behind />
              <Plane />
            </div>
            <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
              {copy.items.map((item) => (
                <div key={item.term}>
                  <dt className="font-bold">{item.term}</dt>
                  <dd className="m-0 leading-relaxed text-(--color-text-muted)">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </>
  )
}
