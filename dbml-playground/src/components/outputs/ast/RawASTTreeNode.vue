<template>
  <div class="raw-ast-node">
    <!-- Node Header -->
    <div
      class="node-header flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer rounded text-xs"
      :class="{
        'bg-blue-100 border-l-2 border-blue-500': isSelected,
        'pl-2': level === 0,
        'pl-4': level === 1,
        'pl-6': level === 2,
        'pl-8': level === 3,
        'pl-10': level >= 4
      }"
      @click="handleNodeClick"
    >
      <!-- Expand/Collapse Icon -->
      <button
        v-if="hasChildren"
        @click.stop="toggleExpanded"
        class="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center hover:bg-gray-200 rounded"
      >
        <svg
          class="w-3 h-3 transition-transform"
          :class="{ 'rotate-90': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      <div
        v-else
        class="w-4 h-4 mr-1"
      />

      <!-- Property Name and Type Info -->
      <span class="flex-1 flex items-center min-w-0">
        <span class="font-medium text-gray-700 mr-2">{{ node.propertyName }}</span>
        <span class="text-gray-500 text-xs mr-2">{{ getNodeTypeDescription() }}</span>
        <span
          v-if="node.value !== undefined && typeof node.value !== 'object'"
          class="text-green-700 bg-green-50 px-1 rounded text-xs max-w-32 truncate"
        >
          {{ String(node.value) }}
        </span>
      </span>

      <!-- Position Badge -->
      <span
        v-if="hasPosition"
        @click.stop="handlePositionClick"
        class="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200"
        :title="getPositionTooltip()"
      >
        {{ formatPosition() }}
      </span>

      <!-- Parser Node ID Badge -->
      <span
        v-if="node.rawData?.id"
        class="ml-1 px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
        :title="`Parser Node ID: ${node.rawData.id}`"
      >
        #{{ node.rawData.id }}
      </span>
    </div>

    <!-- Children -->
    <div
      v-if="isExpanded && hasChildren"
      class="children"
    >
      <RawASTTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-node="selectedNode"
        :expanded-nodes="expandedNodes"
        :level="level + 1"
        @node-click="$emit('node-click', $event)"
        @node-expand="$emit('node-expand', $event)"
        @position-click="$emit('position-click', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Raw AST Tree Node Component
 *
 * Displays the actual raw AST structure for debugging purposes.
 * Shows real parser properties like body, callee, args, kind, etc.
 * Preserves the original AST hierarchy without artificial semantic grouping.
 */
import { computed } from 'vue';

export interface RawASTNode {
  id: string;
  propertyName: string;
  rawData: any;
  value?: any;
  children: RawASTNode[];
  accessPath: string;
}

interface Props {
  readonly node: RawASTNode;
  readonly selectedNode: RawASTNode | null;
  readonly expandedNodes: Set<string>;
  readonly level: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'node-click': [node: RawASTNode];
  'node-expand': [{ id: string; expanded: boolean }];
  'position-click': [{ node: RawASTNode; position: any }];
}>();

const isSelected = computed(() => props.selectedNode?.id === props.node.id);
const isExpanded = computed(() => props.expandedNodes.has(props.node.id));
const hasChildren = computed(() => props.node.children.length > 0);

// Check if node has position information
const hasPosition = computed(() => {
  const data = props.node.rawData;
  return data && (
    (data.startPos && data.endPos)
    || (data.start !== undefined && data.end !== undefined)
    || (data.position)
  );
});

const handleNodeClick = () => {
  emit('node-click', props.node);
};

const toggleExpanded = () => {
  emit('node-expand', {
    id: props.node.id,
    expanded: !isExpanded.value,
  });
};

const handlePositionClick = () => {
  if (hasPosition.value) {
    const data = props.node.rawData;
    let position = null;

    // Extract position in various formats
    if (data.startPos && data.endPos) {
      position = {
        start: {
          line: data.startPos.line + 1,
          column: data.startPos.column + 1,
          offset: data.start || 0,
        },
        end: {
          line: data.endPos.line + 1,
          column: data.endPos.column + 1,
          offset: data.end || 0,
        },
      };
    } else if (data.position) {
      position = {
        start: {
          line: data.position.line + 1,
          column: data.position.column + 1,
          offset: 0,
        },
        end: {
          line: data.position.line + 1,
          column: data.position.column + 1,
          offset: 0,
        },
      };
    } else if (data.start !== undefined && data.end !== undefined) {
      // For nodes with just offset info, we can't navigate directly
      // but we can still emit the event for debugging
      position = {
        start: { line: 1, column: 1, offset: data.start },
        end: { line: 1, column: 1, offset: data.end },
      };
    }

    if (position) {
      emit('position-click', { node: props.node, position });
    }
  }
};

const getNodeTypeDescription = (): string => {
  const data = props.node.rawData;

  if (!data || typeof data !== 'object') {
    return typeof props.node.value;
  }

  const parts: string[] = [];

  // Show parser kind if available
  if (data.kind) {
    parts.push(`kind: ${data.kind}`);
  }

  // Show type if available
  if (data.type && typeof data.type === 'object' && data.type.value) {
    parts.push(`type: ${data.type.value}`);
  } else if (data.type && typeof data.type === 'string') {
    parts.push(`type: ${data.type}`);
  }

  // Show array length for arrays
  if (Array.isArray(data)) {
    parts.push(`array[${data.length}]`);
  } else if (data && typeof data === 'object') {
    // Show object with property count
    const propCount = Object.keys(data).length;
    parts.push(`object{${propCount}}`);
  }

  return parts.join(' · ') || 'unknown';
};

const formatPosition = (): string => {
  const data = props.node.rawData;

  if (data.startPos && data.endPos) {
    const startLine = data.startPos.line + 1;
    const startCol = data.startPos.column + 1;
    const endLine = data.endPos.line + 1;
    const endCol = data.endPos.column + 1;

    return startLine === endLine
      ? `${startLine}:${startCol}`
      : `${startLine}:${startCol}-${endLine}:${endCol}`;
  }

  if (data.position) {
    return `${data.position.line + 1}:${data.position.column + 1}`;
  }

  if (data.start !== undefined) {
    return `@${data.start}`;
  }

  return 'pos';
};

const getPositionTooltip = (): string => {
  const data = props.node.rawData;
  const lines: string[] = [];

  if (data.startPos && data.endPos) {
    lines.push(`Start: line ${data.startPos.line + 1}, col ${data.startPos.column + 1}`);
    lines.push(`End: line ${data.endPos.line + 1}, col ${data.endPos.column + 1}`);
    if (data.start !== undefined) lines.push(`Offset: ${data.start}-${data.end}`);
  } else if (data.position) {
    lines.push(`Position: line ${data.position.line + 1}, col ${data.position.column + 1}`);
  } else if (data.start !== undefined) {
    lines.push(`Offset: ${data.start}-${data.end || data.start}`);
  }

  if (data.id) {
    lines.push(`Parser Node ID: ${data.id}`);
  }

  lines.push('Click to navigate');

  return lines.join('\n');
};
</script>

<style scoped>
.raw-ast-node {
  user-select: none;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.node-header {
  transition: all 0.2s ease;
}

.node-header:hover {
  background-color: rgba(59, 130, 246, 0.05);
}
</style>
