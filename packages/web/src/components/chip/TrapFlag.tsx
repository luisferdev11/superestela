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
