<template>
  <div
    ref="containerRef"
    class="grid h-full"
    :style="{ gridTemplateColumns }"
  >
    <template
      v-for="(_, index) in panels"
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

interface Props {
  sizes: number[];
  minSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  minSize: 5,
});

const containerRef = ref<HTMLElement | null>(null);
const panelSizes = ref([...props.sizes]);

const panels = computed(() => panelSizes.value);

const gridTemplateColumns = computed(() =>
  panelSizes.value.map((s) => `${s}fr`).join(' 8px '),
);

function startResize (splitterIndex: number, e: MouseEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startSizes = [...panelSizes.value];
  const total = startSizes.reduce((a, b) => a + b, 0);
  const container = containerRef.value;
  if (!container) return;
  const containerWidth = container.getBoundingClientRect().width;

  const leftIdx = splitterIndex;
  const rightIdx = splitterIndex + 1;

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX;
    const dFr = (dx / containerWidth) * total;
    const newSizes = [...startSizes];
    newSizes[leftIdx] = Math.max(props.minSize, startSizes[leftIdx] + dFr);
    newSizes[rightIdx] = Math.max(props.minSize, startSizes[rightIdx] - dFr);
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
