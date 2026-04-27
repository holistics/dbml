/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'packages/dbml-parse/src/'),
      '@tests': path.resolve(__dirname, 'packages/dbml-parse/__tests__/'),
    },
  },
  test: {
    globals: true,
    testTimeout: 50000,
  },
});
