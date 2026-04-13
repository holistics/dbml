import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

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
        'dist/*',
        'vite.config.ts',
        'eslint.config.ts',
        '__tests__/*',
      ],
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: {
        parser: tsparser,
        parserOptions: {
          sourceType: 'module',
          ecmaVersion: 2020,
          project: './tsconfig.json',
          tsconfigRootDir: import.meta.dirname,
        },
      },
      plugins: {
        '@stylistic': stylistic,
        import: importPlugin,
      },
      rules: {
        'import/order': ['error', {
          'groups': [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'never',
          'alphabetize': {
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
        '@stylistic/quotes': ['error', 'single', { 'avoidEscape': true }],
        '@stylistic/max-statements-per-line': 'off',
        '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],
        '@stylistic/object-curly-newline': ['error', {
          ObjectExpression: { multiline: true, minProperties: 1 },
          ObjectPattern: { multiline: true, minProperties: 1 },
          ImportDeclaration: { multiline: true, minProperties: 1 },
          ExportDeclaration: { multiline: true, minProperties: 1 },
        }],
        '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
        '@stylistic/array-bracket-newline': ['error', { multiline: true, minItems: 4 }],
        '@stylistic/array-element-newline': ['error', { multiline: true, minItems: 4 }],
        '@stylistic/function-call-argument-newline': ['error', 'consistent'],
      },
      settings: {
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: './tsconfig.json',
          },
          node: true,
        },
        'import/internal-regex': '^@/',
      },
    },
  ],
);
