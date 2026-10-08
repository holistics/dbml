/// <reference types='vitest' />

// Runs only the spec conformance tests (see spec/README.md). They are kept out
// of the default `vitest run` so that they can be non-blocking in CI while the
// spec is being brought into agreement with the parser.
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
      '@tests': path.resolve(__dirname, '__tests__/'),
    },
  },
  test: {
    globals: true,
    include: ['__tests__/conformance/**/*.test.ts'],
    // Compiles spec/antlr/*.g4 into __tests__/conformance/generated (not committed).
    globalSetup: ['__tests__/conformance/antlr.setup.ts'],
    testTimeout: 120000,
  },
});
