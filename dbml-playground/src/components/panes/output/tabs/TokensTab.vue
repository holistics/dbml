<template>
  <div class="h-full flex flex-col text-[13px]">
    <div class="flex-shrink-0 px-3 py-1 border-b border-gray-200 bg-white text-gray-500 text-xs flex items-center justify-between">
      <span>{{ tokens.length }} tokens</span>
      <TabSettingsButton
        :show-decoration="showDecoration"
        @toggle-decoration="emit('toggle-decoration')"
      />
    </div>

    <div
      ref="scrollEl"
      class="flex-1 overflow-auto"
      style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
    >
      <div
        v-if="tokens.length === 0"
        class="text-center text-gray-400 py-8"
      >
        No tokens
      </div>
      <template
        v-for="(token, i) in tokens"
        :key="i"
      >
        <div
          :ref="(el) => setRowEl(i, el as HTMLElement | null)"
          class="flex items-center gap-2 px-3 py-[3px] cursor-pointer border-b border-gray-50"
          :class="[
            token.kind === SyntaxTokenKind.EOF
              ? 'bg-red-50/60 text-red-400 hover:bg-red-100/60'
              : activeIndex === i
                ? 'bg-yellow-100'
                : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/60 hover:bg-blue-50',
          ]"
          @click="onTokenClick(i, token)"
        >
          <span class="text-gray-400 w-6 text-right flex-shrink-0 text-xs">{{ i }}</span>

          <VTooltip
            placement="bottom"
            :distance="6"
            class="flex-shrink-0"
          >
            <component
              :is="getTokenIcon(token.kind).icon"
              class="w-3.5 h-3.5"
              :class="token.kind === SyntaxTokenKind.EOF ? 'text-red-400' : getTokenIcon(token.kind).color"
            />
            <template #popper>
              <span class="text-xs font-mono">{{ token.kind }}</span>
            </template>
          </VTooltip>

          <div class="flex-1 min-w-0 flex items-center">
            <VDropdown
              :disabled="token.kind === SyntaxTokenKind.EOF || !isTruncated(rawTexts[i])"
              placement="bottom-start"
              :distance="6"
              :arrow-padding="0"
              no-auto-focus
              class="min-w-0 max-w-full"
              @click.stop
            >
              <span
                class="truncate block"
                :class="token.kind === SyntaxTokenKind.EOF ? 'text-red-400 font-semibold' : 'text-green-700'"
              >{{ token.kind === SyntaxTokenKind.EOF ? '<EOF>' : truncateText(rawTexts[i]) }}</span>
              <template #popper>
                <pre
                  class="text-xs font-mono whitespace-pre-wrap break-all max-w-[320px] p-3 m-0"
                  :class="(rawTexts[i] ?? '').split('\n').length >= 5 ? 'max-h-[120px] overflow-y-auto' : ''"
                >{{ rawTexts[i] }}</pre>
              </template>
            </VDropdown>
          </div>
        </div>

        <div
          v-if="activeIndex === i && !detailCollapsed"
          :ref="(el) => setDetailEl(i, el as HTMLElement | null)"
          class="border-b border-gray-100 border-l-2 border-l-yellow-300 bg-yellow-50/40 px-3 py-1.5"
          style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
        >
          <div
            class="grid gap-y-0.5 text-xs items-baseline"
            style="grid-template-columns: max-content 1fr; column-gap: 1.5rem;"
          >
            <span class="text-gray-400 text-[10px] font-medium">kind</span>
            <span class="text-blue-600 font-mono break-all">{{ token.kind }}</span>
            <span class="text-gray-400 text-[10px] font-medium">value</span>
            <span class="text-green-700 font-mono break-all">{{ (rawTexts[i] ?? token.value) || '·' }}</span>
            <template
              v-for="section in detailSections(token)"
              :key="section.label"
            >
              <template v-if="section.tokens.length > 0">
                <span
                  class="text-[10px] font-medium"
                  :class="section.error ? 'text-red-400' : 'text-gray-400'"
                >{{ section.label }}</span>
                <span
                  class="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono"
                  :class="section.error ? 'text-red-600' : 'text-gray-600'"
                >
                  <template
                    v-for="(trivToken, si) in section.tokens"
                    :key="si"
                  >
                    <template v-if="trivToken.kind === '<space>'">
                      <span class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]"><PhArrowsHorizontal class="w-2.5 h-2.5" />{{ trivToken.value.length }}</span>
                    </template>
                    <PhKeyReturn
                      v-else-if="trivToken.kind === '<newline>'"
                      class="w-3 h-3 text-gray-400 flex-shrink-0"
                    />
                    <span
                      v-else-if="trivToken.kind === '<tab>'"
                      class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]"
                    >-></span>
                    <span
                      v-else-if="trivToken.kind === '<single-line-comment>' || trivToken.kind === '<multiline-comment>'"
                      class="text-gray-400 italic break-all"
                    >{{ trivToken.value }}</span>
                    <span
                      v-else
                      class="break-all"
                    >{{ trivToken.value }}</span>
                  </template>
                </span>
              </template>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref, watch, nextTick, onMounted, onUnmounted, inject, type Ref,
} from 'vue';
import * as monaco from 'monaco-editor';
import { toMonacoRange } from '@/utils/monaco';
import {
  PhKeyReturn,
  PhArrowsHorizontal,
} from '@phosphor-icons/vue';
import TabSettingsButton from './common/TabSettingsButton.vue';
import { SyntaxTokenKind } from '@dbml/parse';
import type { SyntaxToken } from '@dbml/parse';
import { getTokenIcon } from '@/components/panes/output/tokenIcons';

const emit = defineEmits<{ 'toggle-decoration': [] }>();

const {
  tokens,
  showDecoration = false,
} = defineProps<{
  tokens: SyntaxToken[];
  showDecoration?: boolean;
}>();

function detailSections (token: SyntaxToken) {
  return [
    {
      label: 'leading trivia',
      tokens: token.leadingTrivia,
      error: false,
    },
    {
      label: 'trailing trivia',
      tokens: token.trailingTrivia,
      error: false,
    },
    {
      label: 'leading errors',
      tokens: token.leadingInvalid,
      error: true,
    },
    {
      label: 'trailing errors',
      tokens: token.trailingInvalid,
      error: true,
    },
  ];
}

// Truncation
const PREVIEW_CHARS = 8;

function truncateText (text: string | undefined): string {
  if (!text) return '·';
  const flat = text.replace(/\r?\n/g, '↵');
  if (flat.length <= PREVIEW_CHARS * 2 + 1) return flat;
  return `${flat.slice(0, PREVIEW_CHARS)}…${flat.slice(-PREVIEW_CHARS)}`;
}

function isTruncated (text: string | undefined): boolean {
  if (!text) return false;
  const flat = text.replace(/\r?\n/g, '↵');
  return flat.length > PREVIEW_CHARS * 2 + 1;
}

// Editor integration
const dbmlEditorRef = inject<Ref<monaco.editor.IStandaloneCodeEditor | null>>('dbmlEditorRef');

const scrollEl = ref<HTMLElement | null>(null);
const rowEls: (HTMLElement | null)[] = [];
const detailEls: (HTMLElement | null)[] = [];

const rawTexts = ref<string[]>([]);

function updateRawTexts () {
  const model = dbmlEditorRef?.value?.getModel();
  if (!model) { rawTexts.value = tokens.map((t) => t.value); return; }
  rawTexts.value = tokens.map((t) => model.getValueInRange(toMonacoRange(t.startPos, t.endPos)));
}

const activeIndex = ref(-1);
const detailCollapsed = ref(false);

function setRowEl (i: number, el: HTMLElement | null) { rowEls[i] = el; }
function setDetailEl (i: number, el: HTMLElement | null) { detailEls[i] = el; }

watch(() => tokens.length, () => { rowEls.length = 0; detailEls.length = 0; });

function scrollToVisible (index: number) {
  nextTick(() => {
    const row = rowEls[index];
    const container = scrollEl.value;
    if (!row || !container) return;
    const bottomEl = detailEls[index] ?? row;
    const containerRect = container.getBoundingClientRect();
    const rowTop = row.getBoundingClientRect().top - containerRect.top + container.scrollTop;
    const bottomEdge = bottomEl.getBoundingClientRect().bottom - containerRect.top + container.scrollTop;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;
    if (rowTop < visibleTop) {
      container.scrollTo({
        top: rowTop,
        behavior: 'smooth',
      });
    } else if (bottomEdge > visibleBottom) {
      container.scrollTo({
        top: bottomEdge - container.clientHeight,
        behavior: 'smooth',
      });
    }
  });
}

function computeActiveIndex (line: number, column: number): number {
  let best = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const sl = t.startPos.line + 1;
    const sc = t.startPos.column + 1;
    if (sl > line || (sl === line && sc > column)) break;
    best = i;
  }
  return best;
}

function updateActiveIndex () {
  const editor = dbmlEditorRef?.value;
  const pos = editor?.getPosition();
  const next = pos ? computeActiveIndex(pos.lineNumber, pos.column) : -1;
  if (next !== activeIndex.value) {
    detailCollapsed.value = false;
  }
  activeIndex.value = next;
  if (activeIndex.value >= 0) scrollToVisible(activeIndex.value);
}

watch(() => tokens, () => {
  updateRawTexts();
  updateActiveIndex();
});

let cursorListener: monaco.IDisposable | null = null;

function attachCursorListener (editor: monaco.editor.IStandaloneCodeEditor) {
  cursorListener?.dispose();
  updateActiveIndex();
  updateRawTexts();
  cursorListener = editor.onDidChangeCursorPosition(() => updateActiveIndex());
}

onMounted(() => {
  const editor = dbmlEditorRef?.value;
  if (editor) attachCursorListener(editor);
});

watch(() => dbmlEditorRef?.value, (editor) => {
  if (editor) attachCursorListener(editor);
});

onUnmounted(() => {
  cursorListener?.dispose();
  cursorListener = null;
});

function onTokenClick (i: number, token: SyntaxToken) {
  const wasActive = activeIndex.value === i;
  detailCollapsed.value = wasActive ? !detailCollapsed.value : false;
  navigateTo(token);
  scrollToVisible(i);
}

function navigateTo (token: SyntaxToken) {
  const editor = dbmlEditorRef?.value;
  if (!editor) return;
  const range = toMonacoRange(token.startPos, token.endPos);
  editor.setSelection({
    selectionStartLineNumber: range.endLineNumber,
    selectionStartColumn: range.endColumn,
    positionLineNumber: range.startLineNumber,
    positionColumn: range.startColumn,
  });
  editor.revealRangeInCenter(range);
}

function scrollToToken (i: number) {
  scrollToVisible(i);
}

defineExpose({
  scrollToToken,
});
</script>
