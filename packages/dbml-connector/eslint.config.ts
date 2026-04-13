import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import tsparser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';
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
        'eslint.config.ts',
        'vite.config.ts',
        '**/*.test.ts',
        '__tests__/**/*',
      ],
    },
    {
      files: ['**/*.ts'],
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
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: false },
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
        'no-useless-escape': 'warn',
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
        '@typescript-eslint/consistent-return': ['error'],
        '@stylistic/quotes': ['error', 'single', { 'avoidEscape': true }],
        '@stylistic/max-statements-per-line': 'off',
        '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],
      },
      settings: {
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: './tsconfig.json',
          },
          node: true,
        },
      },
    },
  ],
);
