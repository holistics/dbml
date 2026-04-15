<template>
  <div class="h-full flex flex-col">
    <div
      class="flex-shrink-0 border-b border-gray-200 bg-white flex items-center px-1 h-[33px] overflow-hidden @container/tabbar"
    >
      <VTooltip
        v-for="tab in TABS"
        :key="tab.id"
        placement="bottom"
        :distance="6"
        :disabled="true"
      >
        <button
          class="flex items-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap flex-shrink-0"
          :class="activeTab === tab.id
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-gray-600 hover:text-gray-900'"
          @click="activeTab = tab.id"
        >
          <span class="relative inline-flex flex-shrink-0">
            <component
              :is="tab.id === OutputTabId.Diagnostics ? diagnosticsIcon : tab.icon"
              class="w-3.5 h-3.5"
              :class="tab.id === OutputTabId.Diagnostics ? diagnosticsColor : ''"
            />
            <span
              v-if="tab.id === OutputTabId.Database && parser.hasDatabase"
              class="absolute bottom-0 right-0 flex items-center justify-center"
            >
              <span class="animate-ping absolute w-2 h-2 rounded-full bg-blue-400 opacity-40 [animation-duration:2s]" />
              <span class="relative w-1.5 h-1.5 rounded-full bg-blue-500" />
            </span>
            <span
              v-if="tab.id === OutputTabId.Diagnostics && (parser.errors.length + parser.warnings.length) > 0"
              class="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[12px] h-[12px] rounded-full px-[3px] text-[8px] font-bold leading-none text-white"
              :class="parser.errors.length > 0 ? 'bg-red-500' : 'bg-yellow-500'"
            >{{ parser.errors.length + parser.warnings.length }}</span>
          </span>
          <span class="@[460px]/tabbar:inline hidden">{{ tab.label }}</span>
        </button>
        <template #popper>
          <span class="text-xs">{{ tab.label }}</span>
        </template>
      </VTooltip>

    </div>

    <div class="flex-1 overflow-hidden">
      <TokensTab
        v-if="activeTab === OutputTabId.Tokens"
        ref="tokensTabRef"
        :tokens="parser.tokens"
        :show-decor="isDecorEnabled(activeTab)"
        class="h-full"
        @toggle-decor="toggleDecor(activeTab)"
      />
      <AstTab
        v-if="activeTab === OutputTabId.Nodes"
        :ast="parser.ast"
        :show-decor="isDecorEnabled(activeTab)"
        class="h-full"
        @node-click="handleNodeClick"
        @toggle-decor="toggleDecor(activeTab)"
      />
      <SymbolsTab
        v-if="activeTab === OutputTabId.Symbols"
        :symbols="parser.symbols"
        :show-decor="isDecorEnabled(activeTab)"
        class="h-full"
        @toggle-decor="toggleDecor(activeTab)"
      />
      <DatabaseTab
        v-if="activeTab === OutputTabId.Database"
        :database="parser.database"
        :show-decor="isDecorEnabled(activeTab)"
        @toggle-decor="toggleDecor(activeTab)"
      />
      <DiagnosticsTab
        v-if="activeTab === OutputTabId.Diagnostics"
        :errors="parser.errors"
        :warnings="parser.warnings"
        :current-file="project.currentFile"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref, shallowRef, computed, watch, inject, onBeforeUnmount, type Component, type Ref,
} from 'vue';
import {
  PhSquaresFour,
  PhTreeStructure,
  PhAt,
  PhDatabase,
  PhCheckCircle,
  PhWarning,
  PhWarningCircle,
} from '@phosphor-icons/vue';
import TokensTab from './tabs/TokensTab.vue';
import AstTab from './tabs/AstTab.vue';
import SymbolsTab from './tabs/SymbolsTab.vue';
import DatabaseTab from './tabs/DatabaseTab.vue';
import DiagnosticsTab from './tabs/DiagnosticsTab.vue';
import type {
  RawAstNode,
} from './ast/RawAstTreeNode.vue';
import type {
  SymbolInfo,
} from '@/stores/parserStore';
import {
  useParser,
} from '@/stores/parserStore';
import {
  useProject,
} from '@/stores/projectStore';
import {
  useUser,
} from '@/stores/userStore';
import {
  OutputTabId,
} from '@/stores/userStore';
import logger from '@/utils/logger';
import * as monaco from 'monaco-editor';

const parser = useParser();
const project = useProject();
const user = useUser();

interface Tab {
  id: OutputTabId;
  label: string;
  icon: Component;
}

const diagnosticsIcon = computed(() => {
  if (parser.errors.length > 0) return PhWarningCircle;
  if (parser.warnings.length > 0) return PhWarning;
  return PhCheckCircle;
});

const diagnosticsColor = computed(() => {
  if (parser.errors.length > 0) return 'text-red-500';
  if (parser.warnings.length > 0) return 'text-yellow-500';
  return 'text-blue-400';
});

const TABS: Tab[] = [
  {
    id: OutputTabId.Tokens,
    label: 'Tokens',
    icon: PhSquaresFour,
  },
  {
    id: OutputTabId.Nodes,
    label: 'Nodes',
    icon: PhTreeStructure,
  },
  {
    id: OutputTabId.Symbols,
    label: 'Symbols',
    icon: PhAt,
  },
  {
    id: OutputTabId.Database,
    label: 'Database',
    icon: PhDatabase,
  },
  {
    id: OutputTabId.Diagnostics,
    label: 'Diagnostics',
    icon: PhWarningCircle,
  },
];

const activeTab = computed({
  get: () => user.prefs.activeOutputTab,
  set: (v: OutputTabId) => { user.set('activeOutputTab', v); },
});
const DECOR_STORAGE_KEY = 'playground:showDecorations';

function loadDecorPrefs (): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(DECOR_STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

const decorPrefs = shallowRef<Record<string, boolean>>(loadDecorPrefs());

function isDecorEnabled (tabId: string): boolean {
  return decorPrefs.value[tabId] ?? true;
}

function toggleDecor (tabId: string) {
  decorPrefs.value = { ...decorPrefs.value, [tabId]: !isDecorEnabled(tabId) };
  localStorage.setItem(DECOR_STORAGE_KEY, JSON.stringify(decorPrefs.value));
}
const dbmlEditorRef = inject<Ref<monaco.editor.IStandaloneCodeEditor | null>>('dbmlEditorRef');
let editorDecorations: monaco.editor.IEditorDecorationsCollection | null = null;

// --- Per-tab range extraction ---

const AST_SKIP_KEYS = new Set(['parentNode', 'parent', 'symbol', 'referee', 'source', 'filepath']);

const AST_RANGE_LIMIT = 2000;

function collectAstRanges (ast: unknown): monaco.IRange[] {
  const ranges: monaco.IRange[] = [];
  const visited = new WeakSet<object>();
  function walk (node: unknown) {
    if (ranges.length >= AST_RANGE_LIMIT) return;
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const obj = node as Record<string, unknown>;
    const sp = obj.startPos as { line?: number; column?: number } | null | undefined;
    const ep = obj.endPos as { line?: number; column?: number } | null | undefined;
    if (sp && ep && typeof sp.line === 'number' && !Number.isNaN(sp.line)
      && typeof ep.line === 'number' && !Number.isNaN(ep.line)) {
      ranges.push(new monaco.Range(
        sp.line + 1, (sp.column ?? 0) + 1,
        ep.line + 1, (ep.column ?? 0) + 1,
      ));
    }
    for (const [key, val] of Object.entries(obj)) {
      if (AST_SKIP_KEYS.has(key)) continue;
      walk(val);
    }
  }
  walk(ast);
  return ranges;
}

function collectSymbolRanges (symbols: SymbolInfo[]): monaco.IRange[] {
  const ranges: monaco.IRange[] = [];
  function walk (sym: SymbolInfo) {
    if (sym.declPos) {
      ranges.push(new monaco.Range(
        sym.declPos.startLine, sym.declPos.startCol,
        sym.declPos.endLine, sym.declPos.endCol,
      ));
    }
    sym.members.forEach(walk);
  }
  symbols.forEach(walk);
  return ranges;
}

function collectDatabaseRanges (): monaco.IRange[] {
  const db = parser.database;
  if (!db) return [];
  const ranges: monaco.IRange[] = [];
  function addToken (tp: { start: { line: number; column: number }; end: { line: number; column: number } } | undefined) {
    if (!tp) return;
    ranges.push(new monaco.Range(tp.start.line, tp.start.column, tp.end.line, tp.end.column));
  }
  for (const t of db.tables) { addToken(t.token); }
  for (const r of db.refs) { addToken(r.token); }
  for (const e of db.enums) { addToken(e.token); }
  for (const n of db.notes) { addToken(n.token); }
  for (const tg of db.tableGroups) { addToken(tg.token); }
  for (const tp of db.tablePartials ?? []) { addToken((tp as { token?: { start: { line: number; column: number }; end: { line: number; column: number } } }).token); }
  return ranges;
}

const TAB_DECOR_CLASS: Partial<Record<string, string>> = {
  [OutputTabId.Tokens]: 'hl-tokens',
  [OutputTabId.Nodes]: 'hl-nodes',
  [OutputTabId.Symbols]: 'hl-symbols',
  [OutputTabId.Database]: 'hl-database',
};

function updateEditorDecorations () {
  const editor = dbmlEditorRef?.value;
  editorDecorations?.clear();
  if (!editor || !isDecorEnabled(activeTab.value)) return;
  const cls = TAB_DECOR_CLASS[activeTab.value];
  if (!cls) return;

  let ranges: monaco.IRange[] = [];
  if (activeTab.value === OutputTabId.Tokens) {
    ranges = parser.tokens.map((t) => new monaco.Range(
      t.startPos.line + 1, t.startPos.column + 1,
      t.endPos.line + 1, t.endPos.column + 1,
    ));
  } else if (activeTab.value === OutputTabId.Nodes) {
    ranges = collectAstRanges(parser.ast);
  } else if (activeTab.value === OutputTabId.Symbols) {
    ranges = collectSymbolRanges(parser.symbols);
  } else if (activeTab.value === OutputTabId.Database) {
    ranges = collectDatabaseRanges();
  }
  if (ranges.length === 0) return;
  editorDecorations = editor.createDecorationsCollection(
    ranges.map((range) => ({ range, options: { inlineClassName: cls } })),
  );
}

watch(
  [activeTab, decorPrefs, () => parser.tokens, () => parser.ast, () => parser.symbols, () => parser.database, () => dbmlEditorRef?.value],
  updateEditorDecorations,
  { immediate: true },
);

onBeforeUnmount(() => { editorDecorations?.clear(); editorDecorations = null; });

const tokensTabRef = ref<InstanceType<typeof TokensTab> | null>(null);
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

onBeforeUnmount(() => {
  if (highlightTimer !== null) clearTimeout(highlightTimer);
});

const getEditor = inject<() => monaco.editor.IStandaloneCodeEditor | null>('getDbmlEditor');

function navigateTo (range: { startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number; }) {
  const editor = getEditor?.();
  if (!editor) return;
  try {
    editor.setSelection(range);
    editor.revealRangeInCenter(range);
    const decorations = editor.createDecorationsCollection([{
      range,
      options: {
        className: 'token-navigation-highlight',
        inlineClassName: 'token-navigation-highlight-inline',
      },
    }]);
    if (highlightTimer !== null) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => { decorations.clear(); highlightTimer = null; }, 2000);
  } catch (err) {
    logger.warn('Navigation failed:', err);
  }
}

function handleNodeClick (node: RawAstNode) {
  const d = node.rawData as Record<string, unknown> | null | undefined;
  if (!d) return;
  const sp = d.startPos as Record<string, unknown> | null | undefined;
  if (!sp || typeof sp.line !== 'number' || Number.isNaN(sp.line)) return;
  const ep = d.endPos as Record<string, unknown> | null | undefined;
  navigateTo({
    startLineNumber: (sp.line as number) + 1,
    startColumn: typeof sp.column === 'number' ? (sp.column as number) + 1 : 1,
    endLineNumber: ep && typeof ep.line === 'number' && !Number.isNaN(ep.line) ? (ep.line as number) + 1 : (sp.line as number) + 1,
    endColumn: ep && typeof ep.column === 'number' ? (ep.column as number) + 1 : 1,
  });
}


defineExpose({
  scrollToToken: (i: number) => tokensTabRef.value?.scrollToToken(i),
});
</script>

<style>
.hl-tokens {
  outline: 1px solid rgba(99, 102, 241, 0.35);
  outline-offset: -1px;
  border-radius: 2px;
  background: rgba(99, 102, 241, 0.06);
}
.hl-nodes {
  outline: 1px solid rgba(59, 130, 246, 0.35);
  outline-offset: -1px;
  border-radius: 2px;
  background: rgba(59, 130, 246, 0.06);
}
.hl-symbols {
  outline: 1px solid rgba(245, 158, 11, 0.4);
  outline-offset: -1px;
  border-radius: 2px;
  background: rgba(245, 158, 11, 0.07);
}
.hl-database {
  outline: 1px solid rgba(16, 185, 129, 0.4);
  outline-offset: -1px;
  border-radius: 2px;
  background: rgba(16, 185, 129, 0.07);
}
</style>
