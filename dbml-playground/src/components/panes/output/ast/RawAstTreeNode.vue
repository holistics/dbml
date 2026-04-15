<template>
  <div>
    <div
      ref="rowEl"
      class="flex items-center py-[3px] cursor-pointer select-none"
      :style="{ paddingLeft: `${8 + level * 14}px` }"
      :class="isActive ? 'bg-yellow-100' : 'hover:bg-blue-50'"
      @click="handleNodeClick"
    >
      <!-- chevron -->
      <button
        v-if="isExpandable"
        class="flex-shrink-0 w-3.5 h-3.5 mr-1 flex items-center justify-center text-gray-400 hover:text-gray-600"
        @click.stop="toggleExpanded"
      >
        <PhCaretRight
          class="w-3 h-3 transition-transform duration-100"
          :class="isExpanded ? 'rotate-90' : ''"
        />
      </button>
      <span
        v-else
        class="flex-shrink-0 w-3.5 h-3.5 mr-1"
      />

      <!-- type icon -->
      <VTooltip placement="bottom" :distance="6" class="flex-shrink-0 mr-1.5">
        <component :is="typeIcon.icon" class="w-3 h-3" :class="typeIcon.color" />
        <template #popper>
          <span class="text-xs font-mono">{{ typeIcon.label }}</span>
        </template>
      </VTooltip>

      <span class="text-gray-700 mr-1">{{ node.propertyName }}</span>

      <span
        v-if="leafValue !== ''"
        class="text-green-700"
      >{{ leafValue }}</span>
      <span
        v-if="sizeHint"
        class="text-gray-400"
      >{{ sizeHint }}</span>

    </div>

    <div v-if="isExpanded && isExpandable">
      <!-- Token entries: SyntaxToken properties rendered as key-value rows -->
      <div
        v-if="node.tokenEntries.length > 0"
        class="border-b border-gray-100 border-l-2 border-l-blue-100 bg-blue-50/20"
        :style="{ paddingLeft: `${8 + (level + 1) * 14}px`, paddingRight: '8px' }"
      >
        <div
          class="grid py-1 gap-y-0.5 items-start text-[11px]"
          style="grid-template-columns: max-content 1fr; column-gap: 10px;"
        >
          <template v-for="entry in node.tokenEntries" :key="entry.key">
            <span class="text-gray-400 text-[10px] font-medium pt-[2px] select-none shrink-0">{{ entry.key }}</span>

            <!-- Single SyntaxToken -->
            <span v-if="!Array.isArray(entry.data)" class="inline-flex items-center gap-1 font-mono">
              <component :is="tokenIconFor(entry.data.kind).icon" class="w-3 h-3 flex-shrink-0" :class="tokenIconFor(entry.data.kind).color" />
              <span :class="entry.data.kind === SyntaxTokenKind.EOF ? 'text-red-400' : 'text-green-700'">
                {{ entry.data.kind === SyntaxTokenKind.EOF ? '<EOF>' : (entry.data.value || '·') }}
              </span>
            </span>

            <!-- SyntaxToken[] -->
            <span v-else class="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono">
              <template v-for="(tok, ti) in entry.data" :key="ti">
                <span v-if="tok.kind === '<space>'" class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]"><PhArrowsHorizontal class="w-2.5 h-2.5" />{{ tok.value.length }}</span>
                <PhKeyReturn v-else-if="tok.kind === '<newline>'" class="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span v-else-if="tok.kind === '<tab>'" class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]">→</span>
                <span v-else-if="tok.kind === '<single-line-comment>' || tok.kind === '<multiline-comment>'" class="text-gray-400 italic text-[10px] break-all">{{ tok.value }}</span>
                <span v-else class="inline-flex items-center gap-0.5">
                  <component :is="tokenIconFor(tok.kind).icon" class="w-3 h-3 flex-shrink-0" :class="tokenIconFor(tok.kind).color" />
                  <span class="text-green-700">{{ tok.value }}</span>
                </span>
              </template>
            </span>

            <!-- Trivia/error rows for single token -->
            <template v-if="!Array.isArray(entry.data)">
              <template v-for="section in triviaRows(entry.data)" :key="section.label">
                <template v-if="section.tokens.length > 0">
                  <span class="text-[10px] font-medium select-none" :class="section.error ? 'text-red-400' : 'text-gray-400'">{{ section.label }}</span>
                  <span class="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono" :class="section.error ? 'text-red-600' : 'text-gray-600'">
                    <template v-for="(t, ti) in section.tokens" :key="ti">
                      <span v-if="t.kind === '<space>'" class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]"><PhArrowsHorizontal class="w-2.5 h-2.5" />{{ t.value.length }}</span>
                      <PhKeyReturn v-else-if="t.kind === '<newline>'" class="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span v-else-if="t.kind === '<tab>'" class="inline-flex items-center gap-0.5 text-gray-400 bg-gray-100 rounded px-1 text-[10px]">→</span>
                      <span v-else-if="t.kind === '<single-line-comment>' || t.kind === '<multiline-comment>'" class="italic break-all">{{ t.value }}</span>
                      <span v-else class="break-all">{{ t.value }}</span>
                    </template>
                  </span>
                </template>
              </template>
            </template>
          </template>
        </div>
      </div>

      <!-- SyntaxNode children -->
      <RawAstTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-node="selectedNode"
        :expanded-nodes="expandedNodes"
        :level="level + 1"
        :cursor-node-id="cursorNodeId"
        @node-click="$emit('node-click', $event)"
        @node-expand="$emit('node-expand', $event)"
        @scroll-to="$emit('scroll-to', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, ref, watch,
} from 'vue';
import {
  PhCaretRight,
  PhDiamond,
  PhFile,
  PhTag,
  PhListBullets,
  PhArrowsLeftRight,
  PhBracketsSquare,
  PhBracketsCurly,
  PhTextAa,
  PhHash,
  PhToggleLeft,
  PhMinus,
  PhLightning,
  PhMathOperations,
  PhArrowsHorizontal,
  PhKeyReturn,
  type Icon,
} from '@phosphor-icons/vue';
import {
  SyntaxToken,
  SyntaxTokenKind,
} from '@dbml/parse';
import {
  tokenIconFor,
} from '@/utils/tokenIcons';

export interface TokenEntry {
  key: string;
  data: SyntaxToken | SyntaxToken[];
}

export interface RawAstNode {
  id: string;
  propertyName: string;
  rawData: unknown;
  value?: unknown;
  children: RawAstNode[];
  tokenEntries: TokenEntry[];
  accessPath: string;
}

type RawObj = Record<string, unknown>;

interface Props {
  node: RawAstNode;
  selectedNode: RawAstNode | null;
  expandedNodes: Set<string>;
  level: number;
  cursorNodeId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'node-click': [node: RawAstNode];
  'node-expand': [{ id: string;
    expanded: boolean; }];
  'scroll-to': [id: string];
}>();

const rowEl = ref<HTMLElement | null>(null);
const isExpanded = computed(() => props.expandedNodes.has(props.node.id));
const isExpandable = computed(() => props.node.children.length > 0 || props.node.tokenEntries.length > 0);
const isActive = computed(() => props.node.id === props.cursorNodeId || props.selectedNode?.id === props.node.id);

// Scroll into view when this node becomes the active cursor node
watch(isActive, (active) => {
  if (active && rowEl.value) {
    rowEl.value.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }
});

function asObj (d: unknown): RawObj | null {
  return d !== null && typeof d === 'object' && !Array.isArray(d) ? d as RawObj : null;
}

const nodeKind = computed(() => {
  const d = asObj(props.node.rawData);
  return d && typeof d.kind === 'string' ? d.kind : '';
});

interface IconInfo { icon: typeof PhDiamond; color: string; label: string }

const NODE_KIND_ICONS: Record<string, IconInfo> = {
  '<program>':              { icon: PhFile,            color: 'text-blue-500',   label: '<program>' },
  '<element-declaration>':  { icon: PhTag,             color: 'text-indigo-500', label: '<element-declaration>' },
  '<use-declaration>':      { icon: PhArrowsLeftRight, color: 'text-purple-500', label: '<use-declaration>' },
  '<use-specifier>':        { icon: PhArrowsLeftRight, color: 'text-purple-400', label: '<use-specifier>' },
  '<use-specifier-list>':   { icon: PhArrowsLeftRight, color: 'text-purple-400', label: '<use-specifier-list>' },
  '<attribute>':            { icon: PhTag,             color: 'text-amber-500',  label: '<attribute>' },
  '<block-expression>':     { icon: PhBracketsCurly,   color: 'text-cyan-500',   label: '<block-expression>' },
  '<list-expression>':      { icon: PhBracketsSquare,  color: 'text-cyan-500',   label: '<list-expression>' },
  '<tuple-expression>':     { icon: PhBracketsSquare,  color: 'text-cyan-400',   label: '<tuple-expression>' },
  '<function-expression>':  { icon: PhLightning,       color: 'text-orange-500', label: '<function-expression>' },
  '<function-application>': { icon: PhLightning,       color: 'text-orange-400', label: '<function-application>' },
  '<prefix-expression>':    { icon: PhMathOperations,  color: 'text-red-400',    label: '<prefix-expression>' },
  '<infix-expression>':     { icon: PhMathOperations,  color: 'text-red-400',    label: '<infix-expression>' },
  '<postfix-expression>':   { icon: PhMathOperations,  color: 'text-red-400',    label: '<postfix-expression>' },
  '<literal>':              { icon: PhTextAa,          color: 'text-green-600',  label: '<literal>' },
  '<variable>':             { icon: PhTextAa,          color: 'text-violet-500', label: '<variable>' },
  '<identifer-stream>':     { icon: PhListBullets,     color: 'text-blue-400',   label: '<identifier-stream>' },
  '<primary-expression>':   { icon: PhDiamond,         color: 'text-gray-400',   label: '<primary-expression>' },
  '<group-expression>':     { icon: PhDiamond,         color: 'text-gray-400',   label: '<group-expression>' },
  '<comma-expression>':     { icon: PhDiamond,         color: 'text-gray-400',   label: '<comma-expression>' },
  '<call-expression>':      { icon: PhLightning,       color: 'text-orange-400', label: '<call-expression>' },
  '<array>':                { icon: PhBracketsSquare,  color: 'text-cyan-500',   label: '<array>' },
  '<dummy>':                { icon: PhMinus,           color: 'text-gray-300',   label: '<dummy>' },
};

const typeIcon = computed((): IconInfo => {
  const d = props.node.rawData;
  if (nodeKind.value) return NODE_KIND_ICONS[nodeKind.value] ?? { icon: PhDiamond, color: 'text-blue-400', label: nodeKind.value };
  if (Array.isArray(d)) return { icon: PhBracketsSquare, color: 'text-cyan-500', label: 'array' };
  if (d === null || d === undefined) return { icon: PhMinus, color: 'text-gray-300', label: 'null' };
  if (typeof d === 'string') return { icon: PhTextAa, color: 'text-green-600', label: 'string' };
  if (typeof d === 'number') return { icon: PhHash, color: 'text-amber-500', label: 'number' };
  if (typeof d === 'boolean') return { icon: PhToggleLeft, color: 'text-blue-400', label: 'boolean' };
  return { icon: PhBracketsCurly, color: 'text-gray-400', label: 'object' };
});

const leafValue = computed(() => {
  const d = props.node.rawData;
  if (d === null) return 'null';
  if (d === undefined) return '';
  if (typeof d !== 'object') return typeof d === 'string' ? `"${d}"` : String(d);
  const obj = asObj(d);
  if (obj && 'value' in obj && typeof obj.value === 'string' && !isExpandable.value) {
    if (obj.value === '') return d instanceof SyntaxToken && d.kind === SyntaxTokenKind.EOF ? '<EOF>' : '';
    return `"${obj.value}"`;
  }
  return '';
});

const sizeHint = computed(() => {
  const d = props.node.rawData;
  if (!Array.isArray(d)) return '';
  return d.length === 0 ? '[ ]' : `[ ${d.length} ]`;
});

function triviaRows (tok: SyntaxToken) {
  return [
    { label: 'leading trivia',  tokens: tok.leadingTrivia,   error: false },
    { label: 'trailing trivia', tokens: tok.trailingTrivia,  error: false },
    { label: 'leading errors',  tokens: tok.leadingInvalid,  error: true },
    { label: 'trailing errors', tokens: tok.trailingInvalid, error: true },
  ];
}

function handleNodeClick () { emit('node-click', props.node); }
function toggleExpanded () {
  emit('node-expand', {
    id: props.node.id,
    expanded: !isExpanded.value,
  });
}
</script>
