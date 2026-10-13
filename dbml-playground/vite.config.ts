import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'path';

/**
 * Where the renderer actually is, asked of the resolver rather than guessed from a path.
 *
 * It is a closed package and most people working on DBML will not have it. Returning undefined
 * is the honest answer then: everything in the playground works except the Architecture tab.
 */
function rendererRoot (): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    return dirname(require.resolve('@holistics/dbx-graph-renderer/package.json'));
  } catch {
    return undefined;
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/playground/',
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    // the renderer lives outside this root, so `elkjs` would otherwise resolve to its copy and
    // the pre-bundled one would go unused: two resolutions of the same package, one of them
    // UMD and unservable
    dedupe: ['elkjs', 'vue'],
    alias: {
      '@': resolve(__dirname, 'src'),
      // `@dbml/parse` deliberately stays on its built dist: its own sources use `@/` to mean
      // its own src, which would collide with the alias above. Run `yarn build` in that package
      // after touching the kernel. `@dbml/arch` has no such alias of its own, so it runs from
      // source and edits to the dialect are live.
      '@dbml/arch': resolve(__dirname, '../packages/dbml-arch/src/index.ts'),
    },
  },
  server: {
    port: 3001,
    open: true,
    fs: {
      // `@holistics/dbx-graph-renderer` is consumed as source and is usually `yarn link`ed, so
      // it resolves to wherever that checkout happens to be. Vite refuses to serve files from
      // outside the project root unless told, and the whole point of a link is that the path is
      // not ours to predict.
      allow: [resolve(__dirname, '..'), rendererRoot()].filter(Boolean) as string[],
    },
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    // elkjs must be pre-bundled, not excluded. `elk.bundled.js` is a UMD file, so the dev
    // server cannot serve it as a module on its own, and the renderer's dynamic import of it
    // fails silently into the grid fallback. Excluding it does not buy the code splitting
    // either: that is rollup's doing at build time, and it still produces its own chunk.
    include: ['monaco-editor', 'vue', 'elkjs/lib/elk.bundled.js'],
    // The renderer is consumed as TypeScript source over a `yarn link`. Vite already skips
    // pre-bundling a linked package, but saying so here is what keeps an edit in that checkout
    // live: the moment it lands in the dependency cache instead, the playground serves a
    // snapshot and every change to the renderer looks like it did nothing.
    exclude: ['@holistics/dbx-graph-renderer'],
  },
});
