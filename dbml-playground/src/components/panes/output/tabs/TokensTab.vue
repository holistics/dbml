<template>
  <div class="h-full flex flex-col text-[13px]">
    <div class="flex-shrink-0 px-3 py-1 border-b border-gray-200 bg-white text-gray-500 text-xs">
      <span>{{ tokens.length }} tokens</span>
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

        <!-- Kind icon with tooltip -->
        <VTooltip placement="bottom" :distance="6" class="flex-shrink-0">
          <component
            :is="tokenIcon(tok.kind).icon"
            class="w-3.5 h-3.5"
            :class="tokenIcon(tok.kind).color"
          />
          <template #popper>
            <span class="text-xs font-mono">{{ tok.kind }}</span>
          </template>
        </VTooltip>

        <!-- Truncated value; dropdown shows full content -->
        <div class="flex-1 min-w-0 flex items-center">
          <VDropdown
            :disabled="!rawTexts[i]"
            placement="bottom-start"
            :distance="6"
            :arrow-padding="0"
            no-auto-focus
            class="min-w-0 max-w-full"
            @click.stop
          >
            <span class="text-green-700 truncate block">{{ truncateText(rawTexts[i]) }}</span>
            <template #popper>
              <pre
                class="text-xs font-mono whitespace-pre-wrap break-all max-w-[320px] p-3 m-0"
                :class="(rawTexts[i] ?? '').split('\n').length >= 5 ? 'max-h-[120px] overflow-y-auto' : ''"
              >{{ rawTexts[i] }}</pre>
            </template>
          </VDropdown>
        </div>

        <span class="text-gray-400 text-xs flex-shrink-0">{{ tok.startPos.line + 1 }}:{{ tok.startPos.column + 1 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref, watch, onMounted, onUnmounted, inject, type Ref, type Component,
} from 'vue';
import * as monaco from 'monaco-editor';
import {
  PhTextT,
  PhAt,
  PhQuotes,
  PhHash,
  PhPalette,
  PhLightning,
  PhBracketsCurly,
  PhBracketsRound,
  PhBracketsSquare,
  PhBracketsAngle,
  PhStar,
  PhFlag,
  PhKeyReturn,
  PhArrowsHorizontal,
  PhMathOperations,
  PhArticle,
  PhAsterisk,
  PhQuestion,
} from '@phosphor-icons/vue';
import type {
  SyntaxToken,
} from '@dbml/parse';

interface Props {
  tokens: SyntaxToken[];
}

const props = defineProps<Props>();

// --- Token kind → icon + color ---
interface TokenIconInfo { icon: Component; color: string }

const TOKEN_ICON_MAP: Record<string, TokenIconInfo> = {
  '<identifier>':           { icon: PhTextT,           color: 'text-blue-500' },
  '<variable>':             { icon: PhAt,              color: 'text-violet-500' },
  '<string>':               { icon: PhQuotes,          color: 'text-green-600' },
  '<number>':               { icon: PhHash,            color: 'text-amber-500' },
  '<color>':                { icon: PhPalette,         color: 'text-pink-500' },
  '<function-expression>':  { icon: PhLightning,       color: 'text-orange-500' },
  '<op>':                   { icon: PhMathOperations,  color: 'text-red-500' },
  '<lparen>':               { icon: PhBracketsRound,   color: 'text-cyan-500' },
  '<rparen>':               { icon: PhBracketsRound,   color: 'text-cyan-500' },
  '<lbrace>':               { icon: PhBracketsCurly,   color: 'text-cyan-500' },
  '<rbrace>':               { icon: PhBracketsCurly,   color: 'text-cyan-500' },
  '<lbracket>':             { icon: PhBracketsSquare,  color: 'text-cyan-500' },
  '<rbracket>':             { icon: PhBracketsSquare,  color: 'text-cyan-500' },
  '<langle>':               { icon: PhBracketsAngle,   color: 'text-cyan-500' },
  '<rangle>':               { icon: PhBracketsAngle,   color: 'text-cyan-500' },
  '<comma>':                { icon: PhAsterisk,        color: 'text-gray-400' },
  '<semicolon>':            { icon: PhAsterisk,        color: 'text-gray-400' },
  '<colon>':                { icon: PhAsterisk,        color: 'text-gray-400' },
  '<space>':                { icon: PhArrowsHorizontal, color: 'text-gray-300' },
  '<tab>':                  { icon: PhArrowsHorizontal, color: 'text-gray-300' },
  '<newline>':              { icon: PhKeyReturn,       color: 'text-gray-300' },
  '<single-line-comment>':  { icon: PhArticle,         color: 'text-gray-400' },
  '<multiline-comment>':    { icon: PhArticle,         color: 'text-gray-400' },
  '<wildcard>':             { icon: PhStar,            color: 'text-yellow-500' },
  '<eof>':                  { icon: PhFlag,            color: 'text-red-400' },
};
const FALLBACK_ICON: TokenIconInfo = { icon: PhQuestion, color: 'text-gray-400' };

function tokenIcon (kind: string): TokenIconInfo {
  return TOKEN_ICON_MAP[kind] ?? FALLBACK_ICON;
}

// --- Truncation ---
const PREVIEW_CHARS = 8;

function truncateText (text: string | undefined): string {
  if (!text) return '·';
  const flat = text.replace(/\r?\n/g, '↵');
  if (flat.length <= PREVIEW_CHARS * 2 + 1) return flat;
  return `${flat.slice(0, PREVIEW_CHARS)}…${flat.slice(-PREVIEW_CHARS)}`;
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

watch(() => props.tokens, updateRawTexts);

const activeIndex = ref(-1);

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
  activeIndex.value = pos ? computeActiveIndex(pos.lineNumber, pos.column) : -1;
  if (activeIndex.value >= 0) {
    rowEls[activeIndex.value]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

watch(() => props.tokens, updateActiveIndex);

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
