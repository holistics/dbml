/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'DbmlParser',
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
    coverage: {
      provider: 'v8',
      reporter: ['json', 'json-summary', 'html', 'text'],
    },
  },
});
