<template>
  <div class="semantic-node">
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div v-else class="w-4 h-4 mr-1"></div>

      <!-- Node Icon and Name -->
      <span class="flex-1 flex items-center min-w-0">
        <ASTIcon :type="node.icon" class="mr-2" />
        <span class="font-medium text-gray-800 truncate">{{ node.displayName }}</span>
      </span>

      <!-- Source Position Badge -->
      <span
        v-if="node.sourcePosition"
        class="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded"
        :title="getTooltipText(node.sourcePosition)"
      >
        {{ node.sourcePosition.start.line }}:{{ node.sourcePosition.start.column }}
      </span>

    </div>

    <!-- Children -->
    <div v-if="isExpanded && hasChildren" class="children">
      <SemanticTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-node="selectedNode"
        :expanded-nodes="expandedNodes"
        :level="level + 1"
        @node-click="$emit('node-click', $event)"
        @node-expand="$emit('node-expand', $event)"
        @property-click="$emit('property-click', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Semantic Tree Node Component
 *
 * Renders an individual semantic AST node with interactive features,
 * expandable children, and property inspection.
 */
import { computed } from 'vue'
import { type SemanticASTNode } from '@/core/ast-transformer'
import ASTIcon from './ASTIcon.vue'

interface Props {
  readonly node: SemanticASTNode
  readonly selectedNode: SemanticASTNode | null
  readonly expandedNodes: Set<string>
  readonly level: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'node-click': [node: SemanticASTNode]
  'node-expand': [{ id: string; expanded: boolean }]
  'property-click': [{ node: SemanticASTNode; property: string; value: any }]
}>()

const isSelected = computed(() => props.selectedNode?.id === props.node.id)
const isExpanded = computed(() => props.expandedNodes.has(props.node.id))
const hasChildren = computed(() => props.node.children.length > 0)

// Removed filteredProperties - no longer needed

const handleNodeClick = () => {
  emit('node-click', props.node)
}

const toggleExpanded = () => {
  emit('node-expand', {
    id: props.node.id,
    expanded: !isExpanded.value
  })
}

const getTooltipText = (sourcePosition: any) => {
  let tooltip = `Line ${sourcePosition.start.line}, Column ${sourcePosition.start.column}\nOffset: ${sourcePosition.start.offset}-${sourcePosition.end.offset}`
  
  // Only add parser node info if it actually exists
  if (sourcePosition.raw?.id) {
    tooltip += `\nParser Node ID: ${sourcePosition.raw.id}`
  }
  if (sourcePosition.raw?.kind) {
    tooltip += `\nParser Node Kind: ${sourcePosition.raw.kind}`
  }
  
  return tooltip
}

// Removed property-related functions - no longer needed
</script>

<style scoped>
.semantic-node {
  user-select: none;
}

.node-header {
  transition: all 0.2s ease;
}

.node-header:hover {
  background-color: rgba(59, 130, 246, 0.05);
}

.property {
  transition: background-color 0.2s ease;
}

.property:hover {
  background-color: rgba(59, 130, 246, 0.05);
}

.properties {
  border-left: 2px solid #e5e7eb;
  background-color: #fafafa;
  border-radius: 4px;
}
</style>