import { positionInScale, type DensityScale } from '@/domain/density'
import { formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

/**
 * Elemento de marca (`docs/02` seccion 3): muestra el aire medido del entorno.
 * Es la procedencia del numero, no un adorno — por eso el gradiente usa los
 * mismos tokens de la escala de altitud que codifican entorno en toda la app, y
 * la cifra sale de `evidence.py`, nunca escrita aqui.
 *
 * `role="img"` con un `aria-label` que contiene el numero real, como pide
 * `docs/07` seccion 5.2 regla 4: un lector de pantalla debe poder leer el
 * hallazgo.
 */
export const DensityBar = ({ scale }: { readonly scale: DensityScale }) => {
  const ratio = scale.extreme.densityRatio
  const marker = positionInScale(scale, 'hh')
  const label = `${es.densityIndex}: ${formatNumber(ratio, 3)} ${es.atHarpHelu}`

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-bold tracking-widest text-(--color-text-muted) uppercase">
        {es.densityIndex}
      </div>
      <svg
        viewBox="0 0 380 22"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="h-[18px] w-full"
      >
        <defs>
          <linearGradient id="densityScale" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-altitude-sea)" />
            <stop offset="0.388" stopColor="var(--color-altitude-medium)" />
            <stop offset="0.568" stopColor="var(--color-altitude-extreme)" />
            <stop offset="1" stopColor="var(--color-altitude-extreme)" />
          </linearGradient>
        </defs>
        <rect x="0" y="7" width="380" height="8" fill="url(#densityScale)" />
        <line
          x1={380 * (1 - marker)}
          y1="0"
          x2={380 * (1 - marker)}
          y2="22"
          stroke="#FFFFFF"
          strokeWidth="3"
        />
      </svg>
      <div className="text-[11px] font-semibold text-white tabular-nums">
        {formatNumber(ratio, 3)} {es.atHarpHelu}
      </div>
    </div>
  )
}
