<template>
  <div class="raw-ast-tree">
    <RawAstTreeNode
      :node="rootNode"
      :selected-node="selectedNode"
      :expanded-nodes="expandedNodes"
      :level="0"
      :cursor-node-id="cursorNodeId"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed, ref, inject, watch, type Ref,
} from 'vue';
import type {
  ProgramNode,
} from '@dbml/parse';
import RawAstTreeNode, {
  type RawAstNode,
} from './RawAstTreeNode.vue';

interface Props {
  readonly rawAst: ProgramNode;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'node-click': [node: RawAstNode];
}>();

const selectedNode = ref<RawAstNode | null>(null);
const expandedNodes = ref<Set<string>>(new Set(['root']));

// Reset expanded state when AST changes to avoid stale node IDs accumulating
watch(() => props.rawAst, () => {
  expandedNodes.value = new Set(['root']);
});
const cursorPos = inject<Ref<{ line: number;
  column: number; }> | undefined>('dbmlCursorPos', undefined);

// Find AST node id that contains cursor position
const cursorNodeId = computed(() => {
  if (!cursorPos?.value) return undefined;
  const {
    line, column,
  } = cursorPos.value;
  return findNodeAtPosition(rootNode.value, line, column);
});

function findNodeAtPosition (node: RawAstNode, line: number, col: number): string | undefined {
  const d = node.rawData as Record<string, unknown> | null | undefined;
  const sp = d?.startPos as Record<string, unknown> | null | undefined;
  const ep = d?.endPos as Record<string, unknown> | null | undefined;
  if (sp && ep && typeof sp.line === 'number' && !Number.isNaN(sp.line)) {
    const sl = (sp.line as number) + 1, sc = (sp.column as number) + 1;
    const el = (ep.line as number) + 1, ec = (ep.column as number) + 1;
    const inside = (line > sl || (line === sl && col >= sc)) && (line < el || (line === el && col <= ec));
    if (!inside) return undefined;
  }
  // Check children for more specific match
  for (const child of node.children) {
    const found = findNodeAtPosition(child, line, col);
    if (found) return found;
  }
  return node.id;
}

// Transform raw AST into tree structure
const rootNode = computed(() => {
  return transformToRawAstNode(props.rawAst, 'ast', 'ast');
});

// Handle node expansion
const handleNodeExpand = (event: { id: string;
  expanded: boolean; }) => {
  if (event.expanded) {
    expandedNodes.value.add(event.id);
  } else {
    expandedNodes.value.delete(event.id);
  }
};

// Transform any value into a RawAstNode (with cycle detection via seen WeakSet)
function transformToRawAstNode (
  data: unknown,
  propertyName: string,
  accessPath: string,
  seen = new WeakSet<object>(),
): RawAstNode {
  const nodeId = `${accessPath}_${propertyName}`;

  if (data === null || data === undefined) {
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      value: data,
      children: [],
      accessPath,
    };
  }

  // Handle primitive values
  if (typeof data !== 'object') {
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      value: data,
      children: [],
      accessPath,
    };
  }

  // Cycle / diamond detection: render already-visited objects as leaf stubs
  if (seen.has(data)) {
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      value: data,
      children: [],
      accessPath,
    };
  }
  seen.add(data);

  // Handle arrays — only keep syntax-node items
  if (Array.isArray(data)) {
    const nodeItems = data.filter(isSyntaxNode);
    const children: RawAstNode[] = nodeItems.map((item, index) =>
      transformToRawAstNode(item, `[${index}]`, `${accessPath}[${index}]`, seen),
    );
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      children,
      accessPath,
    };
  }

  // Handle objects — only recurse into properties that lead to syntax nodes
  const children: RawAstNode[] = [];
  const SKIP = new Set(['parent', 'parentNode', 'symbol', 'referee', 'source', 'filepath', '__proto__']);

  for (const [key, value] of Object.entries(data)) {
    if (SKIP.has(key) || value === undefined) continue;
    if (isSyntaxNode(value)) {
      children.push(transformToRawAstNode(value, key, `${accessPath}.${key}`, seen));
    } else if (Array.isArray(value) && value.some(isSyntaxNode)) {
      children.push(transformToRawAstNode(value, key, `${accessPath}.${key}`, seen));
    }
  }

  return {
    id: nodeId,
    propertyName,
    rawData: data,
    children,
    accessPath,
  };
}

function isSyntaxNode (data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return typeof (data as Record<string, unknown>).kind === 'string';
}

// Auto-expand ancestors when cursorNodeId changes so the active node is visible
watch(cursorNodeId, (targetId) => {
  if (!targetId) return;
  const path = findPathToNode(rootNode.value, targetId);
  if (path) {
    for (const id of path) expandedNodes.value.add(id);
  }
});

function findPathToNode (node: RawAstNode, targetId: string): string[] | null {
  if (node.id === targetId) return [node.id];
  for (const child of node.children) {
    const found = findPathToNode(child, targetId);
    if (found) return [node.id, ...found];
  }
  return null;
}

// Watch for node clicks to update selection
const handleNodeClick = (node: RawAstNode) => {
  selectedNode.value = node;
  emit('node-click', node);
};

// Expose methods for external control
defineExpose({
  expandAll: () => {
    // Find all node IDs and expand them
    const allNodeIds = new Set<string>();

    function collectNodeIds (node: RawAstNode) {
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
    const expandToLevel = new Set<string>();

    function collectNodeIdsToLevel (node: RawAstNode, currentLevel: number) {
      if (currentLevel <= level) {
        expandToLevel.add(node.id);
        node.children.forEach((child) => collectNodeIdsToLevel(child, currentLevel + 1));
      }
    }

    collectNodeIdsToLevel(rootNode.value, 0);
    expandedNodes.value = expandToLevel;
  },
});
</script>

<style scoped>
.raw-ast-tree {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}
</style>
