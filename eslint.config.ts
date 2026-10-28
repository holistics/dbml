import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import tsparser from '@typescript-eslint/parser';
import unicorn from 'eslint-plugin-unicorn';
import vueEslintPlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

const sharedRules = {
  // TypeScript
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
  '@typescript-eslint/consistent-return': ['error'],

  // Stylistic
  '@stylistic/space-before-function-paren': ['error', 'always'],
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],
  '@stylistic/max-statements-per-line': 'off',
  '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],
  '@stylistic/object-curly-newline': ['error', {
    ImportDeclaration: { multiline: true, minProperties: 4 },
    ExportDeclaration: { multiline: true, minProperties: 4 },
    TSInterfaceBody: { multiline: true, minProperties: 1 },
  }],
  '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
  '@stylistic/array-bracket-newline': ['error', 'consistent'],
  '@stylistic/array-element-newline': ['error', 'consistent'],
  '@stylistic/function-call-argument-newline': ['error', 'consistent'],

  // Naming
  'id-length': ['error', {
    min: 2,
    properties: 'never',
    exceptions: ['_'],
    exceptionPatterns: ['^[A-Z]$'],
  }],
  'unicorn/name-replacements': ['error', {
    checkVariables: true,
    checkProperties: false,
    checkFilenames: false,
    checkShorthandProperties: false,
    extendDefaultReplacements: true,
    replacements: {
      res: { result: true, response: false, resource: false },
      rel: { relative: true, related: false, relationship: false },
      def: { definition: true, defer: false, deferred: false, define: false },
      dst: { destination: true, daylightSavingTime: false, distribution: false },
      docs: { documents: true, documentation: false },
      dir: { directory: true, direction: false },
      db: false,
      dep: false,
      deps: false,
      ref: false,
      refs: false,
      ep: { endpoint: true },
    },
    extendDefaultAllowList: true,
    allowList: {
      fn: true,
      args: true,
    },
    ignore: [
      '^_',
    ],
  }],
};

const sharedPlugins = {
  '@stylistic': stylistic,
  unicorn,
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
        '**/node_modules/**',
        '**/dist/**',
        '**/dist-profile/**',
        '**/lib/**',
        '**/bin/**',
        '**/types/**',
        'packages/dbml-core/src/parse/deprecated/**',
        'packages/dbml-core/src/parse/ANTLR/parsers/**',
        '**/eslint.config.ts',
        '**/vite.config.ts',
        '**/vite.profile.config.ts',
        'dbml-playground/tailwind.config.js',
      ],
    },

    // All TS/JS files across all packages
    {
      files: ['packages/**/*.ts', 'packages/**/*.tsx', 'packages/**/*.js'],
      languageOptions: {
        parser: tsparser,
        parserOptions: {
          sourceType: 'module',
          ecmaVersion: 2020,
          project: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
      plugins: sharedPlugins,
      rules: sharedRules,
    },

    // Playground — Vue files
    ...vueEslintPlugin.configs['flat/strongly-recommended'].map(
      (config: any) => ({ ...config, files: ['dbml-playground/**/*.vue'] }),
    ),
    {
      files: ['dbml-playground/**/*.{js,ts,vue}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: vueParser,
        parserOptions: {
          parser: {
            ts: tsparser,
          },
          project: './dbml-playground/tsconfig.app.json',
          extraFileExtensions: ['.vue'],
        },
      },
      plugins: {
        vue: vueEslintPlugin,
        ...sharedPlugins,
      },
      rules: {
        ...sharedRules,
        '@typescript-eslint/ban-ts-comment': 'off',
        'vue/multi-word-component-names': 'off',
        'no-useless-escape': 'off',
      },
    },
  ],
);
