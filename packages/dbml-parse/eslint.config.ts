import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import airbnbBase from 'eslint-config-airbnb-base';
import tseslint from 'typescript-eslint';
import tsparser from '@typescript-eslint/parser';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  [
    {
      ignores: [
        'node_modules/*',
        'dist/*',
        'vite.config.ts',
        'eslint.config.ts',
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
        },
      },
      rules: {
        ...airbnbBase.rules,
        '@typescript-eslint/no-explicit-any': 'off',
        'no-use-before-define': 'off',
        'no-continue': 'off',
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
