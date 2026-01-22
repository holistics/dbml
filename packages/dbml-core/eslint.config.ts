import jest from 'eslint-plugin-jest';
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
        'src/parse/dbmlParser.js',
        'src/parse/mssqlParser.js',
        'src/parse/mysqlParser.js',
        'src/parse/postgresParser.js',
        'src/parse/schemarbParser.js',
        'src/parse/ANTLR/parsers/*',
      ],
    },
    {
      files: ['**/*.js'],
      languageOptions: {
        globals: {
          // This globals has a key "AudioWorkletGlobalScope " with a trailing space, causing eslint to crash
          // ...globals.browser,
          ...globals.jest,
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
      ...jest.configs['flat/recommended'],
      plugins: {
        '@typescript-eslint': tseslint,
      },
      languageOptions: {
        globals: {
          // This globals has a key "AudioWorkletGlobalScope " with a trailing space, causing eslint to crash
          // ...globals.browser,
          ...globals.jest,
          ...globals.node,
          ...globals.es2022,
        },
        parser: tsparser,
        parserOptions: {
          sourceType: 'module',
          ecmaVersion: 2020,
          project: './tsconfig.json',
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
