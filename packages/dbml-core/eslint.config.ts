import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import tseslint from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';

const IMPORT_ORDER_RULES = {
  'import/order': ['error', {
    groups: [
      'builtin',
      'external',
      'internal',
      'parent',
      'sibling',
      'index',
    ],
    'newlines-between': 'never',
    alphabetize: {
      order: 'asc',
      caseInsensitive: false,
    },
  }],
  'import/newline-after-import': ['error', { count: 1 }],
  'sort-imports': ['error', {
    ignoreDeclarationSort: true,
    ignoreCase: false,
    memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
  }],
};

const IMPORT_SETTINGS = {
  'import/resolver': {
    typescript: {
      alwaysTryTypes: true,
      project: './tsconfig.json',
    },
    node: true,
  },
};

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
          ...globals.node,
          ...globals.es2022,
        },
      },
      plugins: {
        '@stylistic': stylistic,
        import: importPlugin,
      },
      settings: IMPORT_SETTINGS,
      rules: {
        ...IMPORT_ORDER_RULES,
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
        import: importPlugin,
      },
      settings: IMPORT_SETTINGS,
      languageOptions: {
        globals: {
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
        ...IMPORT_ORDER_RULES,
        '@stylistic/object-curly-newline': ['error', {
          ObjectExpression: { multiline: true, minProperties: 1 },
          ObjectPattern: { multiline: true, minProperties: 1 },
          ImportDeclaration: { multiline: true, minProperties: 1 },
          ExportDeclaration: { multiline: true, minProperties: 1 },
        }],
        '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
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
