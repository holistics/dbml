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
      // Note: Don't externalize `lodash-es` since using Node lower than 22.12.0 cannot import it in `cjs` format
      external: ['monaco-editor-core'],
    },
  },
  test: {
    globals: true,
  },
});

