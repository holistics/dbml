import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import tsparser from '@typescript-eslint/parser';
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
  tseslint.configs.recommended,
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
        'bin/*',
        'eslint.config.ts',
        'vite.config.ts',
      ],
    },
    {
      files: ['**/*.ts', '**/*.js'],
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.es2022,
        },
        parser: tsparser,
        parserOptions: {
          sourceType: 'module',
          ecmaVersion: 2018,
          project: './tsconfig.json',
          tsconfigRootDir: import.meta.dirname,
        },
      },
      plugins: {
        '@stylistic': stylistic,
        import: importPlugin,
      },
      settings: IMPORT_SETTINGS,
      rules: {
        ...IMPORT_ORDER_RULES,
        '@stylistic/object-curly-newline': ['error', {
          ObjectExpression: { multiline: true, minProperties: 1 },
          ObjectPattern: { multiline: true, minProperties: 1 },
          ImportDeclaration: { multiline: true, minProperties: 1 },
          ExportDeclaration: { multiline: true, minProperties: 1 },
        }],
        '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
        '@typescript-eslint/no-explicit-any': 'off',
        'no-use-before-define': 'off',
        'no-continue': 'off',
        '@stylistic/space-before-function-paren': ['error', 'always'],
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        'consistent-return': 'off',
        '@typescript-eslint/consistent-return': [
          'error',
        ],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
        '@stylistic/max-statements-per-line': 'off',
        '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],
      },
    },
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts'],
      languageOptions: {
        globals: {
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
      },
      rules: {
        'no-undef': 'warn',
      },
    },
    {
      files: ['bin/**/*', '**/*.test.js', '**/*.spec.js', '__tests__/**/*'],
      rules: {
        '@typescript-eslint/no-require-imports': 'warn',
        'no-global-assign': 'warn',
      },
    },
  ],
);
