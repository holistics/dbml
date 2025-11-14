import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import tsparser from '@typescript-eslint/parser';
import jest from 'eslint-plugin-jest';

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
        'lib/*',
        'jestHelpers.js',
        'eslint.config.ts',
        'jest.config.ts',
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
        },
      },
      plugins: {
        '@stylistic': stylistic,
      },
      rules: {
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
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      ...jest.configs['flat/recommended'],
      languageOptions: {
        globals: {
          ...jest.environments.globals.globals,
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
