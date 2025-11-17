import jest from 'eslint-plugin-jest';
import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';

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
          ...globals.browser,
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
        '@stylistic/quotes': ['error', 'single', { 'avoidEscape': true }],
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
