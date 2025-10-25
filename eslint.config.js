// eslint.config.js (ESLint 9 format)
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import unicorn from 'eslint-plugin-unicorn'
import promise from 'eslint-plugin-promise'
import security from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'
import perfectionist from 'eslint-plugin-perfectionist'
import noSecrets from 'eslint-plugin-no-secrets'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
      unicorn,
      promise,
      security,
      sonarjs,
      perfectionist,
      'no-secrets': noSecrets,
    },
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/no-unused-vars': ['error'],
      semi: ['error', 'always'],
      quotes: ['error', 'double'],
      'no-secrets/no-secrets': ['error', { tolerance: 4.5 }],
      'perfectionist/sort-imports': ['error', { type: 'alphabetical', order: 'asc' }],
    },
  },
]
