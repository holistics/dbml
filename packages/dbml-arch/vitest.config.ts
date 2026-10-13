import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@dbml/parse': resolve(__dirname, '../dbml-parse/src/index.ts'),
      '@': resolve(__dirname, '../dbml-parse/src'),
    },
  },
  test: { environment: 'node' },
});
