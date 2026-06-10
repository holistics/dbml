import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, '__benchmarks__/compiler.profile.ts'),
      fileName: 'compiler.profile',
      formats: ['es'],
    },
    outDir: path.resolve(__dirname, '__benchmarks__/output'),
    sourcemap: 'inline',
    minify: false,
    target: 'esnext',
    rollupOptions: {
      external: ['node:fs', 'node:path', 'node:url'],
      treeshake: false,
    },
  },
});
