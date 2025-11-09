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
      "@lib": path.resolve(__dirname, "src/lib/"),
      "@services": path.resolve(__dirname, "src/services/"),
      "@lexer": path.resolve(__dirname, "src/lib/lexer/"),
      "@parser": path.resolve(__dirname, "src/lib/parser/"),
      "@analyzer": path.resolve(__dirname, "src/lib/analyzer/"),
      "@interpreter": path.resolve(__dirname, "src/lib/interpreter/"),
      "@serialization": path.resolve(__dirname, "src/lib/serialization/"),
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
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['monaco-editor-core'],
    },
  },
  test: {
    globals: true,
  },
});
