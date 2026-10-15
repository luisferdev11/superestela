/**
 * Ordenar una tabla por la columna que se pulsa, como cualquier hoja de calculo:
 * el primer clic ordena en el sentido natural de esa columna, el segundo lo
 * invierte. Lo comparten el Radar y el Traductor de varios lanzadores.
 *
 * Un valor ausente («no concluyente», «muestra insuficiente») va **siempre al
 * final**, en los dos sentidos: invertir el orden no lo convierte en el mejor.
 */

export type SortDirection = 'desc' | 'asc'

export type SortState<K extends string> = {
  readonly key: K
  readonly direction: SortDirection
}

/** El estado tras pulsar una columna: la misma invierte, otra empieza en su sentido natural. */
export const nextSort = <K extends string>(
  current: SortState<K>,
  key: K,
  firstDirection: SortDirection,
): SortState<K> =>
  current.key === key
    ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
    : { key, direction: firstDirection }

export type SortValue = number | string | null

const compare = (a: SortValue, b: SortValue): number => {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'es')
  return Number(a) - Number(b)
}

/**
 * Las filas ordenadas por `valueOf`, con los `null` al final. Es estable: dos
 * filas empatadas conservan el orden en que llegaron, asi que un desempate se
 * logra ordenando antes por el criterio secundario.
 */
export const sortRows = <T>(
  rows: readonly T[],
  valueOf: (row: T) => SortValue,
  direction: SortDirection,
): readonly T[] => {
  const sign = direction === 'desc' ? -1 : 1
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index
        return a.value === null ? 1 : -1
      }
      return sign * compare(a.value, b.value) || a.index - b.index
    })
    .map(({ row }) => row)
}
