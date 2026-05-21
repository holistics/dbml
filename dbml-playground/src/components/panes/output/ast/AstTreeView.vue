<template>
  <div class="h-full flex flex-col">
    <div
      v-if="ast !== undefined"
      class="flex-shrink-0 px-3 py-1 border-b border-gray-200 text-xs text-gray-400 flex items-center justify-between"
    >
      <span>{{ nodeCount }} nodes</span>
      <TabSettingsButton
        :show-decoration="showDecoration"
        @toggle-decoration="emit('toggle-decoration')"
      />
    </div>
    <div class="flex-1 overflow-auto">
      <div
        v-if="ast === undefined"
        class="text-center text-gray-400 py-8 text-sm"
      >
        No AST data
      </div>
      <div
        v-else
        class="ast-tree"
      >
        <AstTreeNode
          :node="rootNode"
          :selected-node="selectedNode"
          :expanded-nodes="expandedNodes"
          :level="0"
          :cursor-node-id="cursorNodeId"
          @node-click="handleNodeClick"
          @node-expand="handleNodeExpand"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, ref, inject, watch, type Ref,
} from 'vue';
import type { ProgramNode } from '@dbml/parse';
import {
  SyntaxNode,
  SyntaxToken,
} from '@dbml/parse';
import AstTreeNode, { type AstNode } from './AstTreeNode.vue';
import TabSettingsButton from '../tabs/common/TabSettingsButton.vue';
import { getNameHint } from '@/services/serializers/utils';

const {
  ast = undefined,
  showDecoration = false,
} = defineProps<{
  ast?: ProgramNode;
  showDecoration?: boolean;
}>();

const emit = defineEmits<{
  'node-click': [node: AstNode];
  'toggle-decoration': [];
}>();

// Node count

const COUNT_SKIP = new Set(['parentNode', 'parent', 'symbol', 'referee', 'source', 'filepath']);

function countNodes (obj: unknown, seen = new WeakSet()): number {
  if (!obj || typeof obj !== 'object') return 0;
  if (seen.has(obj as object)) return 0;
  seen.add(obj as object);
  if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countNodes(item, seen), 0);
  const isNode = Object.prototype.hasOwnProperty.call(obj, 'kind');
  const childSum = Object.entries(obj as Record<string, unknown>)
    .filter(([k]) => !COUNT_SKIP.has(k))
    .reduce((sum, [, v]) => sum + countNodes(v, seen), 0);
  return (isNode ? 1 : 0) + childSum;
}

const nodeCount = computed(() => countNodes(ast));

// Tree state

const selectedNode = ref<AstNode | null>(null);
const expandedNodes = ref<Set<string>>(new Set(['root']));

watch(() => ast, () => {
  expandedNodes.value = new Set(['root']);
});

// Cursor tracking

const cursorPos = inject<Ref<{
  line: number;
  column: number;
}> | undefined>('dbmlCursorPos', undefined);

const cursorNodeId = computed(() => {
  if (!cursorPos?.value) return undefined;
  const {
    line, column,
  } = cursorPos.value;
  return findNodeAtPosition(rootNode.value, line, column);
});

function findNodeAtPosition (node: AstNode, line: number, col: number): string | undefined {
  const d = node.rawData as Record<string, unknown> | null | undefined;
  const sp = d?.startPos as Record<string, unknown> | null | undefined;
  const ep = d?.endPos as Record<string, unknown> | null | undefined;
  if (sp && ep && typeof sp.line === 'number' && !Number.isNaN(sp.line)) {
    const sl = (sp.line as number) + 1, sc = (sp.column as number) + 1;
    const el = (ep.line as number) + 1, ec = (ep.column as number) + 1;
    const inside = (line > sl || (line === sl && col >= sc)) && (line < el || (line === el && col <= ec));
    if (!inside) return undefined;
  }
  for (const child of node.children) {
    const found = findNodeAtPosition(child, line, col);
    if (found) return found;
  }
  return node.id;
}

// AST transformation

const rootNode = computed(() => {
  if (!ast) {
    return {
      id: 'root',
      propertyName: 'ast',
      rawData: undefined,
      children: [],
      accessPath: 'ast',
      nameHint: undefined,
    } as AstNode;
  }
  return transformToAstNode(ast, 'ast', 'ast');
});

function sortStart (n: AstNode): number {
  const d = n.rawData;
  if (d instanceof SyntaxNode || d instanceof SyntaxToken) return d.start;
  if (Array.isArray(d)) {
    let m = Infinity;
    for (const item of d) {
      if (item instanceof SyntaxNode || item instanceof SyntaxToken) {
        if (item.start < m) m = item.start;
      }
    }
    return m;
  }
  return Infinity;
}

function transformToAstNode (
  data: unknown,
  propertyName: string,
  accessPath: string,
  seen = new WeakSet<object>(),
): AstNode {
  const nodeId = `${accessPath}_${propertyName}`;

  if (data === null || data === undefined || typeof data !== 'object') {
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      value: data,
      children: [],
      accessPath,
      nameHint: undefined,
    };
  }

  if (seen.has(data)) {
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      value: data,
      children: [],
      accessPath,
      nameHint: undefined,
    };
  }
  seen.add(data);

  if (Array.isArray(data)) {
    const items = data.filter((item): item is SyntaxNode | SyntaxToken =>
      item instanceof SyntaxNode || item instanceof SyntaxToken,
    );
    const children: AstNode[] = items.map((item, index) =>
      transformToAstNode(item, `[${index}]`, `${accessPath}[${index}]`, seen),
    );
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      children,
      accessPath,
      nameHint: undefined,
    };
  }

  const children: AstNode[] = [];
  const SKIP = new Set(['parent', 'parentNode', 'symbol', 'referee', 'source', 'filepath', '__proto__']);

  for (const [key, value] of Object.entries(data)) {
    if (SKIP.has(key) || value === undefined) continue;
    if (value instanceof SyntaxNode || value instanceof SyntaxToken) {
      children.push(transformToAstNode(value, key, `${accessPath}.${key}`, seen));
    } else if (Array.isArray(value)) {
      const items = value.filter((v): v is SyntaxNode | SyntaxToken =>
        v instanceof SyntaxNode || v instanceof SyntaxToken,
      );
      if (items.length > 0) {
        children.push(transformToAstNode(items, key, `${accessPath}.${key}`, seen));
      }
    }
  }

  children.sort((a, b) => sortStart(a) - sortStart(b));

  const nameHint = (data instanceof SyntaxNode || data instanceof SyntaxToken)
    ? getNameHint(data) || undefined
    : undefined;

  return {
    id: nodeId,
    propertyName,
    rawData: data,
    children,
    accessPath,
    nameHint,
  };
}

// Auto-expand ancestors when cursor moves
watch(cursorNodeId, (targetId) => {
  if (!targetId) return;
  const path = findPathToNode(rootNode.value, targetId);
  if (path) {
    for (const id of path) expandedNodes.value.add(id);
  }
});

function findPathToNode (node: AstNode, targetId: string): string[] | null {
  if (node.id === targetId) return [node.id];
  for (const child of node.children) {
    const found = findPathToNode(child, targetId);
    if (found) return [node.id, ...found];
  }
  return null;
}

const handleNodeClick = (node: AstNode) => {
  selectedNode.value = node;
  emit('node-click', node);
};

const handleNodeExpand = (event: {
  id: string;
  expanded: boolean;
}) => {
  if (event.expanded) {
    expandedNodes.value.add(event.id);
  } else {
    expandedNodes.value.delete(event.id);
  }
};

defineExpose({
  expandAll: () => {
    const allNodeIds = new Set<string>();
    function collectNodeIds (node: AstNode) {
      allNodeIds.add(node.id);
      node.children.forEach(collectNodeIds);
    }
    collectNodeIds(rootNode.value);
    expandedNodes.value = allNodeIds;
  },
  collapseAll: () => {
    expandedNodes.value = new Set(['root']);
  },
  expandToLevel: (level: number) => {
    const ids = new Set<string>();
    function collect (node: AstNode, currentLevel: number) {
      if (currentLevel <= level) {
        ids.add(node.id);
        node.children.forEach((child) => collect(child, currentLevel + 1));
      }
    }
    collect(rootNode.value, 0);
    expandedNodes.value = ids;
  },
});
</script>

<style scoped>
.ast-tree {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}
</style>
