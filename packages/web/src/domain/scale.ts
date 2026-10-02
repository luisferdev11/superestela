/**
 * Como se define el 100 de los scores que la app muestra. Lo declara el
 * artefacto (`mockup_data.json → scale`), no la pantalla:
 *
 * - `league`: el v0. 100 es el pitch promedio de toda la liga, los dos entornos
 *   juntos, asi que el Δ por altitud incluye lo que el aire le quita a todos.
 * - `perEnvironment`: lo que pidio Diablos en el Q&A (`docs/11` seccion 8.3).
 *   100 es el promedio de cada entorno, y el Δ dice cuanto cambia el lugar del
 *   lanzador frente a los de su entorno, no cuanto pierde.
 *
 * Los textos que dependen de esto viven en `es.scale[kind]`; cuando datos
 * cambie la escala, cambian solos.
 */
export type ScaleKind = 'league' | 'perEnvironment'

export const SCALE_KINDS: readonly ScaleKind[] = ['league', 'perEnvironment']
