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
        <ChevronRightIcon
          class="w-3 h-3 transition-transform duration-100"
          :class="isExpanded ? 'rotate-90' : ''"
        />
      </button>
      <span
        v-else
        class="flex-shrink-0 w-3.5 h-3.5 mr-1"
      />

      <span class="text-gray-700 mr-1.5">{{ node.propertyName }}</span>
      <span
        v-if="node.readableId"
        class="text-blue-500 mr-1.5 hover:underline text-[11px]"
      >{{ node.readableId }}</span>
      <span
        v-else-if="nodeKind"
        class="text-blue-500 mr-1.5 hover:underline"
      >{{ nodeKind }}</span>
      <span
        v-if="leafValue !== ''"
        class="text-green-700"
      >{{ leafValue }}</span>
      <span
        v-if="sizeHint"
        class="text-gray-400"
      >{{ sizeHint }}</span>

      <span
        v-if="hasPosition"
        class="ml-auto flex-shrink-0 text-[10px] text-blue-400 hover:text-blue-600 hover:underline px-1"
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
  ChevronRightIcon,
} from '@heroicons/vue/24/outline';
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
  readableId?: string; // set when rawData is a SyntaxNode
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
