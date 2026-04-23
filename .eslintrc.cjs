/**
 * ESLint config — React + TypeScript (Vite).
 *
 * Basat en la plantilla oficial Vite React-TS, que és la setup més
 * utilitzada per a webs modernes amb aquest stack. Pragmàtic per a MVP:
 * ens dona lint útil sense activar regles "type-aware" (que requereixen
 * projectParser i alenteixen notablement el lint).
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: '18' },
  },
  rules: {
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
  overrides: [
    {
      // Fitxers de test: relaxem algunes regles
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      // Scripts i fitxers de config JS
      files: ['*.cjs', '*.config.js', '*.config.ts'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
