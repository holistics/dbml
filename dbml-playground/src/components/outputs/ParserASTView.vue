<template>
  <div class="h-full flex flex-col">
    <!-- Top Controls Bar -->
    <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h3 class="text-sm font-medium text-gray-700">Parser AST</h3>
          <div class="text-xs text-gray-500">
            {{ nodeCount }} nodes
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <!-- View Mode Toggle -->
          <div class="flex items-center space-x-2">
            <span class="text-xs text-gray-600">Semantic</span>
            <button
              @click="toggleViewMode"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :class="viewMode === 'json' ? 'bg-blue-600' : 'bg-gray-200'"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="viewMode === 'json' ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
            <span class="text-xs text-gray-600">JSON</span>
          </div>

          <!-- Filter Button -->
          <button
            @click="showFilters = !showFilters"
            class="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
            </svg>
            <span>Filter</span>
          </button>

          <!-- Copy Button -->
          <button
            @click="copyCurrentView"
            class="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            :class="{ 'text-green-700 border-green-300 bg-green-50': copySuccess }"
          >
            <svg v-if="!copySuccess" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ copySuccess ? 'Copied!' : 'Copy' }}</span>
          </button>
        </div>
      </div>

      <!-- Filter Panel -->
      <div v-if="showFilters" class="mt-3 pt-3 border-t border-gray-200">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Search -->
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Property name or value..."
              class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Filters -->
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Hide</label>
            <div class="space-y-1">
              <label class="flex items-center">
                <input v-model="hidePositions" type="checkbox" class="mr-2 text-xs">
                <span class="text-xs text-gray-600">Position info</span>
              </label>
              <label class="flex items-center">
                <input v-model="hideInternals" type="checkbox" class="mr-2 text-xs">
                <span class="text-xs text-gray-600">Internal props</span>
              </label>
            </div>
          </div>

          <!-- Quick Actions -->
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Quick Actions</label>
            <div class="space-y-1">
              <button
                @click="expandAll"
                class="block w-full text-left px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
              >
                Expand All
              </button>
              <button
                @click="collapseAll"
                class="block w-full text-left px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Tree View -->
      <div class="flex-1 overflow-auto" :style="{ width: `${100 - detailsPanelWidth}%` }">
        <!-- Semantic View -->
        <div v-if="viewMode === 'semantic'" class="p-4">
          <SemanticTreeView
            v-if="semanticAST"
            :node="semanticAST"
            :selected-node="selectedNode"
            :expanded-nodes="expandedNodes"
            @node-click="handleNodeClick"
            @node-expand="handleNodeExpand"
            @property-click="handlePropertyClick"
          />
          <div v-else class="text-center text-gray-500 py-8">
            No semantic data available
          </div>
        </div>

        <!-- Raw AST View -->
        <div v-else class="h-full flex flex-col">
          <!-- Raw JSON Header -->
          <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
            <div class="text-xs text-gray-500">
              Raw AST JSON structure
            </div>
          </div>

          <!-- Raw JSON View -->
          <div class="flex-1 overflow-hidden">
            <MonacoEditor
              v-if="rawAST"
              :model-value="rawASTJson"
              language="json"
              :read-only="true"
              :minimap="false"
              word-wrap="on"
            />
            <div v-else class="text-center text-gray-500 py-8">
              No raw AST data available
            </div>
          </div>
        </div>
      </div>

      <!-- Resize Handle -->
      <div
        v-if="selectedNode || selectedPath"
        class="w-1 bg-gray-300 hover:bg-gray-400 cursor-col-resize transition-colors"
        @mousedown="startResize"
      ></div>

      <!-- Details Panel -->
      <div
        v-if="selectedNode || selectedPath"
        class="bg-gray-50 overflow-auto"
        :style="{ width: `${detailsPanelWidth}%`, minWidth: '250px', maxWidth: '50%' }"
      >
        <ASTDetailsPanel
          :selected-node="selectedNode"
          :selected-path="selectedPath"
          :raw-ast="rawAST"
          :access-path="currentAccessPath"
          @copy-path="copyAccessPath"
          @navigate-to-source="navigateToSource"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Parser AST View Component
 *
 * Provides dual-mode AST visualization with semantic and raw views.
 * Includes interactive navigation, filtering, and access path generation.
 *
 * Design Principles Applied:
 * - Deep Module: Rich functionality with simple interface
 * - Information Hiding: Complex AST transformation hidden from consumers
 * - Single Responsibility: Only handles AST visualization and navigation
 */
import { computed, ref, watch, onMounted } from 'vue'
import { ASTTransformerService, type SemanticASTNode, type AccessPath, type FilterOptions } from '@/core/ast-transformer'
import SemanticTreeView from './ast/SemanticTreeView.vue'
import ASTDetailsPanel from './ast/ASTDetailsPanel.vue'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'

interface Props {
  readonly ast: unknown
}

const props = defineProps<Props>()

// Define emits for parent component communication
const emit = defineEmits<{
  'navigate-to-source': [position: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } }]
}>()

// Services
const transformer = new ASTTransformerService()

// Component state
const viewMode = ref<'semantic' | 'json'>('semantic')
const showFilters = ref(false)
const selectedNode = ref<SemanticASTNode | null>(null)
const selectedPath = ref<string | null>(null)
const expandedNodes = ref<Set<string>>(new Set())
const copySuccess = ref(false)

// Resize state
const detailsPanelWidth = ref(35) // Default 35% width
const isResizing = ref(false)

// Filter state
const searchTerm = ref('')
const hidePositions = ref(true)
const hideInternals = ref(true)

// Computed properties
const rawAST = computed(() => props.ast)

const semanticAST = computed(() => {
  if (!rawAST.value) return null
  try {
    return transformer.transformToSemantic(rawAST.value)
  } catch (error) {
    console.error('Error transforming AST to semantic:', error)
    return null
  }
})

const filterOptions = computed((): FilterOptions => ({
  hidePositions: hidePositions.value,
  hideInternalProps: hideInternals.value,
  showOnlyNodeTypes: [],
  searchTerm: searchTerm.value
}))

const filteredRawAST = computed(() => {
  if (!rawAST.value) return null
  return transformer.filterRawAST(rawAST.value, filterOptions.value)
})

const rawASTJson = computed(() => {
  // In JSON mode, show the truly raw, unfiltered AST (like other stages)
  return rawAST.value ? JSON.stringify(rawAST.value, null, 2) : ''
})

const nodeCount = computed(() => {
  if (viewMode.value === 'semantic' && semanticAST.value) {
    return countSemanticNodes(semanticAST.value)
  } else if (rawAST.value) {
    return countRawNodes(rawAST.value)
  }
  return 0
})

const currentAccessPath = computed((): AccessPath | null => {
  if (selectedNode.value && selectedPath.value) {
    return transformer.generateAccessPath(selectedNode.value, selectedPath.value, null)
  }
  return null
})

// Methods
const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'semantic' ? 'json' : 'semantic'
  // Clear selection when switching modes
  selectedNode.value = null
  selectedPath.value = null
}

const handleNodeClick = (node: SemanticASTNode) => {
  selectedNode.value = node
  selectedPath.value = node.accessPath || ''
}

const handleNodeExpand = (nodeId: string, expanded: boolean) => {
  if (expanded) {
    expandedNodes.value.add(nodeId)
  } else {
    expandedNodes.value.delete(nodeId)
  }
}

const handlePropertyClick = (node: SemanticASTNode, property: string, value: any) => {
  selectedNode.value = node
  selectedPath.value = `${node.accessPath}.${property}`
}



const expandAll = () => {
  if (viewMode.value === 'semantic' && semanticAST.value) {
    expandAllSemanticNodes(semanticAST.value, expandedNodes.value)
  }
}

const collapseAll = () => {
  expandedNodes.value.clear()
}

const copyCurrentView = async () => {
  try {
    const dataToCopy = viewMode.value === 'semantic'
      ? JSON.stringify(semanticAST.value, null, 2)
      : JSON.stringify(filteredRawAST.value, null, 2)

    await navigator.clipboard.writeText(dataToCopy)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
  }
}

const copyAccessPath = async (path: AccessPath) => {
  try {
    const pathText = `Raw: ${path.raw}\nValue: ${JSON.stringify(path.value)}`
    await navigator.clipboard.writeText(pathText)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy access path:', err)
  }
}

const navigateToSource = (position: any) => {
  // Emit event for parent component to handle source navigation
  if (position && position.start && position.end) {
    emit('navigate-to-source', position)
  }
}

// Resize functionality
const startResize = (event: MouseEvent) => {
  isResizing.value = true
  const startX = event.clientX
  const startWidth = detailsPanelWidth.value

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return

    const containerWidth = (event.target as HTMLElement).parentElement?.clientWidth || 1000
    const deltaX = e.clientX - startX
    const deltaPercent = (deltaX / containerWidth) * 100

    // Calculate new width (moving right increases panel width, moving left decreases it)
    const newWidth = Math.max(15, Math.min(50, startWidth - deltaPercent))
    detailsPanelWidth.value = newWidth
  }

  const handleMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  event.preventDefault()
}

// Utility functions
const countSemanticNodes = (node: SemanticASTNode): number => {
  let count = 1
  node.children.forEach(child => {
    count += countSemanticNodes(child)
  })
  return count
}

const countRawNodes = (obj: any): number => {
  if (typeof obj !== 'object' || obj === null) return 0

  let count = 1
  Object.values(obj).forEach(value => {
    if (typeof value === 'object' && value !== null) {
      count += countRawNodes(value)
    }
  })
  return count
}

const expandAllSemanticNodes = (node: SemanticASTNode, expandedSet: Set<string>) => {
  expandedSet.add(node.id)
  node.children.forEach(child => {
    expandAllSemanticNodes(child, expandedSet)
  })
}



// Initialize with some default expanded nodes
onMounted(() => {
  if (semanticAST.value) {
    expandedNodes.value.add(semanticAST.value.id)
  }
})

// Watch for AST changes and auto-expand root
watch(semanticAST, (newAST) => {
  if (newAST) {
    expandedNodes.value.add(newAST.id)
  }
})

// Expose methods for external access
defineExpose({
  toggleViewMode,
  expandAll,
  collapseAll,
  getSelectedNode: () => selectedNode.value,
  getSelectedPath: () => selectedPath.value
})
</script>

<style scoped>
/* Tree view styling */
.tree-node {
  transition: all 0.2s ease-in-out;
}

.tree-node:hover {
  background-color: rgba(59, 130, 246, 0.05);
}

.tree-node.selected {
  background-color: rgba(59, 130, 246, 0.1);
  border-left: 3px solid #3b82f6;
}

/* Filter panel animations */
.filter-panel-enter-active,
.filter-panel-leave-active {
  transition: all 0.3s ease;
}

.filter-panel-enter-from,
.filter-panel-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Scrollbar styling */
.overflow-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>