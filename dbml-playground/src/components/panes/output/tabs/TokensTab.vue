<template>
  <div class="h-full flex flex-col text-[13px]">
    <div class="flex-shrink-0 px-3 py-1 border-b border-gray-200 bg-white text-gray-500 text-xs flex items-center justify-between">
      <span>{{ tokens.length }} tokens</span>
      <TabSettingsButton :show-decor="showDecor" @toggle-decor="emit('toggle-decor')" />
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
        v-for="(tok, i) in tokens"
        :key="i"
      >
        <div
          :ref="(el) => setRowEl(i, el as HTMLElement | null)"
          class="flex items-center gap-2 px-3 py-[3px] cursor-pointer border-b border-gray-50"
          :class="[
            tok.kind === '<eof>'
              ? 'bg-red-50/60 text-red-400 hover:bg-red-100/60'
              : activeIndex === i
                ? 'bg-yellow-100'
                : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/60 hover:bg-blue-50',
          ]"
          @click="onTokenClick(i, tok)"
        >
          <span class="text-gray-400 w-6 text-right flex-shrink-0 text-xs">{{ i }}</span>

          <VTooltip placement="bottom" :distance="6" class="flex-shrink-0">
            <component
              :is="tokenIcon(tok.kind).icon"
              class="w-3.5 h-3.5"
              :class="tok.kind === '<eof>' ? 'text-red-400' : tokenIcon(tok.kind).color"
            />
            <template #popper>
              <span class="text-xs font-mono">{{ tok.kind }}</span>
            </template>
          </VTooltip>

          <div class="flex-1 min-w-0 flex items-center">
            <VDropdown
              :disabled="tok.kind === '<eof>' || !isTruncated(rawTexts[i])"
              placement="bottom-start"
              :distance="6"
              :arrow-padding="0"
              no-auto-focus
              class="min-w-0 max-w-full"
              @click.stop
            >
              <span
                class="truncate block"
                :class="tok.kind === '<eof>' ? 'text-red-400 font-semibold' : 'text-green-700'"
              >{{ tok.kind === '<eof>' ? '<EOF>' : truncateText(rawTexts[i]) }}</span>
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
          class="border-b border-gray-100 border-l-2 border-l-yellow-300 bg-yellow-50/40 px-3 py-1.5"
          style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
        >
          <div class="grid gap-y-0.5 text-xs items-baseline" style="grid-template-columns: max-content 1fr; column-gap: 1.5rem;">
            <span class="text-gray-400 text-[10px] font-medium">kind</span>
            <span class="text-blue-600 font-mono break-all">{{ tok.kind }}</span>
            <span class="text-gray-400 text-[10px] font-medium">value</span>
            <span class="text-green-700 font-mono break-all">{{ (rawTexts[i] ?? tok.value) || '·' }}</span>
            <template v-for="section in detailSections(tok)" :key="section.label">
              <template v-if="section.tokens.length > 0">
                <span class="text-[10px] font-medium" :class="section.error ? 'text-red-400' : 'text-gray-400'">{{ section.label }}</span>
                <span class="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono" :class="section.error ? 'text-red-600' : 'text-gray-600'">
                  <template v-for="(trivTok, si) in section.tokens" :key="si">
                    <template v-if="trivTok.kind === '<space>'">
                      <span class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]"><PhArrowsHorizontal class="w-2.5 h-2.5" />{{ trivTok.value.length }}</span>
                    </template>
                    <PhKeyReturn v-else-if="trivTok.kind === '<newline>'" class="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span v-else-if="trivTok.kind === '<tab>'" class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]">→</span>
                    <span v-else-if="trivTok.kind === '<single-line-comment>' || trivTok.kind === '<multiline-comment>'" class="text-gray-400 italic break-all">{{ trivTok.value }}</span>
                    <span v-else class="break-all">{{ trivTok.value }}</span>
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
  ref, watch, onMounted, onUnmounted, inject, type Ref, type Component,
} from 'vue';
import * as monaco from 'monaco-editor';
import {
  PhIdentificationCard,
  PhQuotes,
  PhTextAa,
  PhNumberSquareOne,
  PhPalette,
  PhLightning,
  PhBracketsCurly,
  PhBracketsRound,
  PhBracketsSquare,
  PhBracketsAngle,
  PhStar,
  PhFlagCheckered,
  PhKeyReturn,
  PhArrowsHorizontal,
  PhMathOperations,
  PhArticle,
  PhAsterisk,
  PhQuestion,
} from '@phosphor-icons/vue';
import TabSettingsButton from './TabSettingsButton.vue';
import type {
  SyntaxToken,
} from '@dbml/parse';

interface Props {
  tokens: SyntaxToken[];
  showDecor?: boolean;
}

const emit = defineEmits<{ 'toggle-decor': [] }>();

const props = defineProps<Props>();

// --- Token kind → icon + color ---
interface TokenIconInfo { icon: Component; color: string }

const TOKEN_ICON_MAP: Record<string, TokenIconInfo> = {
  '<identifier>':           { icon: PhIdentificationCard, color: 'text-blue-500' },
  '<variable>':             { icon: PhQuotes,             color: 'text-violet-500' },
  '<string>':               { icon: PhTextAa,             color: 'text-green-600' },
  '<number>':               { icon: PhNumberSquareOne,    color: 'text-amber-500' },
  '<color>':                { icon: PhPalette,            color: 'text-pink-500' },
  '<function-expression>':  { icon: PhLightning,          color: 'text-orange-500' },
  '<op>':                   { icon: PhMathOperations,     color: 'text-red-500' },
  '<lparen>':               { icon: PhBracketsRound,      color: 'text-cyan-500' },
  '<rparen>':               { icon: PhBracketsRound,      color: 'text-cyan-500' },
  '<lbrace>':               { icon: PhBracketsCurly,      color: 'text-cyan-500' },
  '<rbrace>':               { icon: PhBracketsCurly,      color: 'text-cyan-500' },
  '<lbracket>':             { icon: PhBracketsSquare,     color: 'text-cyan-500' },
  '<rbracket>':             { icon: PhBracketsSquare,     color: 'text-cyan-500' },
  '<langle>':               { icon: PhBracketsAngle,      color: 'text-cyan-500' },
  '<rangle>':               { icon: PhBracketsAngle,      color: 'text-cyan-500' },
  '<comma>':                { icon: PhAsterisk,           color: 'text-gray-400' },
  '<semicolon>':            { icon: PhAsterisk,           color: 'text-gray-400' },
  '<colon>':                { icon: PhAsterisk,           color: 'text-gray-400' },
  '<space>':                { icon: PhArrowsHorizontal,   color: 'text-gray-300' },
  '<tab>':                  { icon: PhArrowsHorizontal,   color: 'text-gray-300' },
  '<newline>':              { icon: PhKeyReturn,          color: 'text-gray-300' },
  '<single-line-comment>':  { icon: PhArticle,            color: 'text-gray-400' },
  '<multiline-comment>':    { icon: PhArticle,            color: 'text-gray-400' },
  '<wildcard>':             { icon: PhStar,               color: 'text-yellow-500' },
  '<eof>':                  { icon: PhFlagCheckered,      color: 'text-red-400' },
};
const FALLBACK_ICON: TokenIconInfo = { icon: PhQuestion, color: 'text-gray-400' };

function tokenIcon (kind: string): TokenIconInfo {
  return TOKEN_ICON_MAP[kind] ?? FALLBACK_ICON;
}

function detailSections (tok: SyntaxToken) {
  return [
    { label: 'leading trivia',  tokens: tok.leadingTrivia,   error: false },
    { label: 'trailing trivia', tokens: tok.trailingTrivia,  error: false },
    { label: 'leading errors',  tokens: tok.leadingInvalid,  error: true },
    { label: 'trailing errors', tokens: tok.trailingInvalid, error: true },
  ];
}

// --- Truncation ---
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

// --- Editor integration ---
const getEditor = inject<() => monaco.editor.IStandaloneCodeEditor | null>('getDbmlEditor');
const dbmlEditorRef = inject<Ref<monaco.editor.IStandaloneCodeEditor | null>>('dbmlEditorRef');

const scrollEl = ref<HTMLElement | null>(null);
const rowEls: HTMLElement[] = [];

const rawTexts = ref<string[]>([]);

function updateRawTexts () {
  const model = getEditor?.()?.getModel();
  if (!model) { rawTexts.value = props.tokens.map((t) => t.value); return; }
  rawTexts.value = props.tokens.map((t) => model.getValueInRange(new monaco.Range(
    t.startPos.line + 1, t.startPos.column + 1,
    t.endPos.line + 1, t.endPos.column + 1,
  )));
}

const activeIndex = ref(-1);
const detailCollapsed = ref(false);

function setRowEl (i: number, el: HTMLElement | null) {
  if (el) rowEls[i] = el;
}

watch(() => props.tokens.length, () => { rowEls.length = 0; });

function computeActiveIndex (line: number, column: number): number {
  let best = -1;
  for (let i = 0; i < props.tokens.length; i++) {
    const t = props.tokens[i];
    const sl = t.startPos.line + 1;
    const sc = t.startPos.column + 1;
    if (sl > line || (sl === line && sc > column)) break;
    best = i;
  }
  return best;
}

function updateActiveIndex () {
  const editor = getEditor?.();
  const pos = editor?.getPosition();
  const next = pos ? computeActiveIndex(pos.lineNumber, pos.column) : -1;
  if (next !== activeIndex.value) {
    detailCollapsed.value = false;
  }
  activeIndex.value = next;
  if (activeIndex.value >= 0) {
    rowEls[activeIndex.value]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

watch(() => props.tokens, () => {
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
  const editor = getEditor?.();
  if (editor) attachCursorListener(editor);
});

watch(() => dbmlEditorRef?.value, (editor) => {
  if (editor) attachCursorListener(editor);
});

onUnmounted(() => {
  cursorListener?.dispose();
  cursorListener = null;
});

function onTokenClick (i: number, tok: SyntaxToken) {
  if (activeIndex.value === i) {
    detailCollapsed.value = !detailCollapsed.value;
  } else {
    detailCollapsed.value = false;
    navigateTo(tok);
  }
}

function navigateTo (tok: SyntaxToken) {
  const editor = getEditor?.();
  if (!editor) return;
  const range = {
    startLineNumber: tok.startPos.line + 1,
    startColumn: tok.startPos.column + 1,
    endLineNumber: tok.endPos.line + 1,
    endColumn: tok.endPos.column + 1,
  };
  editor.setSelection({
    selectionStartLineNumber: tok.endPos.line + 1,
    selectionStartColumn: tok.endPos.column + 1,
    positionLineNumber: tok.startPos.line + 1,
    positionColumn: tok.startPos.column + 1,
  });
  editor.revealRangeInCenter(range);
}

function scrollToToken (i: number) {
  rowEls[i]?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  });
}

defineExpose({
  scrollToToken,
});
</script>
