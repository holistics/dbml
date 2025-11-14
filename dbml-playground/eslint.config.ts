import globals from 'globals';
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import eslint from '@eslint/js';
import tsparser from '@typescript-eslint/parser';
import vueEslintPlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig(
  eslint.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    semi: true,
    quotes: 'single',
    arrowParens: true,
    braceStyle: '1tbs',
  }),
  [
    {
      ignores: ['node_modules/', 'dist/', 'vite.config.ts', 'tailwind.config.js', 'eslint.config.ts'],
    },
    vueEslintPlugin.configs['flat/strongly-recommended'], 
    {
      files: ['**/*.{js,ts,vue}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
          ...globals.browser,
          ...globals.es2022,
          ...globals.node,
          defineProps: 'readonly',
          defineEmits: 'readonly',
          defineExpose: 'readonly',
          withDefaults: 'readonly',
        },
        parser: vueParser,
        parserOptions: {
          parser: {
            ts: tsparser,
          },
          project: './tsconfig.app.json',
          extraFileExtensions: ['.vue'],
        },
      },
      plugins: {
        vue: vueEslintPlugin,
        '@typescript-eslint': tseslint,
        '@stylistic': stylistic,
      },
      rules: {
        ...js.configs.recommended.rules,
        ...tseslint.configs.recommended.rules,
        '@stylistic/space-before-function-paren': ['error', 'always'],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        'vue/multi-word-component-names': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        'no-useless-escape': 'off',
      },
    },
  ],
);
