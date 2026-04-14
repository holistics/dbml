/// <reference types='vitest' />

import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
    extensions: ['.ts', '.js', '.cjs', '.mjs', '.json'],
  },
  build: {
    outDir: 'lib',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs' }`,
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      // @dbml/parse is intentionally excluded from the bundle and declared as a
      // peerDependency so that consumers who install both @dbml/core and
      // @dbml/parse share a single instance of the package. Bundling it would
      // create a second, isolated copy whose classes and symbols are distinct
      // from the consumer's own copy, breaking instanceof checks and
      // cross-package type compatibility.
      external: [
        '@dbml/parse',
      ],
    },
  },
  test: {
    globals: true,
    testTimeout: 120000,  // 2 minutes for slow tests with coverage
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'text'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/parse/ANTLR/**',           // ANTLR parsers + AST generation (33MB)
        '**/parse/deprecated/**',      // Deprecated parsers (1.4MB)
        '**/**/constants.js',          // Constants don't need coverage
        '**/index.js',                 // Re-export files
        '**/index.ts',
      ],
    },
  },
});
