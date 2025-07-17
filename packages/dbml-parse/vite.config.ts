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
      lodash: 'lodash-es',
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'DbmlParser',
      fileName: 'dbml-parse',
      formats: ['cjs', 'es']
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['monaco-editor-core', 'lodash-es'],
    },
  },
  test: {
    globals: true,
  },
});

