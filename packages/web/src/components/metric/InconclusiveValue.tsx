import { es } from '@/i18n/es'

/**
 * El cuarto estado de dato, junto a cargando, vacio y error (docs/07 seccion
 * 5.2, regla 3). Es donde se caen casi todos los prototipos: en la P1 son 330
 * de 370 celdas de Impuesto, o sea la columna, no un caso borde.
 */
export const InconclusiveValue = ({ short = false }: { readonly short?: boolean }) => (
  <span className="whitespace-nowrap text-(--color-semantic-inconclusive)" title={es.inconclusive}>
    {short ? es.inconclusiveShort : es.inconclusive}
  </span>
)

/** Debajo del umbral de muestra no se dice un numero con banda enorme. */
export const InsufficientSample = ({ short = false }: { readonly short?: boolean }) => (
  <span
    className="whitespace-nowrap text-(--color-semantic-inconclusive)"
    title={es.insufficientSample}
  >
    {short ? es.insufficientSampleShort : es.insufficientSample}
  </span>
)
