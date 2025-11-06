import jest from 'eslint-plugin-jest';
import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import airbnbBase from 'eslint-config-airbnb-base';

export default defineConfig(
  eslint.configs.recommended,
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
          ...globals.browser,
          ...globals.jest,
          ...globals.node,
          ...globals.es2022,
        },
      },
      rules: {
        ...airbnbBase.rules,
        'no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      }
    },
    {
      files: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
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
  ],
);
