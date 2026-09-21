import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Los tests de dominio y de contrato no necesitan DOM; los de componente
    // si. `jsdom` para todos cuesta poco y evita dos configuraciones.
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.join(import.meta.dirname, 'src') },
  },
})
