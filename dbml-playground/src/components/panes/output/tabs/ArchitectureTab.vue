<script setup lang="ts">
/**
 * The architecture dialect, drawn.
 *
 * Everything on the left of the screen is unchanged: DBML's lexer, DBML's parser, DBML's file
 * graph, the same Monaco model and the same diagnostics plumbing. What differs is the element
 * vocabulary and two grammar switches, and this tab is where that difference becomes a picture.
 *
 * The renderer is `@atlas/arch-renderer`, which knows nothing about DBML or about any parser: it
 * takes a NetworkModel and draws it. That is why this file is thirty lines of wiring rather
 * than a port.
 *
 * IT IS THE ONE CLOSED DEPENDENCY IN THIS REPOSITORY, and it is confined to this file and to
 * the alias in `vite.config.ts`. `@dbml/arch` owns the model and the icon names and takes no
 * dependency on it, so everything the language does works without the drawing; what stops
 * without it is this tab. The playground is not published, which is what makes that bearable
 * until the renderer has a home of its own.
 */
import {
  onBeforeUnmount, onMounted, ref, shallowRef, watch,
} from 'vue';
import { NetworkView, type SavedLayout } from '@atlas/arch-renderer';
import '@atlas/arch-renderer/styles.css';
import { useArchStore } from '@/stores/archStore';
import { useProjectStore } from '@/stores/projectStore';

const arch = useArchStore();
const project = useProjectStore();

const host = ref<HTMLElement | null>(null);
const view = shallowRef<NetworkView | null>(null);
const engine = ref('placing');
const selected = ref<string | null>(null);
const moved = ref(0);

/**
 * Positions live beside the files, never in them.
 *
 * There is no x and no y in the language, and a drag must not become a source edit. In an
 * editor this is a sidecar file; a browser tab has nowhere to write one, so the same document
 * goes to localStorage under the entry point's name. The shape is identical either way, so what
 * is copied out of here can be committed next to the source.
 */
const layoutKey = () => `playground:archLayout:${project.currentFile}`;

function readLayout (): SavedLayout | null {
  try {
    const raw = localStorage.getItem(layoutKey());
    return raw ? (JSON.parse(raw) as SavedLayout) : null;
  } catch {
    return null; // a private window, or storage turned off: a drawing with no saved positions
  }
}

function writeLayout (layout: SavedLayout): void {
  try {
    if (!layout.positions.length) localStorage.removeItem(layoutKey());
    else localStorage.setItem(layoutKey(), JSON.stringify(layout));
  } catch {
    // nothing worth interrupting the drawing over
  }
}

/**
 * How many saved positions this drawing is actually using.
 *
 * Not how many are stored. A document that has been edited since the last drag can hold
 * positions for elements that no longer exist, and a button offering to reset three positions
 * that are not on screen is a button that lies.
 */
function countApplied (): void {
  moved.value = view.value?.overrides ?? 0;
}

function draw (): void {
  if (!view.value || !arch.model) return;
  void view.value.setModel(arch.model).then(countApplied);
}

onMounted(() => {
  view.value = new NetworkView(host.value!, {
    onSelect: (id) => { selected.value = id; },
    onEngine: (which) => { engine.value = which === 'elk' ? 'elkjs layered' : 'grid fallback'; },
    onLayout: (layout) => {
      moved.value = layout.positions.length;
      writeLayout(layout);
    },
  });
  void view.value.setLayout(readLayout());
  draw();
});

// a different file is a different drawing, so it keeps its own positions
watch(() => project.currentFile, () => {
  void view.value?.setLayout(readLayout()).then(countApplied);
});

onBeforeUnmount(() => view.value?.destroy());

watch(() => arch.model, draw);

function resetPositions (): void {
  void view.value?.resetLayout();
}

</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex h-[29px] flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-3 text-xs text-gray-600">
      <span>{{ arch.counts.nodes }} nodes · {{ arch.counts.groups }} groups · {{ arch.counts.links }} links</span>
      <span class="text-gray-400">{{ engine }}</span>
      <span
        v-if="arch.errors.length"
        class="text-red-600"
      >{{ arch.errors.length }} errors</span>
      <span
        v-else-if="arch.warnings.length"
        class="text-amber-600"
      >{{ arch.warnings.length }} warnings</span>
      <span
        v-if="selected"
        class="text-gray-500"
      >{{ selected }}</span>
      <span class="flex-1" />
      <button
        v-if="moved"
        type="button"
        class="rounded border border-gray-300 px-2 py-0.5 hover:bg-white"
        @click="resetPositions"
      >
        reset positions ({{ moved }})
      </button>
      <button
        type="button"
        class="rounded border border-gray-300 px-2 py-0.5 hover:bg-white"
        @click="view?.relayout()"
      >
        re-layout
      </button>
      <button
        type="button"
        class="rounded border border-gray-300 px-2 py-0.5 hover:bg-white"
        @click="view?.fit()"
      >
        fit
      </button>
    </div>

    <ul
      v-if="arch.errors.length"
      class="flex-shrink-0 border-b border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700"
    >
      <li
        v-for="(d, i) in arch.errors.slice(0, 4)"
        :key="i"
      >
        <span class="font-mono text-red-400">{{ d.file }}:{{ d.line }}:{{ d.column }}</span>
        {{ d.message }}
      </li>
    </ul>

    <div
      ref="host"
      class="min-h-0 flex-1 bg-white"
    />

    <p class="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-3 py-1 text-[11px] text-gray-500">
      drag to place, and it is remembered · wheel scrolls · ⌘/ctrl + wheel zooms · middle or ⌘/space + drag moves the view · click lights what it touches · esc clears
    </p>
  </div>
</template>
