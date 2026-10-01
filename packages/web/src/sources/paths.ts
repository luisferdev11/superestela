import path from 'node:path'

/**
 * La app lee los artefactos reales de `analysis/outputs/`, no una copia. Una
 * copia seria una cuarta fuente de verdad que se queda atras en silencio; leer
 * el archivo real hace que el test de contrato detecte la deriva entre el
 * equipo de datos y producto el dia que ocurra.
 *
 * `SUPERESTELA_DATA_DIR` existe para CI y contenedores, donde la ruta relativa
 * al repositorio puede no aplicar.
 */
// Anclado a `process.cwd()` y no a `import.meta.dirname`: el bundle de Next no
// define esa variable, asi que un modulo que la usa compila y revienta al
// recolectar la pagina. `cwd` es `packages/web` tanto en Next como en Vitest.
const REPO_OUTPUTS = path.join(process.cwd(), '..', '..', 'analysis', 'outputs')

export const dataDir = (): string => process.env.SUPERESTELA_DATA_DIR ?? REPO_OUTPUTS

export const mockupDataPath = (): string => path.join(dataDir(), 'mockup_data.json')

export const evidencePath = (): string => path.join(dataDir(), 'evidence.json')

/** Lo que lee el Simulador (`docs/09`): rangos, mapa, arsenales y el veredicto de las compuertas. */
export const simulatorEvidencePath = (): string => path.join(dataDir(), 'simulator.json')

export const arsenalsPath = (): string => path.join(dataDir(), 'arsenals.json')

export const simulatorValidationPath = (): string =>
  path.join(dataDir(), 'simulator_validation.json')

/**
 * La ubicacion por lanzador-temporada y entorno. **Todavia no existe**: la
 * entrega el equipo de datos con Location+ (`docs/11`). Mientras no este, la
 * pestana Arsenal de la Ficha dice que esta pendiente.
 */
export const locationsPath = (): string => path.join(dataDir(), 'locations.json')

/** La proyeccion de P7: el arsenal a nivel del mar movido con `core.translate` (`analysis/projection_evidence.py`). */
export const projectionsPath = (): string => path.join(dataDir(), 'projections.json')
