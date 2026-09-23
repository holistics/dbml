<template>
  <div class="flex flex-col h-full bg-white rounded-xl overflow-hidden">
    <ProblemsPanelHeader
      v-model="activeFilter"
      :total="allDiagnostics.length"
      :error-count="errors.length"
      :warning-count="warnings.length"
      :info-count="infos.length"
    />

    <OverlayScrollbarsComponent
      class="flex-1"
      :options="{ scrollbars: { autoHide: 'move', autoHideDelay: 500 } }"
      defer
    >
      <div
        v-if="filteredDiagnostics.length === 0"
        class="flex items-center justify-center py-8 text-xs text-gray-400"
      >
        No problems
      </div>
      <template
        v-for="group in groupedDiagnostics"
        :key="group.category"
      >
        <div class="px-4 py-1.5 bg-slate-50 border-b border-gray-100 sticky top-0 z-10">
          <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{{ group.category }}</span>
        </div>
        <ProblemEntry
          v-for="item in group.items"
          :key="`${item.diagnostic.location.line}:${item.diagnostic.location.column}:${item.severity}:${item.diagnostic.message}`"
          :diagnostic="item.diagnostic"
          :severity="item.severity"
          :expanded="expandedDiag === item.diagnostic"
          :source="source"
          :popper-container="popperContainer"
          @click="onEntryClick(item)"
          @apply-fix="emit('apply-fix', { diagnostic: item.diagnostic, fix: $event })"
        />
      </template>
    </OverlayScrollbarsComponent>

    <!-- Footer -->
    <div class="flex items-center px-4 py-2 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500 bg-slate-100">
      <span>Cmd . for quick fix</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue';
import 'overlayscrollbars/overlayscrollbars.css';
import type {
  ParserDiagnostic, QuickFixAction, DiagnosticSeverity, DiagnosticFilter,
} from '@/types';
import ProblemsPanelHeader from '@/components/panes/editor/problems/ProblemsPanelHeader.vue';
import ProblemEntry from '@/components/panes/editor/problems/ProblemEntry.vue';

interface DiagnosticItem {
  diagnostic: ParserDiagnostic;
  severity: DiagnosticSeverity;
}

interface DiagnosticGroup {
  category: string;
  items: DiagnosticItem[];
}

const props = defineProps<{
  errors: readonly ParserDiagnostic[];
  warnings: readonly ParserDiagnostic[];
  infos: readonly ParserDiagnostic[];
  source: string;
  popperContainer?: HTMLElement;
}>();

const emit = defineEmits<{
  'diagnostic-jump': [diag: ParserDiagnostic];
  'apply-fix': [payload: { diagnostic: ParserDiagnostic; fix: QuickFixAction }];
}>();

const activeFilter = ref<DiagnosticFilter>('all');
const expandedDiag = ref<ParserDiagnostic | null>(null);
watch(activeFilter, () => { expandedDiag.value = null; });
watch([() => props.errors.length, () => props.warnings.length, () => props.infos.length], ([e, w, i]) => {
  if (activeFilter.value === 'error' && e === 0) activeFilter.value = 'all';
  if (activeFilter.value === 'warning' && w === 0) activeFilter.value = 'all';
  if (activeFilter.value === 'info' && i === 0) activeFilter.value = 'all';
});

const allDiagnostics = computed<DiagnosticItem[]>(() => {
  const items: DiagnosticItem[] = [];
  for (const d of props.errors) items.push({ diagnostic: d, severity: 'error' });
  for (const d of props.warnings) items.push({ diagnostic: d, severity: 'warning' });
  for (const d of props.infos) items.push({ diagnostic: d, severity: 'info' });
  items.sort((a, b) => a.diagnostic.location.line - b.diagnostic.location.line || a.diagnostic.location.column - b.diagnostic.location.column);
  return items;
});

const filteredDiagnostics = computed(() => {
  if (activeFilter.value === 'all') return allDiagnostics.value;
  return allDiagnostics.value.filter((d) => d.severity === activeFilter.value);
});

const groupedDiagnostics = computed<DiagnosticGroup[]>(() => {
  const map = new Map<string, DiagnosticItem[]>();
  for (const item of filteredDiagnostics.value) {
    const cat = item.diagnostic.category ?? 'other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
});

function onEntryClick (item: DiagnosticItem) {
  emit('diagnostic-jump', item.diagnostic);
  const hasDetails = !!(item.diagnostic.explanation || item.diagnostic.quickFixes?.length);
  if (hasDetails) {
    expandedDiag.value = item.diagnostic;
  }
}
</script>
