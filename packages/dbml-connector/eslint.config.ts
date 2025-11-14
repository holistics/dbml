import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import tsparser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    semi: true,
    quotes: 'single',
    arrowParens: true,
    braceStyle: '1tbs',
  }),
  [
    {
      ignores: [
        'node_modules/*',
        'dist/*',
        'eslint.config.ts',
        'jestHelpers.ts',
        'jest.config.ts',
        '**/*.test.ts',
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
        },
      },
      plugins: {
        '@stylistic': stylistic,
      },
      rules: {
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
      },
      settings: {
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: 'packages/*/{ts,js}config.json',
          },
        },
      },
    },
  ],
);
