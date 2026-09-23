<template>
  <div
    class="flex items-start gap-2 px-3 py-1.5 text-xs cursor-pointer border-b border-gray-100 last:border-b-0"
    :class="styles.hover"
  >
    <span
      class="w-2 h-2 rounded-full flex-shrink-0 mt-1"
      :class="styles.dot"
    />
    <span
      class="text-gray-500 flex-shrink-0 tabular-nums"
    >({{ diagnostic.location.line }}:{{ diagnostic.location.column }})</span>
    <span
      class="flex-1 truncate"
      :class="styles.text"
    >{{ diagnostic.message }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ParserDiagnostic, DiagnosticSeverity } from '@/types';

const { severity } = defineProps<{
  diagnostic: ParserDiagnostic;
  severity: DiagnosticSeverity;
}>();

const SEVERITY_STYLES = {
  error: { dot: 'bg-red-500', text: 'text-red-700', hover: 'hover:bg-red-50' },
  warning: { dot: 'bg-yellow-400', text: 'text-yellow-700', hover: 'hover:bg-yellow-50' },
  info: { dot: 'bg-blue-500', text: 'text-blue-700', hover: 'hover:bg-blue-50' },
} as const;

const styles = computed(() => SEVERITY_STYLES[severity]);
</script>
