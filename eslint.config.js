/**
 * ESLint flat config (v9) — React + TypeScript (Vite).
 *
 * Migrat des de .eslintrc.cjs. Manté les mateixes regles pragmàtiques
 * per a l'MVP: lint útil sense regles type-aware (que alenteixen el lint).
 */
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  // Fitxers a ignorar (substitueix .eslintignore)
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // Config base per a tots els fitxers TS/TSX
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: '18' },
    },
    rules: {
      // React Hooks
      ...reactHooks.configs.recommended.rules,

      // Vite HMR: només s'ha d'exportar un component per fitxer
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // TS ja s'encarrega d'aquestes — evitem soroll
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Permetre ús pragmàtic de `any` com a warn (no error) per no bloquejar l'MVP
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Fitxers de test: relaxem algunes regles
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Scripts i fitxers de config JS
  {
    files: ['*.cjs', '*.config.js', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
)
