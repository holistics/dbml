<template>
  <div
    v-if="errors.length > 0 || warnings.length > 0 || infos.length > 0"
    class="absolute bottom-[22px] right-4 z-10"
  >
    <VDropdown
      :distance="8"
      placement="top-end"
      :arrow-padding="0"
      no-auto-focus
      @show="expanded = true"
      @hide="expanded = false"
    >
      <!-- Trigger badge -->
      <button
        class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium select-none cursor-pointer transition-colors"
        :class="badgeClass"
      >
        <PhProhibit
          v-if="errors.length > 0"
          class="w-4 h-4 flex-shrink-0"
        />
        <PhWarning
          v-else-if="warnings.length > 0"
          class="w-4 h-4 flex-shrink-0"
        />
        <PhInfo
          v-else
          class="w-4 h-4 flex-shrink-0"
        />
        <span>{{ totalCount }} {{ totalCount === 1 ? 'problem' : 'problems' }}</span>
      </button>

      <!-- Panel popover -->
      <template #popper>
        <div
          ref="panelContainerRef"
          class="w-[480px]"
          style="height: 60vh; min-height: 300px; max-height: 700px;"
        >
          <ProblemsPanel
            :errors="errors"
            :warnings="warnings"
            :infos="infos"
            :source="source"
            :popper-container="panelContainerRef"
            @diagnostic-jump="emit('diagnostic-jump', $event)"
            @apply-fix="emit('apply-fix', $event)"
          />
        </div>
      </template>
    </VDropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { PhProhibit, PhWarning, PhInfo } from '@phosphor-icons/vue';
import ProblemsPanel from '@/components/panes/editor/ProblemsPanel.vue';
import type { ParserDiagnostic, QuickFixAction } from '@/types';

const props = defineProps<{
  errors: readonly ParserDiagnostic[];
  warnings: readonly ParserDiagnostic[];
  infos: readonly ParserDiagnostic[];
  source: string;
}>();

const emit = defineEmits<{
  'diagnostic-jump': [diag: ParserDiagnostic];
  'apply-fix': [payload: { diagnostic: ParserDiagnostic; fix: QuickFixAction }];
}>();

const expanded = ref(false);
const panelContainerRef = ref<HTMLElement>();

const totalCount = computed(() => props.errors.length + props.warnings.length + props.infos.length);

const badgeClass = computed(() => {
  if (expanded.value) {
    if (props.errors.length > 0) return 'bg-red-500 text-white hover:bg-red-600';
    if (props.warnings.length > 0) return 'bg-yellow-400 text-white hover:bg-yellow-500';
    return 'bg-blue-500 text-white hover:bg-blue-600';
  }
  if (props.errors.length > 0) return 'bg-white/90 backdrop-blur text-red-600 hover:bg-red-50';
  if (props.warnings.length > 0) return 'bg-white/90 backdrop-blur text-yellow-600 hover:bg-yellow-50';
  return 'bg-white/90 backdrop-blur text-blue-600 hover:bg-blue-50';
});
</script>
