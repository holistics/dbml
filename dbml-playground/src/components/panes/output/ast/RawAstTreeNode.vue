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
        v-if="hasChildren"
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
      <span v-if="nodeId !== ''" class="text-gray-300 text-[10px] font-mono mr-1.5">#{{ nodeId }}</span>

      <span
        v-if="leafValue !== ''"
        class="text-green-700"
      >{{ leafValue }}</span>
      <span
        v-if="sizeHint"
        class="text-gray-400"
      >{{ sizeHint }}</span>

      <span
        v-if="nodeFilepath"
        class="ml-auto flex-shrink-0 text-[10px] text-gray-400 font-mono px-1 truncate max-w-[120px]"
        :title="nodeFilepath"
      >{{ nodeFilepathBasename }}</span>
      <span
        v-if="hasPosition"
        class="flex-shrink-0 text-[10px] text-blue-400 hover:text-blue-600 hover:underline px-1"
        :class="!nodeFilepath ? 'ml-auto' : ''"
        @click.stop="handlePositionClick"
      >{{ formatPosition() }}</span>
    </div>

    <div v-if="isExpanded && hasChildren">
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
        @position-click="$emit('position-click', $event)"
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
  PhTable,
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
  PhNote,
  type Icon,
} from '@phosphor-icons/vue';
import type {
  NavigationPosition,
} from '@/types';

export interface RawAstNode {
  id: string;
  propertyName: string;
  rawData: unknown;
  value?: unknown;
  children: RawAstNode[];
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
  'position-click': [{ node: RawAstNode;
    position: NavigationPosition; }];
  'scroll-to': [id: string];
}>();

const rowEl = ref<HTMLElement | null>(null);
const isExpanded = computed(() => props.expandedNodes.has(props.node.id));
const hasChildren = computed(() => props.node.children.length > 0);
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

const nodeId = computed(() => {
  const d = asObj(props.node.rawData);
  if (!d) return '';
  const id = d.id;
  return typeof id === 'number' || typeof id === 'string' ? String(id) : '';
});

const nodeFilepath = computed((): string => {
  const d = asObj(props.node.rawData);
  if (!d || !d.filepath || typeof d.filepath !== 'object') return '';
  const fp = d.filepath as { absolute?: string };
  return typeof fp.absolute === 'string' ? fp.absolute : '';
});

const nodeFilepathBasename = computed(() => {
  if (!nodeFilepath.value) return '';
  return nodeFilepath.value.split('/').pop() ?? nodeFilepath.value;
});

const leafValue = computed(() => {
  const d = props.node.rawData;
  if (d === null) return 'null';
  if (d === undefined) return '';
  if (typeof d !== 'object') return typeof d === 'string' ? `"${d}"` : String(d);
  const obj = asObj(d);
  if (obj && 'value' in obj && typeof obj.value === 'string' && !hasChildren.value) return `"${obj.value}"`;
  return '';
});

const sizeHint = computed(() => {
  const d = props.node.rawData;
  if (!Array.isArray(d)) return '';
  return d.length === 0 ? '[ ]' : `[ ${d.length} ]`;
});

const hasPosition = computed(() => {
  const d = asObj(props.node.rawData);
  if (!d) return false;
  const sp = asObj(d.startPos);
  if (sp && typeof sp.line === 'number') return true;
  return typeof d.start === 'number';
});

function formatPosition (): string {
  const d = asObj(props.node.rawData);
  if (!d) return '';
  const sp = asObj(d.startPos);
  if (sp && typeof sp.line === 'number') {
    const sl = sp.line + 1, sc = typeof sp.column === 'number' ? sp.column + 1 : 1;
    const ep = asObj(d.endPos);
    if (ep && typeof ep.line === 'number') {
      const el = ep.line + 1, ec = typeof ep.column === 'number' ? ep.column + 1 : 1;
      return sl === el ? `${sl}:${sc}` : `${sl}:${sc}–${el}:${ec}`;
    }
    return `${sl}:${sc}`;
  }
  return typeof d.start === 'number' ? `@${d.start}` : '';
}

function handleNodeClick () { emit('node-click', props.node); }
function toggleExpanded () {
  emit('node-expand', {
    id: props.node.id,
    expanded: !isExpanded.value,
  });
}

function handlePositionClick () {
  const d = asObj(props.node.rawData);
  if (!d) return;
  const sp = asObj(d.startPos);
  const ep = asObj(d.endPos);
  let position: NavigationPosition | null = null;
  if (sp && typeof sp.line === 'number' && ep && typeof ep.line === 'number') {
    position = {
      start: {
        line: sp.line + 1,
        column: typeof sp.column === 'number' ? sp.column + 1 : 1,
        offset: typeof d.start === 'number' ? d.start : 0,
      },
      end: {
        line: ep.line + 1,
        column: typeof ep.column === 'number' ? ep.column + 1 : 1,
        offset: typeof d.end === 'number' ? d.end : 0,
      },
    };
  } else if (typeof d.start === 'number') {
    position = {
      start: {
        line: 1,
        column: 1,
        offset: d.start,
      },
      end: {
        line: 1,
        column: 1,
        offset: typeof d.end === 'number' ? d.end : d.start,
      },
    };
  }
  if (position) emit('position-click', {
    node: props.node,
    position,
  });
}
</script>
