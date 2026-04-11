<template>
  <div
    class="h-full overflow-auto text-[13px]"
    style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
  >
    <div
      v-if="groups.length === 0"
      class="flex flex-col items-center py-10 text-gray-400"
    >
      <CheckCircleIcon class="w-8 h-8 mb-2 text-blue-400" />
      <p class="text-sm">No diagnostics</p>
    </div>

    <div
      v-for="group in groups"
      :key="group.file"
    >
      <!-- File header -->
      <div
        class="flex items-center gap-2 px-3 py-1 bg-gray-100 border-b border-gray-200 cursor-pointer hover:bg-gray-200 select-none sticky top-0 z-10"
        @click="toggle(group.file)"
      >
        <ChevronRightIcon
          class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
          :class="expanded.has(group.file) ? 'rotate-90' : ''"
        />
        <span class="text-gray-700 font-medium truncate flex-1">{{ group.file }}</span>
        <span
          v-if="group.errors.length"
          class="text-red-500 text-xs"
        >{{ group.errors.length }}E</span>
        <span
          v-if="group.warnings.length"
          class="text-yellow-500 text-xs"
        >{{ group.warnings.length }}W</span>
      </div>

      <!-- Diagnostics rows -->
      <div v-if="expanded.has(group.file)">
        <div
          v-for="(d, i) in group.errors"
          :key="`e-${i}`"
          class="flex items-start gap-2 px-3 py-[3px] border-b border-gray-50 hover:bg-red-50 cursor-pointer"
          :style="{ paddingLeft: '28px' }"
          @click="emit('position-click', d)"
        >
          <ExclamationCircleIcon class="w-3.5 h-3.5 flex-shrink-0 text-red-500 mt-[1px]" />
          <span class="text-red-700 flex-1">{{ d.message }}</span>
          <span class="text-gray-400 flex-shrink-0">{{ d.location.line }}:{{ d.location.column }}</span>
        </div>
        <div
          v-for="(d, i) in group.warnings"
          :key="`w-${i}`"
          class="flex items-start gap-2 px-3 py-[3px] border-b border-gray-50 hover:bg-yellow-50 cursor-pointer"
          :style="{ paddingLeft: '28px' }"
          @click="emit('position-click', d)"
        >
          <ExclamationTriangleIcon class="w-3.5 h-3.5 flex-shrink-0 text-yellow-500 mt-[1px]" />
          <span class="text-yellow-700 flex-1">{{ d.message }}</span>
          <span class="text-gray-400 flex-shrink-0">{{ d.location.line }}:{{ d.location.column }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import type { ParserError } from '@/types';

interface Props {
  errors: readonly ParserError[];
  warnings: readonly ParserError[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'position-click': [diag: ParserError];
}>();

interface DiagGroup {
  file: string;
  errors: ParserError[];
  warnings: ParserError[];
}

const groups = computed(() => {
  const map = new Map<string, DiagGroup>();
  const getOrCreate = (file: string) => {
    if (!map.has(file)) map.set(file, { file, errors: [], warnings: [] });
    return map.get(file)!;
  };
  for (const e of props.errors) getOrCreate('main.dbml').errors.push(e as ParserError);
  for (const w of props.warnings) getOrCreate('main.dbml').warnings.push(w as ParserError);
  return [...map.values()];
});

const expanded = ref<Set<string>>(new Set());

// Auto-expand all groups when they first appear
watch(groups, (gs) => {
  for (const g of gs) expanded.value.add(g.file);
}, { immediate: true });

function toggle (file: string) {
  if (expanded.value.has(file)) expanded.value.delete(file);
  else expanded.value.add(file);
}
</script>
