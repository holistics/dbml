/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ insertTypesEntry: true }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
  build: {
    target: 'node18',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      external: [
        '@google-cloud/bigquery',
        'lodash',
        'mssql',
        'mysql2',
        'oracledb',
        'pg',
        'snowflake-sdk',
        'fs',
        'fs/promises',
        'path',
        'crypto',
        'stream',
        'util',
        'timers',
        'zlib',
        'tls',
        'url',
        'net',
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
