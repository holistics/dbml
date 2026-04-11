<template>
  <div class="h-full flex flex-col text-[13px]">
    <div class="flex-shrink-0 flex items-center justify-between px-3 py-1 border-b border-gray-200 bg-white text-gray-500 text-xs">
      <span>{{ tokens.length }} tokens</span>
      <label class="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          v-model="showDecorations"
          type="checkbox"
          class="w-3 h-3 accent-blue-500"
        >
        Highlight in editor
      </label>
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
      <div
        v-for="(tok, i) in tokens"
        :key="i"
        :ref="(el) => setRowEl(i, el as HTMLElement | null)"
        class="flex items-center gap-3 px-3 py-[3px] cursor-pointer border-b border-gray-50"
        :class="activeIndex === i ? 'bg-yellow-100' : (i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/60 hover:bg-blue-50')"
        @click="navigateTo(tok)"
      >
        <span class="text-gray-400 w-7 text-right flex-shrink-0 text-xs">{{ i }}</span>
        <span class="text-blue-500 min-w-[80px] flex-shrink-0 hover:underline">{{ tok.kind }}</span>
        <span class="text-green-700 truncate flex-1">{{ tok.value !== '' ? tok.value : '·' }}</span>
        <span class="text-gray-400 text-xs flex-shrink-0">{{ tok.startPos.line + 1 }}:{{ tok.startPos.column + 1 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, inject, onUnmounted, type Ref } from 'vue';
import * as monaco from 'monaco-editor';
import type { SyntaxToken } from '@dbml/parse';

interface Props {
  tokens: SyntaxToken[];
}

const props = defineProps<Props>();

const getEditor = inject<() => monaco.editor.IStandaloneCodeEditor | null>('getDbmlEditor');
const cursorPos = inject<Ref<{ line: number; column: number }>>('dbmlCursorPos');

const scrollEl = ref<HTMLElement | null>(null);
const rowEls: HTMLElement[] = [];
const showDecorations = ref(true);
let decorations: monaco.editor.IEditorDecorationsCollection | null = null;

function setRowEl (i: number, el: HTMLElement | null) {
  if (el) rowEls[i] = el;
}

// Clear stale refs when tokens array is replaced
watch(() => props.tokens.length, () => { rowEls.length = 0; });

const activeIndex = computed(() => {
  if (!cursorPos?.value || props.tokens.length === 0) return -1;
  const { line, column } = cursorPos.value;
  let best = -1;
  for (let i = 0; i < props.tokens.length; i++) {
    const t = props.tokens[i];
    const sl = t.startPos.line + 1, sc = t.startPos.column + 1;
    const el = t.endPos.line + 1, ec = t.endPos.column + 1;
    const afterStart = sl < line || (sl === line && sc <= column);
    const beforeEnd = el > line || (el === line && ec >= column);
    if (afterStart && beforeEnd) { best = i; break; }
    if (afterStart) best = i;
  }
  return best;
});

watch(activeIndex, (i) => {
  if (i < 0) return;
  rowEls[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

function updateDecorations () {
  const editor = getEditor?.();
  if (!editor) return;
  decorations?.clear();
  if (!showDecorations.value || props.tokens.length === 0) return;
  decorations = editor.createDecorationsCollection(
    props.tokens.map((t) => ({
      range: new monaco.Range(
        t.startPos.line + 1, t.startPos.column + 1,
        t.endPos.line + 1, t.endPos.column + 2,
      ),
      options: { inlineClassName: 'token-box-decoration' },
    })),
  );
}

watch(() => props.tokens, updateDecorations, { immediate: true });
watch(showDecorations, updateDecorations);
onUnmounted(() => { decorations?.clear(); decorations = null; });

function navigateTo (tok: SyntaxToken) {
  const editor = getEditor?.();
  if (!editor) return;
  const range = {
    startLineNumber: tok.startPos.line + 1,
    startColumn: tok.startPos.column + 1,
    endLineNumber: tok.endPos.line + 1,
    endColumn: tok.endPos.column + 2,
  };
  editor.setSelection(range);
  editor.revealRangeInCenter(range);
}

function scrollToToken (i: number) {
  rowEls[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

defineExpose({ scrollToToken });
</script>

<style>
.token-box-decoration {
  outline: 1px solid rgba(99, 102, 241, 0.3);
  outline-offset: -1px;
  border-radius: 2px;
  background: rgba(99, 102, 241, 0.05);
}
</style>
