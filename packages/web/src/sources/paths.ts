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
const REPO_OUTPUTS = path.join(import.meta.dirname, '..', '..', '..', '..', 'analysis', 'outputs')

export const dataDir = (): string => process.env.SUPERESTELA_DATA_DIR ?? REPO_OUTPUTS

export const mockupDataPath = (): string => path.join(dataDir(), 'mockup_data.json')

export const evidencePath = (): string => path.join(dataDir(), 'evidence.json')
