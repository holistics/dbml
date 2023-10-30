/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-dts';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: '{{camelCase name}}',
      fileName: (format) => `{{dashCase name}}.${format}.js`,
    },
  },
  plugins: [dts()],
  test: {
    globals: true,
  },
});
