<template>
  <div class="semantic-tree">
    <SemanticTreeNode
      :node="node"
      :selected-node="selectedNode"
      :expanded-nodes="expandedNodes"
      :level="0"
      @node-click="$emit('node-click', $event)"
      @node-expand="$emit('node-expand', $event.id, $event.expanded)"
      @property-click="$emit('property-click', $event.node, $event.property, $event.value)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Semantic Tree View Component
 *
 * Displays the AST in a semantic, domain-meaningful structure with
 * visual icons and intuitive organization.
 */
import { type SemanticASTNode } from '@/core/ast-transformer'
import SemanticTreeNode from './SemanticTreeNode.vue'

interface Props {
  readonly node: SemanticASTNode
  readonly selectedNode: SemanticASTNode | null
  readonly expandedNodes: Set<string>
}

defineProps<Props>()

defineEmits<{
  'node-click': [node: SemanticASTNode]
  'node-expand': [nodeId: string, expanded: boolean]
  'property-click': [node: SemanticASTNode, property: string, value: any]
}>()
</script>

<style scoped>
.semantic-tree {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}
</style>