<template>
  <div
    class="border-b-2 border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 select-none border-l-[3px] transition-colors"
    :class="expanded && hasDetails ? 'border-blue-500 bg-blue-50/30' : 'border-l-transparent'"
    @click="emit('click')"
  >
    <!-- Entry row -->
    <div class="flex items-start gap-2 px-4 py-3 text-sm">
      <span class="h-5 flex items-center flex-shrink-0">
        <span
          class="w-[7px] h-[7px] rounded-full"
          :class="SEVERITY_DOT[severity]"
        />
      </span>
      <span
        class="flex-1 text-gray-900 leading-5 explanation"
        v-html="messageHtml"
      />
      <span class="text-gray-400 flex-shrink-0 tabular-nums text-[12px]">{{ diagnostic.location.line }}:{{ diagnostic.location.column }}</span>
    </div>

    <!-- Accordion content -->
    <div
      class="overflow-hidden transition-[max-height] duration-150 ease-in-out"
      :style="{ maxHeight: expanded && hasDetails ? '32rem' : '0' }"
    >
      <div class="px-4 pb-3 pt-0 ml-[23px]">
        <div
          v-if="explanationHtml"
          class="text-sm text-gray-800 leading-5 mt-1 explanation"
          v-html="explanationHtml"
        />

        <!-- Quick fix preview + selector -->
        <div
          v-if="diagnostic.quickFixes?.length"
          class="mt-3"
        >
          <!-- Fix selector + apply -->
          <div class="flex items-center gap-2">
            <DropdownSelect
              v-if="diagnostic.quickFixes.length > 1"
              v-model="selectedFixIndex"
              :options="fixTitles"
              :labels="fixLabels"
              :container="popperContainer"
              @click.stop
            />
            <button
              class="px-3 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors"
              @click.stop="applySelectedFix"
            >
              {{ diagnostic.quickFixes.length === 1 ? (selectedFix?.shortTitle ?? selectedFix?.title) : 'Apply fix' }}
            </button>
          </div>

          <!-- Before / After preview -->
          <div
            v-if="preview"
            class="flex gap-2 mt-2 text-[13px]"
            style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;"
          >
            <div
              class="flex-1 border-l-[3px] bg-gray-100 rounded-r px-3 py-2"
              style="border-color: #f87171;"
            >
              <div class="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">
                Now
              </div>
              <pre
                class="text-gray-700 whitespace-pre-wrap leading-5"
                v-html="preview.beforeHtml"
              />
            </div>
            <div
              class="flex-1 border-l-[3px] bg-gray-100 rounded-r px-3 py-2"
              style="border-color: #22c55e;"
            >
              <div class="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">
                Fixed
              </div>
              <pre
                class="text-gray-700 whitespace-pre-wrap leading-5"
                v-html="preview.afterHtml"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { SEVERITY_DOT } from '@/types';
import DropdownSelect from '@/components/common/DropdownSelect.vue';
import type { ParserDiagnostic, QuickFixAction, DiagnosticSeverity } from '@/types';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{
  diagnostic: ParserDiagnostic;
  severity: DiagnosticSeverity;
  expanded: boolean;
  source: string;
  popperContainer?: HTMLElement;
}>();

const emit = defineEmits<{
  'click': [];
  'apply-fix': [fix: QuickFixAction];
}>();

const selectedFixIndex = ref(0);

// Reset to preferred fix (or first) when expanded or fixes change
watch(() => props.expanded, (open) => {
  if (open && props.diagnostic.quickFixes?.length) {
    const preferred = props.diagnostic.quickFixes.findIndex((f) => f.isPreferred);
    selectedFixIndex.value = preferred >= 0 ? preferred : 0;
  }
});

const messageHtml = computed(() => renderMarkdown(props.diagnostic.message));
const hasDetails = computed(() => !!(props.diagnostic.explanation || props.diagnostic.quickFixes?.length));
const explanationHtml = computed(() => props.diagnostic.explanation ? renderMarkdown(props.diagnostic.explanation) : '');

const selectedFix = computed(() => props.diagnostic.quickFixes?.[selectedFixIndex.value]);
const fixTitles = computed(() => props.diagnostic.quickFixes?.map((f) => f.title) ?? []);
const fixLabels = computed(() => props.diagnostic.quickFixes?.map((f) => f.shortTitle ?? f.title) ?? []);

function esc (s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const preview = computed(() => {
  const fix = selectedFix.value;
  if (!fix?.edits.length) return null;

  const edit = fix.edits[0];
  const lineStart = props.source.lastIndexOf('\n', edit.start - 1) + 1;
  const lineEnd = props.source.indexOf('\n', edit.end);
  const end = lineEnd === -1 ? props.source.length : lineEnd;

  const pre = esc(props.source.slice(lineStart, edit.start));
  const removed = esc(props.source.slice(edit.start, edit.end));
  const added = esc(edit.newText);
  const post = esc(props.source.slice(edit.end, end));

  const beforeHtml = (pre + (removed ? `<mark class="bg-red-200 rounded-sm">${removed}</mark>` : '') + post).trim();
  const afterHtml = (pre + (added ? `<mark class="bg-green-200 rounded-sm">${added}</mark>` : '') + post).trim();

  return { beforeHtml, afterHtml };
});

function applySelectedFix () {
  const fix = selectedFix.value;
  if (fix) emit('apply-fix', fix);
}
</script>

<style scoped>
.explanation :deep(code) {
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.9em;
  color: #475569;
}
.explanation :deep(p) {
  margin: 0;
}
.explanation :deep(ul) {
  margin: 4px 0 0;
  padding-left: 16px;
  list-style: disc;
}
.explanation :deep(li) {
  margin: 2px 0;
}
</style>
