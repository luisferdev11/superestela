import { es } from '@/i18n/es'

/**
 * Se ve fuerte a nivel del mar y colapsa en altitud extrema. 58 de 370
 * temporadas.
 *
 * **Nunca depende solo del color** (docs/02 seccion 1, semanticos): lleva
 * marca visible y texto accesible, porque un lector de pantalla y un
 * proyector malo tienen el mismo problema.
 */
export const TrapFlag = ({ trap }: { readonly trap: boolean }) => {
  if (!trap) return null

  return (
    <span className="font-bold text-(--color-semantic-trap)" title={es.trapDescription}>
      <span aria-hidden="true">{'▌'}</span>
      <span className="sr-only">{es.trap}</span>
    </span>
  )
}

/**
 * La explicacion de la marca, siempre visible arriba de una tabla que la usa
 * (14 de octubre): quien llega nuevo no tiene por que abrir la guia para saber
 * que significa una barra roja junto a un nombre.
 */
export const TrapLegend = () => (
  <p className="m-0 flex items-baseline gap-2 text-[12px] text-(--color-text)">
    <span aria-hidden="true" className="font-bold text-(--color-semantic-trap)">
      {'▌'}
    </span>
    <span>{es.legend.trap}</span>
  </p>
)
