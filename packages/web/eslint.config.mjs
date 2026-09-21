import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import next from 'eslint-config-next/core-web-vitals'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...next,
  {
    // Las reglas con informacion de tipos solo sobre el codigo fuente: los
    // archivos de configuracion viven fuera del tsconfig y no tienen programa
    // que consultar. `next` trae su propio parser, asi que hay que devolver el
    // de typescript-eslint aqui o las reglas tipadas no encuentran servicios.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { import: importPlugin },
    rules: {
      // CONVENTIONS.md seccion 4, regla 2: `any` esta prohibido.
      '@typescript-eslint/no-explicit-any': 'error',
      // CONVENTIONS.md seccion 4, regla 4: sin default exports. Los nombrados
      // se buscan con grep y se renombran sin sorpresas.
      'import/no-default-export': 'error',
    },
  },
  {
    // La excepcion que la propia regla 4 concede: Next exige default export en
    // paginas y layouts.
    files: ['src/app/**/*.ts', 'src/app/**/*.tsx'],
    rules: { 'import/no-default-export': 'off' },
  },
)
