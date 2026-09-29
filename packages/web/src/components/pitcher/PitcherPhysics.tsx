import type { DensityScale } from '@/domain/density'
import { formatNumber } from '@/domain/format'
import { es } from '@/i18n/es'

/**
 * Por que pierde lo que pierde, en una frase (`docs/00` seccion 6, principio
 * 3). La densidad y el factor Magnus salen de la escala medida en
 * `evidence.json`, la misma que dibuja la barra del rail.
 */
export const PitcherPhysics = ({ scale }: { readonly scale: DensityScale }) => (
  <p className="border-l-[3px] border-(--color-diablos) bg-(--color-surface-card) px-4 py-3 text-[13px] leading-relaxed">
    <span className="font-semibold">{es.ficha.physics.title}</span>{' '}
    {es.ficha.physics.body(
      formatNumber(scale.extreme.densityRatio, 3),
      formatNumber(scale.extreme.magnusRatio, 3),
    )}
  </p>
)
