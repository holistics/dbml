<template>
  <div class="interpreter-node">
    <!-- Node Header -->
    <div
      class="node-header flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer rounded"
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

      <!-- Node Icon and Name -->
      <span class="flex-1 flex items-center min-w-0">
        <ASTIcon
          v-if="getIconType()"
          :type="getIconType()"
          :icon-class="getIconClass()"
          class="mr-2"
        />
        <span class="text-xs text-gray-500 mr-2">{{ node.propertyName }}:</span>
        <span class="font-medium text-gray-800 truncate">{{ node.value }}</span>
      </span>

      <!-- Position Navigation Button (right-aligned) -->
      <span
        v-if="hasPosition"
        @click.stop="handlePositionClick"
        class="ml-auto px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 transition-colors flex-shrink-0"
        title="Click to navigate to source position"
      >
        {{ formatPosition() }}
      </span>

      <!-- Node Type Badge -->
      <span
        v-if="node.nodeType && node.nodeType !== 'primitive'"
        class="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
        :title="`Node type: ${node.nodeType}`"
      >
        {{ node.nodeType }}
      </span>
    </div>

    <!-- Children -->
    <div
      v-if="isExpanded && hasChildren"
      class="children"
    >
      <InterpreterTreeNode
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
 * Interpreter Tree Node Component
 *
 * Displays individual nodes in the interpreter tree structure.
 * Shows database objects like tables, fields, enums, etc. with proper icons and formatting.
 */
import { computed, inject } from 'vue';
import ASTIcon from './ASTIcon.vue';
import type { TokenNavigationEventBus } from '@/core/token-navigation';
import type { InterpreterTreeNode, InterpreterTreeNodeProps } from '@/types';
import consoleLogger from '@/utils/logger';

const props = defineProps<InterpreterTreeNodeProps>();

const emit = defineEmits<{
  'node-click': [node: InterpreterTreeNode];
  'node-expand': [{ id: string; expanded: boolean }];
  'position-click': [{ node: InterpreterTreeNode; position: any }];
}>();

// Inject navigation services (same as ParserASTView)
const tokenNavigationBus = inject<TokenNavigationEventBus>('tokenNavigationBus');
const tokenNavigationCoordinator = inject<any>('tokenNavigationCoordinator');

const isSelected = computed(() => props.selectedNode?.id === props.node.id);
const isExpanded = computed(() => props.expandedNodes.has(props.node.id));
const hasChildren = computed(() => props.node.children.length > 0);
const hasRawData = computed(() =>
  props.node.rawData
  && typeof props.node.rawData === 'object'
  && Object.keys(props.node.rawData).length > 0,
);

const hasPosition = computed(() => {
  return props.node.rawData?.token?.start && props.node.rawData?.token?.end;
});

const handleNodeClick = () => {
  emit('node-click', props.node);

  // Try to navigate to source position if available
  if (props.node.rawData?.token) {
    const token = props.node.rawData.token;
    const position = {
      start: {
        line: token.start.line,
        column: token.start.column,
        offset: token.start.offset,
      },
      end: {
        line: token.end.line,
        column: token.end.column,
        offset: token.end.offset,
      },
    };
    navigateToSourcePosition(position);
  }
};

const toggleExpanded = () => {
  emit('node-expand', {
    id: props.node.id,
    expanded: !isExpanded.value,
  });
};

const handleDataClick = () => {
  consoleLogger.log('Raw interpreter data:', props.node.rawData);
  consoleLogger.log('Access path:', props.node.accessPath);
};

const handlePositionClick = () => {
  if (props.node.rawData?.token) {
    const token = props.node.rawData.token;
    const position = {
      start: {
        line: token.start.line,
        column: token.start.column,
        offset: token.start.offset,
      },
      end: {
        line: token.end.line,
        column: token.end.column,
        offset: token.end.offset,
      },
    };
    navigateToSourcePosition(position);
  }
};

const formatPosition = () => {
  const token = props.node.rawData?.token;
  if (!token?.start || !token?.end) {
    return '';
  }

  const startLine = token.start.line;
  const startColumn = token.start.column;
  const endLine = token.end.line;
  const endColumn = token.end.column;

  return `${startLine}:${startColumn}-${endLine}:${endColumn}`;
};

// Navigate to source position using the simple token structure
const navigateToSourcePosition = (position: any) => {
  if (!position?.start || !position?.end) return;

  const startLine = position.start.line;
  const startColumn = position.start.column;
  const endLine = position.end.line;
  const endColumn = position.end.column;

  // Use direct navigation approach
  if (tokenNavigationCoordinator?.dbmlEditor) {
    try {
      // Create Monaco range for full selection
      const range = {
        startLineNumber: startLine,
        startColumn: startColumn,
        endLineNumber: endLine,
        endColumn: endColumn,
      };

      // Set selection to the full range
      tokenNavigationCoordinator.dbmlEditor.setSelection(range);

      // Reveal and center the range
      tokenNavigationCoordinator.dbmlEditor.revealRangeInCenter(range);

      // Add temporary highlight for the entire range
      const decorations = tokenNavigationCoordinator.dbmlEditor.createDecorationsCollection([
        {
          range: range,
          options: {
            className: 'token-navigation-highlight',
            inlineClassName: 'token-navigation-highlight-inline',
          },
        },
      ]);

      // Clear highlight after 2 seconds
      setTimeout(() => {
        decorations.clear();
      }, 2000);
    } catch (error) {
      // Fallback to emit
      emit('position-click', { node: props.node, position });
    }
  } else {
    // Fallback to old method if coordinator not available
    emit('position-click', { node: props.node, position });
  }
};

// Get appropriate icon type based on node type and content
const getIconType = (): string => {
  switch (props.node.nodeType) {
    case 'table': return 'table';
    case 'enum': return 'enum';
    case 'ref': return 'ref';
    case 'tableGroup': return 'tableGroup';
    case 'project': return 'project';
    case 'note': return 'note';
    case 'field': return getFieldIconType();
    case 'index': return 'index';
    case 'schema': return 'database';
    case 'array': return 'array';
    case 'object':
      // Root database object
      if (props.node.propertyName === 'database') return 'database';
      return 'object';
    case 'primitive': return ''; // No icon for primitive values
    default: return ''; // No icon for unknown types
  }
};

const getFieldIconType = (): string => {
  const data = props.node.rawData;
  if (data?.pk) return 'column-pk';
  if (data?.unique) return 'column-unique';
  if (data?.not_null) return 'column-required';
  return 'column';
};

// Get appropriate icon color class (matching InterpreterSemanticView)
const getIconClass = (): string => {
  switch (props.node.nodeType) {
    case 'table': return 'text-blue-600';
    case 'enum': return 'text-purple-600';
    case 'ref': return 'text-green-600';
    case 'tableGroup': return 'text-orange-600';
    case 'project': return 'text-gray-600';
    case 'note': return 'text-amber-600';
    case 'field': return getFieldIconClass();
    case 'index': return 'text-gray-500';
    case 'schema': return 'text-blue-700';
    case 'array': return 'text-indigo-600';
    case 'object':
      // Root database object
      if (props.node.propertyName === 'database') return 'text-blue-700';
      return 'text-slate-600';
    default: return 'text-gray-500';
  }
};

const getFieldIconClass = (): string => {
  const data = props.node.rawData;
  if (data?.pk) return 'text-yellow-600';
  if (data?.unique) return 'text-blue-600';
  if (data?.not_null) return 'text-red-600';
  return 'text-gray-500';
};
</script>

<style scoped>
.interpreter-node {
  user-select: none;
}

.node-header {
  transition: all 0.2s ease;
}

.node-header:hover {
  background-color: rgba(59, 130, 246, 0.05);
}
</style>
