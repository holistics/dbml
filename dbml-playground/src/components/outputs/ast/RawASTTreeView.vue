<template>
  <div class="raw-ast-tree">
    <RawASTTreeNode
      :node="rootNode"
      :selected-node="selectedNode"
      :expanded-nodes="expandedNodes"
      :level="0"
      @node-click="$emit('node-click', $event)"
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
import { computed, ref } from 'vue'
import RawASTTreeNode, { type RawASTNode } from './RawASTTreeNode.vue'

interface Props {
  readonly rawAST: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'node-click': [node: RawASTNode]
  'position-click': [{ node: RawASTNode; position: any }]
}>()

const selectedNode = ref<RawASTNode | null>(null)
const expandedNodes = ref<Set<string>>(new Set(['root']))

// Transform raw AST into tree structure
const rootNode = computed(() => {
  return transformToRawASTNode(props.rawAST, 'ast', 'ast')
})

// Handle node expansion
const handleNodeExpand = (event: { id: string; expanded: boolean }) => {
  if (event.expanded) {
    expandedNodes.value.add(event.id)
  } else {
    expandedNodes.value.delete(event.id)
  }
}

// Transform any value into a RawASTNode
function transformToRawASTNode(data: any, propertyName: string, accessPath: string): RawASTNode {
  const nodeId = `${accessPath}_${propertyName}`

  if (data === null || data === undefined) {
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      value: data,
      children: [],
      accessPath
    }
  }

  // Handle primitive values
  if (typeof data !== 'object') {
    return {
      id: nodeId,
      propertyName,
      rawData: data,
      value: data,
      children: [],
      accessPath
    }
  }

  // Handle arrays
  if (Array.isArray(data)) {
    const children: RawASTNode[] = data.map((item, index) =>
      transformToRawASTNode(item, `[${index}]`, `${accessPath}[${index}]`)
    )

    return {
      id: nodeId,
      propertyName: `${propertyName} (${data.length})`,
      rawData: data,
      children,
      accessPath
    }
  }

  // Handle objects - show all properties
  const children: RawASTNode[] = []

  // Sort properties to show important ones first
  const entries = Object.entries(data)
  const sortedEntries = entries.sort(([keyA], [keyB]) => {
    // Priority order for common AST properties
    const priority = [
      'kind', 'type', 'name', 'value', 'token',
      'body', 'callee', 'args', 'leftExpression', 'rightExpression', 'op',
      'startPos', 'endPos', 'start', 'end', 'position',
      'id', 'fullStart', 'fullEnd'
    ]

    const priorityA = priority.indexOf(keyA)
    const priorityB = priority.indexOf(keyB)

    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB
    }
    if (priorityA !== -1) return -1
    if (priorityB !== -1) return 1

    return keyA.localeCompare(keyB)
  })

  for (const [key, value] of sortedEntries) {
    // Skip some internal properties that are not useful for debugging
    if (shouldSkipProperty(key, value)) {
      continue
    }

    const childPath = `${accessPath}.${key}`
    const child = transformToRawASTNode(value, key, childPath)
    children.push(child)
  }

  return {
    id: nodeId,
    propertyName,
    rawData: data,
    children,
    accessPath
  }
}

// Determine if a property should be skipped in the tree view
function shouldSkipProperty(key: string, value: any): boolean {
  // Skip undefined values
  if (value === undefined) {
    return true
  }

  // Skip some internal parser properties that aren't useful for debugging
  const skipProperties = [
    'parent', // Circular reference
    'symbol', // Internal symbol reference
    'referee', // Internal reference
    '__proto__' // JavaScript internal
  ]

  return skipProperties.includes(key)
}

// Watch for node clicks to update selection
const handleNodeClick = (node: RawASTNode) => {
  selectedNode.value = node
  emit('node-click', node)
}

// Expose methods for external control
defineExpose({
  expandAll: () => {
    // Find all node IDs and expand them
    const allNodeIds = new Set<string>()

    function collectNodeIds(node: RawASTNode) {
      allNodeIds.add(node.id)
      node.children.forEach(collectNodeIds)
    }

    collectNodeIds(rootNode.value)
    expandedNodes.value = allNodeIds
  },

  collapseAll: () => {
    expandedNodes.value = new Set(['root'])
  },

  expandToLevel: (level: number) => {
    const expandToLevel = new Set<string>()

    function collectNodeIdsToLevel(node: RawASTNode, currentLevel: number) {
      if (currentLevel <= level) {
        expandToLevel.add(node.id)
        node.children.forEach(child => collectNodeIdsToLevel(child, currentLevel + 1))
      }
    }

    collectNodeIdsToLevel(rootNode.value, 0)
    expandedNodes.value = expandToLevel
  }
})
</script>

<style scoped>
.raw-ast-tree {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}
</style>