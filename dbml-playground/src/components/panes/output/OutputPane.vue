<template>
  <div class="h-full flex flex-col">
    <div
      ref="tabBarRef"
      class="flex-shrink-0 border-b border-gray-200 bg-white flex items-center px-1 h-[33px] overflow-hidden"
    >
      <VTooltip
        v-for="tab in TABS"
        :key="tab.id"
        placement="bottom"
        :distance="6"
        :disabled="!iconsOnly"
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
          <span v-if="!iconsOnly">{{ tab.label }}</span>
        </button>
        <template #popper>
          <span class="text-xs">{{ tab.label }}</span>
        </template>
      </VTooltip>
    </div>

    <div class="flex-1 overflow-hidden">
      <TokensTab
        v-show="activeTab === OutputTabId.Tokens"
        ref="tokensTabRef"
        :tokens="parser.tokens"
        class="h-full"
      />
      <AstTab
        v-show="activeTab === OutputTabId.Nodes"
        :ast="parser.ast"
        class="h-full"
        @node-click="handleNodeClick"
        @position-click="handlePositionClick"
      />
      <SymbolsTab
        v-show="activeTab === OutputTabId.Symbols"
        :symbols="parser.symbols"
        class="h-full"
        @declaration-click="handleDeclarationClick"
      />
      <DatabaseTab
        v-if="activeTab === OutputTabId.Database"
        :database="parser.database"
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
  ref, computed, inject, onMounted, onBeforeUnmount, nextTick, type Component,
} from 'vue';
import {
  RectangleGroupIcon,
  ShareIcon,
  AtSymbolIcon,
  CircleStackIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from '@heroicons/vue/24/outline';
import TokensTab from './tabs/TokensTab.vue';
import AstTab from './tabs/AstTab.vue';
import SymbolsTab from './tabs/SymbolsTab.vue';
import DatabaseTab from './tabs/DatabaseTab.vue';
import DiagnosticsTab from './tabs/DiagnosticsTab.vue';
import type {
  NavigationPosition,
} from '@/types';
import type {
  RawAstNode,
} from './ast/RawAstTreeNode.vue';
import type {
  DeclPos,
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
  if (parser.errors.length > 0) return ExclamationCircleIcon;
  if (parser.warnings.length > 0) return ExclamationTriangleIcon;
  return CheckCircleIcon;
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
    icon: RectangleGroupIcon,
  },
  {
    id: OutputTabId.Nodes,
    label: 'Nodes',
    icon: ShareIcon,
  },
  {
    id: OutputTabId.Symbols,
    label: 'Symbols',
    icon: AtSymbolIcon,
  },
  {
    id: OutputTabId.Database,
    label: 'Database',
    icon: CircleStackIcon,
  },
  {
    id: OutputTabId.Diagnostics,
    label: 'Diagnostics',
    icon: ExclamationCircleIcon,
  },
];

const activeTab = computed({
  get: () => user.prefs.activeOutputTab,
  set: (v: OutputTabId) => { user.set('activeOutputTab', v); },
});
const tokensTabRef = ref<InstanceType<typeof TokensTab> | null>(null);
const tabBarRef = ref<HTMLElement | null>(null);
const iconsOnly = ref(false);

let fullTextWidth = 0;
let resizeObserver: ResizeObserver | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

function updateMode () {
  if (!tabBarRef.value) return;
  iconsOnly.value = tabBarRef.value.clientWidth < fullTextWidth;
}

onMounted(async () => {
  await nextTick();
  if (tabBarRef.value) {
    fullTextWidth = tabBarRef.value.scrollWidth;
    resizeObserver = new ResizeObserver(updateMode);
    resizeObserver.observe(tabBarRef.value);
    updateMode();
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
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

function handlePositionClick (event: { node: RawAstNode;
  position: NavigationPosition; }) {
  navigateTo({
    startLineNumber: event.position.start.line,
    startColumn: event.position.start.column,
    endLineNumber: event.position.end.line,
    endColumn: event.position.end.column,
  });
}

function handleDeclarationClick (pos: DeclPos) {
  activeTab.value = OutputTabId.Nodes;
  navigateTo({
    startLineNumber: pos.startLine,
    startColumn: pos.startCol,
    endLineNumber: pos.endLine,
    endColumn: pos.endCol,
  });
}

defineExpose({
  scrollToToken: (i: number) => tokensTabRef.value?.scrollToToken(i),
});
</script>
