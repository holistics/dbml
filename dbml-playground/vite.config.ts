import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

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
      // The drawing lives in holistics/dbx-graph-renderer, which is closed, checked out beside
      // this one. It is the only closed dependency here and it is confined to this alias and to
      // ArchitectureTab.vue: `@dbml/arch` owns the model and the icon names and takes none.
      // The stylesheet first: aliases match in order, and the bare name would swallow it.
      '@holistics/dbx-graph-renderer/styles.css': resolve(__dirname, '../../dbx-graph-renderer/src/styles.css'),
      '@holistics/dbx-graph-renderer': resolve(__dirname, '../../dbx-graph-renderer/src/index.ts'),
    },
  },
  server: {
    port: 3001,
    open: true,
    fs: {
      // the renderer lives in a sibling repository, holistics/dbx-graph-renderer
      allow: [resolve(__dirname, '..'), resolve(__dirname, '../../dbx-graph-renderer')],
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
  },
});
