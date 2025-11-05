import airbnbBase from 'eslint-config-airbnb-base';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vueEslintPlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default defineConfig([
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
          ts: tsParser,
        },
        project: './tsconfig.app.json',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue: vueEslintPlugin,
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...airbnbBase.rules,
      ...typescriptEslint.configs.recommended.rules,
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
]);
