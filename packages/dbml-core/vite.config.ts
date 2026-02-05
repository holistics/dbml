/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
    extensions: ['.ts', '.js', '.cjs', '.mjs', '.json'],
  },
  build: {
    outDir: 'lib',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['cjs', 'es'],
    },
  },
  optimizeDeps: {
    exclude: ['parsimmon'],
  },
  test: {
    globals: true,
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'text'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/parse/ANTLR/parsers/**',  // Auto-generated ANTLR parsers (32MB)
        '**/parse/deprecated/**',      // Deprecated parsers
      ],
    },
  },
});
