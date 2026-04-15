/// <reference types='vitest' />

import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: [
        '__tests__/**',
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
      '@tests': path.resolve(__dirname, '__tests__/'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: 'dbml-parse',
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      // Browser-specific libraries that are only here for typings and testings
      // should not be bundled
      external: ['monaco-editor-core'],
    },
  },
  test: {
    globals: true,
    alias: {
      'monaco-editor-core': path.resolve(__dirname, '__tests__/utils/monaco-editor-core-mock.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'text'],
    },
  },
});
