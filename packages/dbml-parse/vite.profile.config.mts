import path from 'path';
import { defineConfig } from 'vite';
import noBundle from 'vite-plugin-no-bundle';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
  },
  plugins: [noBundle()],
  build: {
    lib: {
      entry: path.resolve(__dirname, '__benchmarks__/compiler.profile.ts'),
      formats: ['es'],
    },
    outDir: path.resolve(__dirname, 'dist-profile'),
    sourcemap: 'inline',
    minify: false,
    target: 'esnext',
    rollupOptions: {
      external: ['node:fs', 'node:path', 'node:url', 'lodash-es', 'luxon', 'pathe'],
    },
  },
});
