import { es } from '@/i18n/es'
import type { Role } from '@/domain/types'

/**
 * Dos valores, abridor o relevista — dos porque dos es lo que el dato separa
 * (`docs/adr/0004`). El rol es por temporada, no por lanzador (`docs/adr/0005`),
 * y es `null` debajo de cinco apariciones.
 *
 * La etiqueta en espanol sale de `i18n/es.ts`, nunca escrita aqui
 * (`CONVENTIONS.md` seccion 4, regla 7).
 */
export const RoleChip = ({ role }: { readonly role: Role | null }) => {
  if (role === null) {
    return <span className="text-(--color-semantic-inconclusive)">{es.unknownRole}</span>
  }

  return <span className="text-(--color-text)">{es.role[role]}</span>
}
