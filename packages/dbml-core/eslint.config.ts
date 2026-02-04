import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import tseslint from '@typescript-eslint/eslint-plugin';

export default defineConfig(
  eslint.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    semi: true,
    arrowParens: true,
    braceStyle: '1tbs',
  }),
  [
    {
      ignores: [
        'node_modules/*',
        'lib/*',
        'types/*',
        'src/parse/deprecated/*',
        'src/parse/ANTLR/parsers/*',
        '__tests__/*',
      ],
    },
    {
      files: ['**/*.js'],
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.es2022,
        },
      },
      plugins: {
        '@stylistic': stylistic,
      },
      rules: {
        'no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@stylistic/space-before-function-paren': ['error', 'always'],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
        '@stylistic/max-statements-per-line': 'off',
        '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],
      },
    },
    {
      files: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      plugins: {
        '@typescript-eslint': tseslint,
      },
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.es2022,
          // Vitest globals
          describe: 'readonly',
          it: 'readonly',
          test: 'readonly',
          expect: 'readonly',
          beforeAll: 'readonly',
          afterAll: 'readonly',
          beforeEach: 'readonly',
          afterEach: 'readonly',
          vi: 'readonly',
        },
        parser: tsparser,
        parserOptions: {
          sourceType: 'module',
          ecmaVersion: 2020,
          project: './tsconfig.json',
          tsconfigRootDir: import.meta.dirname,
        },
      },
      rules: {
        'no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@stylistic/space-before-function-paren': ['error', 'always'],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
        '@stylistic/max-statements-per-line': 'off',
        '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
);
