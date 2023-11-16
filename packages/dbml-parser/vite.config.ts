/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'DbmlParser',
      fileName: 'dbml-parser',
      formats: ['cjs', 'es']
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['monaco-editor-core', 'lodash'],
    }
  },
  test: {
    globals: true,
  },
});

