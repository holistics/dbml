<template>
  <div class="interpreter-tree p-3">
    <InterpreterTreeNode
      :node="rootNode"
      :selected-node="selectedNode"
      :expanded-nodes="expandedNodes"
      :level="0"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
      @position-click="handlePositionClick"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Interpreter Tree View Component
 *
 * Transforms the interpreter database JSON model into a proper tree structure
 * for debugging purposes. Shows the actual interpreter output hierarchy
 * with all properties like tables, fields, refs, etc.
 */
import { computed, ref } from 'vue'
import InterpreterTreeNode from './InterpreterTreeNode.vue'
import type { Database, InterpreterTreeNode as InterpreterNode, InterpreterTreeViewProps } from '@/types'

const props = defineProps<InterpreterTreeViewProps>()

const emit = defineEmits<{
  'node-click': [node: InterpreterNode]
  'position-click': [{ node: InterpreterNode; position: any }]
}>()

const selectedNode = ref<InterpreterNode | null>(null)
const expandedNodes = ref<Set<string>>(new Set(['root']))

// Transform interpreter output into tree structure
const rootNode = computed(() => {
  return transformToInterpreterNode(props.interpreterOutput, 'database', 'database')
})

// Handle node expansion
const handleNodeExpand = (event: { id: string; expanded: boolean }) => {
  if (event.expanded) {
    expandedNodes.value.add(event.id)
  } else {
    expandedNodes.value.delete(event.id)
  }
}

// Handle node click
const handleNodeClick = (node: InterpreterNode) => {
  selectedNode.value = selectedNode.value?.id === node.id ? null : node
  emit('node-click', node)
}

// Handle position click (for future navigation features)
const handlePositionClick = (event: { node: InterpreterNode; position: any }) => {
  emit('position-click', event)
}

// Transform any value into an InterpreterTreeNode
function transformToInterpreterNode(value: any, propertyName: string, path: string): InterpreterNode {
  const nodeId = `${path}_${propertyName}`.replace(/[^a-zA-Z0-9_]/g, '_')

  if (Array.isArray(value)) {
    return {
      id: nodeId,
      propertyName,
      value: `Array[${value.length}]`,
      rawData: value,
      children: value.map((item, index) =>
        transformToInterpreterNode(item, `[${index}]`, `${path}.${propertyName}[${index}]`)
      ),
      accessPath: path,
      nodeType: 'array'
    }
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([key, val]) => val !== null && val !== undefined)

    // Create the node with token information preserved
    const node: InterpreterNode = {
      id: nodeId,
      propertyName,
      value: getObjectDisplayValue(value, propertyName),
      rawData: value,
      children: entries.map(([key, val]) =>
        transformToInterpreterNode(val, key, `${path}.${propertyName}`)
      ),
      accessPath: path,
      nodeType: getNodeType(value, propertyName)
    }

    return node
  }

  // Primitive values
  return {
    id: nodeId,
    propertyName,
    value: formatPrimitiveValue(value),
    rawData: value,
    children: [],
    accessPath: path,
    nodeType: 'primitive'
  }
}

function getObjectDisplayValue(obj: any, propertyName: string): string {
  // Special formatting for common database objects
  if (obj.name) {
    if (propertyName === 'tables' || obj.fields) {
      const fieldCount = obj.fields?.length || 0
      return `${obj.name} (${fieldCount} fields)`
    }
    if (propertyName === 'enums' || obj.values) {
      const valueCount = obj.values?.length || 0
      return `${obj.name} (${valueCount} values)`
    }
    if (propertyName === 'tableGroups' || obj.tables) {
      const tableCount = obj.tables?.length || 0
      return `${obj.name} (${tableCount} tables)`
    }
    if (propertyName === 'notes' || obj.content) {
      const contentPreview = obj.content ? obj.content.substring(0, 50) + (obj.content.length > 50 ? '...' : '') : ''
      return `${obj.name}: ${contentPreview}`
    }
    return obj.name
  }

  if (obj.type) {
    return `${obj.type}${obj.args ? `(${obj.args})` : ''}`
  }

  if (obj.endpoints) {
    return `${obj.endpoints[0] || ''} → ${obj.endpoints[1] || ''}`
  }

  // Object with properties
  const keys = Object.keys(obj).filter(key => obj[key] !== null && obj[key] !== undefined)
  return `{${keys.length} properties}`
}

function getNodeType(obj: any, propertyName: string): string {
  // Check propertyName first to avoid conflicts
  if (propertyName === 'project') return 'project'
  if (propertyName === 'tables') return 'table'
  if (propertyName === 'enums') return 'enum'
  if (propertyName === 'refs') return 'ref'
  if (propertyName === 'tableGroups') return 'tableGroup'
  if (propertyName === 'notes') return 'note'
  if (propertyName === 'fields') return 'field'
  if (propertyName === 'indexes') return 'index'
  if (propertyName === 'schemas') return 'schema'

  // Then check object structure for individual items within arrays
  if (obj.name && obj.fields) return 'table'
  if (obj.name && obj.values) return 'enum'
  if (obj.endpoints) return 'ref'
  if (obj.name && obj.tables) return 'tableGroup'
  if (obj.name && obj.content) return 'note'
  if (obj.type) return 'field'

  // Handle arrays and objects for future extensibility
  if (Array.isArray(obj)) return 'array'
  if (typeof obj === 'object' && obj !== null) return 'object'

  return 'primitive'
}

function formatPrimitiveValue(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'number') return value.toString()
  return String(value)
}
</script>

<style scoped>
.interpreter-tree {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}
</style>