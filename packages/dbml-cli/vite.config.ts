/// <reference types='vitest' />

import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
  },
  build: {
    target: 'node18',
    outDir: 'lib',
    minify: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      fileName: 'index',
      formats: ['cjs'],
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
      external: [
        '@dbml/connector',
        '@dbml/core',
        'bluebird',
        'chalk',
        'commander',
        'esm',
        'figures',
        'lodash',
        'pegjs-require-import',
        'strip-ansi',
        'winston',
        'path',
        'fs',
        /^node:.*/,
      ],
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'text'],
    },
  },
});
