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
      @position-click="$emit('position-click', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Raw AST Tree View Component
 *
 * Transforms the raw AST from the parser into a proper tree structure
 * that preserves the actual parser hierarchy and shows all properties
 * like body, callee, args, etc. for debugging purposes.
 */
import { computed, ref, inject, watch, type Ref } from 'vue';
import type { NavigationPosition } from '@/types';
import type { ProgramNode } from '@dbml/parse';
import RawAstTreeNode, { type RawAstNode } from './RawAstTreeNode.vue';

interface Props {
  readonly rawAst: ProgramNode;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'node-click': [node: RawAstNode];
  'position-click': [{ node: RawAstNode; position: NavigationPosition }];
}>();

const selectedNode = ref<RawAstNode | null>(null);
const expandedNodes = ref<Set<string>>(new Set(['root']));

// Reset expanded state when AST changes to avoid stale node IDs accumulating
watch(() => props.rawAst, () => {
  expandedNodes.value = new Set(['root']);
});
const cursorPos = inject<Ref<{ line: number; column: number }> | undefined>('dbmlCursorPos', undefined);

// Find AST node id that contains cursor position
const cursorNodeId = computed(() => {
  if (!cursorPos?.value) return undefined;
  const { line, column } = cursorPos.value;
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
const handleNodeExpand = (event: { id: string; expanded: boolean }) => {
  if (event.expanded) {
    expandedNodes.value.add(event.id);
  } else {
    expandedNodes.value.delete(event.id);
  }
};

// Transform any value into a RawAstNode
function transformToRawAstNode (data: unknown, propertyName: string, accessPath: string): RawAstNode {
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

  // Handle arrays
  if (Array.isArray(data)) {
    const children: RawAstNode[] = data.map((item, index) =>
      transformToRawAstNode(item, `[${index}]`, `${accessPath}[${index}]`),
    );

    return {
      id: nodeId,
      propertyName: `${propertyName} (${data.length})`,
      rawData: data,
      children,
      accessPath,
    };
  }

  // Handle objects - show all properties
  const children: RawAstNode[] = [];

  // Sort properties to show important ones first
  const entries = Object.entries(data);
  const sortedEntries = entries.sort(([keyA], [keyB]) => {
    // Priority order for common AST properties
    const priority = [
      'kind', 'type', 'name', 'value', 'token',
      'body', 'callee', 'args', 'leftExpression', 'rightExpression', 'op',
      'startPos', 'endPos', 'start', 'end', 'position',
      'id', 'fullStart', 'fullEnd',
    ];

    const priorityA = priority.indexOf(keyA);
    const priorityB = priority.indexOf(keyB);

    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB;
    }
    if (priorityA !== -1) return -1;
    if (priorityB !== -1) return 1;

    return keyA.localeCompare(keyB);
  });

  for (const [key, value] of sortedEntries) {
    // Skip some internal properties that are not useful for debugging
    if (shouldSkipProperty(key, value)) {
      continue;
    }

    const childPath = `${accessPath}.${key}`;
    const child = transformToRawAstNode(value, key, childPath);
    children.push(child);
  }

  return {
    id: nodeId,
    propertyName,
    rawData: data,
    children,
    accessPath,
  };
}

// Determine if a property should be skipped in the tree view
function shouldSkipProperty (key: string, value: unknown): boolean {
  // Skip undefined values
  if (value === undefined) {
    return true;
  }

  const skipProperties = [
    'parent', 'parentNode', 'symbol', 'referee', '__proto__',
    'startPos', 'endPos', 'start', 'end', 'fullStart', 'fullEnd', 'kind',
  ];

  return skipProperties.includes(key);
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
