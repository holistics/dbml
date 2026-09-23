<template>
  <div
    class="h-full overflow-auto text-[13px]"
    style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
  >
    <div
      v-if="groups.length === 0"
      class="flex flex-col items-center py-10 text-gray-400"
    >
      <PhCheckCircle class="w-8 h-8 mb-2 text-blue-400" />
      <p class="text-sm">
        No diagnostics
      </p>
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
        <PhCaretRight
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
        <span
          v-if="group.infos.length"
          class="text-blue-500 text-xs"
        >{{ group.infos.length }}I</span>
      </div>

      <!-- Diagnostics rows -->
      <div
        v-if="expanded.has(group.file)"
        class="pl-[28px]"
      >
        <DiagnosticEntry
          v-for="(d, i) in group.errors"
          :key="`e-${i}`"
          :diagnostic="d"
          severity="error"
          @click="emit('position-click', d)"
        />
        <DiagnosticEntry
          v-for="(d, i) in group.warnings"
          :key="`w-${i}`"
          :diagnostic="d"
          severity="warning"
          @click="emit('position-click', d)"
        />
        <DiagnosticEntry
          v-for="(d, i) in group.infos"
          :key="`i-${i}`"
          :diagnostic="d"
          severity="info"
          @click="emit('position-click', d)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PhCheckCircle, PhCaretRight } from '@phosphor-icons/vue';
import DiagnosticEntry from '@/components/common/DiagnosticEntry.vue';
import type { ParserDiagnostic } from '@/types';

const {
  errors,
  warnings,
  infos,
  currentFile,
} = defineProps<{
  errors: readonly ParserDiagnostic[];
  warnings: readonly ParserDiagnostic[];
  infos: readonly ParserDiagnostic[];
  currentFile: string;
}>();
const emit = defineEmits<{
  'position-click': [diag: ParserDiagnostic];
}>();

interface DiagGroup {
  file: string;
  errors: ParserDiagnostic[];
  warnings: ParserDiagnostic[];
  infos: ParserDiagnostic[];
}

const groups = computed(() => {
  const map = new Map<string, DiagGroup>();
  const getOrCreate = (file: string) => {
    if (!map.has(file)) map.set(file, {
      file,
      errors: [],
      warnings: [],
      infos: [],
    });
    return map.get(file)!;
  };
  for (const e of errors) getOrCreate(currentFile).errors.push(e as ParserDiagnostic);
  for (const w of warnings) getOrCreate(currentFile).warnings.push(w as ParserDiagnostic);
  for (const i of infos) getOrCreate(currentFile).infos.push(i as ParserDiagnostic);
  return [...map.values()];
});

const expanded = ref<Set<string>>(new Set());

// Auto-expand all groups when they first appear
watch(groups, (gs) => {
  for (const g of gs) expanded.value.add(g.file);
}, {
  immediate: true,
});

function toggle (file: string) {
  if (expanded.value.has(file)) expanded.value.delete(file);
  else expanded.value.add(file);
}
</script>
