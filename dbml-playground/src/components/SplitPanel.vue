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
        class="w-2 cursor-col-resize select-none hover:bg-blue-100 transition-colors"
        @mousedown="startResize(index - 1, $event)"
      />
      <div class="overflow-hidden min-w-0">
        <slot :name="`panel-${index}`" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

// This component creates a resizable set of panes

const {
  minSize = 20, // The minimum size in fr allowed for a pane
} = defineProps<{
  minSize?: number;
}>();

const sizes = defineModel<number[]>({
  required: true,
});

const containerRef = ref<HTMLElement | null>(null);
const panelSizes = ref([...sizes.value]);

const gridTemplateColumns = computed(() =>
  // Interleave the panel sizes with the gap size (8px)
  panelSizes.value.map((s) => `${s}fr`).join(' 8px '),
);

function startResize (splitterIndex: number, e: MouseEvent) {
  e.preventDefault();

  const startX = e.clientX;
  const startSizes = [...panelSizes.value];
  const totalFr = startSizes.reduce((a, b) => a + b, 0);

  const container = containerRef.value;
  if (!container) return;
  const containerWidth = container.getBoundingClientRect().width;
  const gapCount = startSizes.length - 1;
  const totalGapPx = gapCount * 8;
  const availablePx = containerWidth - totalGapPx;

  const leftIndex = splitterIndex;
  const rightIndex = splitterIndex + 1;
  const pairFr = startSizes[leftIndex] + startSizes[rightIndex];
  const pairPx = (pairFr / totalFr) * availablePx;

  const onMove = (ev: MouseEvent) => {
    const diffX = ev.clientX - startX;
    const diffFr = (diffX / pairPx) * pairFr;
    const newLeft = Math.max(minSize, startSizes[leftIndex] + diffFr);
    const newSizes = [...startSizes];
    newSizes[leftIndex] = newLeft;
    newSizes[rightIndex] = pairFr - newLeft;
    panelSizes.value = newSizes;
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    sizes.value = [...panelSizes.value];
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
</script>
