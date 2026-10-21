/**
 * Umbral de muestra. Espejo de `MIN_PITCHES_FOR_SCORE` en
 * `packages/contracts/schemas.py`: debajo de esto no hay score, hay "muestra
 * insuficiente". Un test lee la constante de Python y compara, para que las dos
 * no se separen en silencio.
 */
export const MIN_PITCHES_FOR_SCORE = 50

/**
 * Los minimos de las tasas descriptivas (K%, BB%, K-BB% y whiff por swing).
 * Espejo de `packages/contracts/schemas.py`, con el mismo test de deriva.
 * Desde el 20 oct la tasa se da aunque no llegue: debajo se marca como muestra chica.
 */
export const MIN_PLATE_APPEARANCES_FOR_RATE = 50
export const MIN_SWINGS_FOR_RATE = 50

/** Los dos roles que el dato separa. Ver `docs/adr/0004`. */
export const ROLES = ['starter', 'reliever'] as const
