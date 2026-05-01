<template>
  <div
    ref="containerRef"
    class="grid h-full"
    :style="{ gridTemplateColumns }"
  >
    <template
      v-for="(_, index) in panelSizes"
      :key="index"
    >
      <div
        v-if="index > 0"
        class="w-2 cursor-col-resize select-none hover:bg-blue-200 transition-colors"
        @mousedown="startResize(index - 1, $event)"
      />
      <div class="overflow-hidden min-w-0">
        <slot :name="`panel-${index}`" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed,
} from 'vue';

// This component creates a resizable set of panes

const {
  sizes, // Initial size of the panels
  minSize = 5, // The minimum size in px allowed for a pane
} = defineProps<{
  sizes: number[];
  minSize?: number;
}>();

const containerRef = ref<HTMLElement | null>(null);
const panelSizes = ref([...sizes]);

const gridTemplateColumns = computed(() =>
  // Interleave the panel sizes with the gap size (8px)
  panelSizes.value.map((s) => `${s}fr`).join(' 8px '),
);

function startResize (splitterIndex: number, e: MouseEvent) {
  e.preventDefault();

  const startX = e.clientX;
  const startSizes = [...panelSizes.value]; // clone the panel size first to avoid mutation during calculation
  const total = startSizes.reduce((a, b) => a + b, 0);

  const container = containerRef.value;
  if (!container) return;
  const containerWidth = container.getBoundingClientRect().width;

  const leftIndex = splitterIndex;
  const rightIndex = splitterIndex + 1;

  const onMove = (ev: MouseEvent) => {
    const diffX = ev.clientX - startX;
    const diffFr = (diffX / containerWidth) * total;
    const newSizes = [...startSizes];
    newSizes[leftIndex] = Math.max(minSize, startSizes[leftIndex] + diffFr);
    newSizes[rightIndex] = Math.max(minSize, startSizes[rightIndex] - diffFr);
    panelSizes.value = newSizes;
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
</script>
