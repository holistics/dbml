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
        :show-decoration="isDecorationEnabled(activeTab)"
        class="h-full"
        @toggle-decoration="toggleDecoration(activeTab)"
      />
      <AstTab
        v-if="activeTab === OutputTabId.Nodes"
        :ast="parser.ast"
        :show-decoration="isDecorationEnabled(activeTab)"
        class="h-full"
        @node-click="handleNodeClick"
        @toggle-decoration="toggleDecoration(activeTab)"
      />
      <SymbolsTab
        v-if="activeTab === OutputTabId.Symbols"
        :symbols="parser.symbols"
        :show-decoration="isDecorationEnabled(activeTab)"
        class="h-full"
        @toggle-decoration="toggleDecoration(activeTab)"
        @symbol-click="handleSymbolClick"
      />
      <DatabaseTab
        v-if="activeTab === OutputTabId.Database"
        :database="parser.database"
        :show-decoration="isDecorationEnabled(activeTab)"
        @toggle-decoration="toggleDecoration(activeTab)"
      />
      <DiagnosticsTab
        v-if="activeTab === OutputTabId.Diagnostics"
        :errors="parser.errors"
        :warnings="parser.warnings"
        :current-file="project.currentFile"
        @position-click="onDiagnosticClick"
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
  Filepath,
} from '@dbml/parse';
import {
  useUser, OutputTabId,
} from '@/stores/userStore';
import logger from '@/utils/logger';
import {
  toMonacoRange,
} from '@/utils/monaco';
import * as monaco from 'monaco-editor';

// Per-tab decoration logic lives in ./tabs/common/decorations.ts so each tab's
// color map and collector travels with the tab and OutputPane stays thin.
import {
  collectDatabaseDecorations,
  collectNodeDecorations,
  collectSymbolDecorations,
  collectTokenDecorations,
  type DecorationEntry,
} from './tabs/common/decorations';

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

function isDecorationEnabled (tabId: string): boolean {
  return decorPrefs.value[tabId] ?? true;
}

function toggleDecoration (tabId: string) {
  decorPrefs.value = {
    ...decorPrefs.value,
    [tabId]: !isDecorationEnabled(tabId),
  };
  localStorage.setItem(DECOR_STORAGE_KEY, JSON.stringify(decorPrefs.value));
}
const dbmlEditorRef = inject<Ref<monaco.editor.IStandaloneCodeEditor | null>>('dbmlEditorRef');
let editorDecorations: monaco.editor.IEditorDecorationsCollection | null = null;

function updateEditorDecorations () {
  const editor = dbmlEditorRef?.value;
  editorDecorations?.clear();
  if (!editor || !isDecorationEnabled(activeTab.value)) return;

  const entries: DecorationEntry[] = (() => {
    switch (activeTab.value) {
      case OutputTabId.Tokens: return collectTokenDecorations(parser.tokens);
      case OutputTabId.Nodes: return collectNodeDecorations(parser.ast);
      case OutputTabId.Symbols: return collectSymbolDecorations(parser.symbols);
      case OutputTabId.Database: return collectDatabaseDecorations(parser.database);
      default: return [];
    }
  })();
  if (entries.length === 0) return;

  editorDecorations = editor.createDecorationsCollection(
    entries.map(({
      range, cls,
    }) => ({
      range,
      options: {
        inlineClassName: cls,
      },
    })),
  );
}

watch(
  [activeTab, decorPrefs, () => parser.tokens, () => parser.ast, () => parser.symbols, () => parser.database, () => dbmlEditorRef?.value],
  updateEditorDecorations,
  {
    immediate: true,
  },
);

onBeforeUnmount(() => { editorDecorations?.clear(); editorDecorations = null; });

const tokensTabRef = ref<InstanceType<typeof TokensTab> | null>(null);
let highlightTimer: ReturnType<typeof setTimeout> | null = null;
let navDecorations: monaco.editor.IEditorDecorationsCollection | null = null;

onBeforeUnmount(() => {
  if (highlightTimer !== null) clearTimeout(highlightTimer);
  navDecorations?.clear();
});

function navigateTo (range: { startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number; }) {
  const editor = dbmlEditorRef?.value;
  if (!editor) return;
  try {
    editor.setSelection(range);
    editor.revealRangeInCenter(range);
    if (highlightTimer !== null) clearTimeout(highlightTimer);
    navDecorations?.clear();
    navDecorations = editor.createDecorationsCollection([{
      range,
      options: {
        className: 'token-navigation-highlight',
        inlineClassName: 'token-navigation-highlight-inline',
      },
    }]);
    highlightTimer = setTimeout(() => { navDecorations?.clear(); navDecorations = null; highlightTimer = null; }, 2000);
  } catch (err) {
    logger.warn('Navigation failed:', err);
  }
}

// Reveal and highlight the syntax range a diagnostic points at. ParserError
// carries start/end line+column — translate straight into an editor range.
function onDiagnosticClick (diag: { location: { line: number;
  column: number; };
endLocation: { line: number;
  column: number; }; }) {
  navigateTo({
    startLineNumber: diag.location.line,
    startColumn: diag.location.column,
    endLineNumber: diag.endLocation.line,
    endColumn: diag.endLocation.column,
  });
}

// Navigate to a declaration that may be in a different file.
async function navigateToDeclaration (targetFilepath: string | null, range: { startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number; }) {
  const editor = dbmlEditorRef?.value;
  if (!editor) return;
  if (targetFilepath && new Filepath(targetFilepath).intern() !== new Filepath(project.currentFile).intern()) {
    if (project.files[targetFilepath] === undefined) return;
    project.setCurrentFile(targetFilepath);
    await new Promise<void>((resolve) => {
      const d = editor.onDidChangeModel(() => { d.dispose(); resolve(); });
      setTimeout(resolve, 500);
    });
  }
  navigateTo(range);
}

function posToRange (sp: Record<string, unknown>, ep?: Record<string, unknown> | null) {
  return toMonacoRange(
    {
      line: sp.line as number,
      column: sp.column as number | undefined,
    },
    ep && typeof ep.line === 'number'
      ? {
          line: ep.line as number,
          column: ep.column as number | undefined,
        }
      : null,
  );
}

function handleNodeClick (node: RawAstNode) {
  const d = node.rawData as Record<string, unknown> | null | undefined;
  if (!d) return;

  // If the node declares a symbol, navigate to the symbol's declaration (may be cross-file).
  const sym = d.symbol as { declaration?: Record<string, unknown> } | null | undefined;
  const symDecl = sym?.declaration;
  if (symDecl) {
    const sp = symDecl.startPos as Record<string, unknown> | null | undefined;
    if (sp && typeof sp.line === 'number' && !Number.isNaN(sp.line)) {
      const fp = (symDecl.filepath as { absolute?: string } | null | undefined)?.absolute ?? null;
      navigateToDeclaration(fp, posToRange(sp, symDecl.endPos as Record<string, unknown> | null));
      return;
    }
  }

  const sp = d.startPos as Record<string, unknown> | null | undefined;
  if (!sp || typeof sp.line !== 'number' || Number.isNaN(sp.line)) return;
  navigateTo(posToRange(sp, d.endPos as Record<string, unknown> | null));
}

function handleSymbolClick (sym: SymbolInfo) {
  if (!sym.declPos) return;
  navigateToDeclaration(sym.declFilepath, {
    startLineNumber: sym.declPos.startLine,
    startColumn: sym.declPos.startCol,
    endLineNumber: sym.declPos.endLine,
    endColumn: sym.declPos.endCol,
  });
}

defineExpose({
  scrollToToken: (i: number) => tokensTabRef.value?.scrollToToken(i),
});
</script>
