/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';

export default defineConfig({
  plugins: [commonjs()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: 'dbml-core',
      formats: ['cjs', 'es'],
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
