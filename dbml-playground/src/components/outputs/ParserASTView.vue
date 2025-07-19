<template>
  <div class="h-full flex flex-col">
    <!-- Top Controls Bar -->
    <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h3 class="text-sm font-medium text-gray-700">AST Debugger</h3>
          <div class="text-xs text-gray-500">
            {{ nodeCount }} nodes
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <!-- View Mode Toggle (2-way) -->
          <div class="flex items-center space-x-1">
            <button
              @click="setViewMode('ast')"
              class="px-2 py-1 text-xs font-medium rounded transition-colors"
              :class="viewMode === 'ast' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
            >
              AST Tree
            </button>
            <button
              @click="setViewMode('json')"
              class="px-2 py-1 text-xs font-medium rounded transition-colors"
              :class="viewMode === 'json' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
            >
              Raw JSON
            </button>
          </div>

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
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Tree View -->
      <div class="flex-1 overflow-auto">
        <!-- AST Tree View -->
        <div v-if="viewMode === 'ast'" class="p-4">
          <RawASTTreeView
            :raw-a-s-t="rawAST"
            @node-click="handleRawNodeClick"
            @position-click="handleRawPositionClick"
          />
        </div>

        <!-- Raw JSON View -->
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


    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Parser AST View Component
 *
 * Provides AST visualization for debugging parser and analyzer stages.
 * Focuses on raw AST structure inspection with tree view and JSON view.
 *
 * Design Principles Applied:
 * - Deep Module: Rich functionality with simple interface
 * - Single Responsibility: Only handles AST visualization and navigation
 * - Maintainable: Generic structure that adapts to parser evolution
 */
import { computed, ref, inject } from 'vue'
import RawASTTreeView from './ast/RawASTTreeView.vue'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import type { TokenNavigationEventBus } from '@/core/token-navigation'

interface Props {
  readonly ast: unknown
}

const props = defineProps<Props>()

// Define emits for parent component communication
const emit = defineEmits<{
  'navigate-to-source': [position: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } }]
}>()

// Inject services
const tokenNavigationBus = inject<TokenNavigationEventBus>('tokenNavigationBus')
const tokenNavigationCoordinator = inject<any>('tokenNavigationCoordinator')

// No services needed for simple AST view

// Component state
const viewMode = ref<'ast' | 'json'>('ast')
const copySuccess = ref(false)

// Computed properties
const rawAST = computed(() => props.ast)

const rawASTJson = computed(() => {
  return rawAST.value ? JSON.stringify(rawAST.value, null, 2) : ''
})

const nodeCount = computed(() => {
  if (rawAST.value) {
    return countRawNodes(rawAST.value)
  }
  return 0
})

// Methods
const setViewMode = (mode: 'ast' | 'json') => {
  viewMode.value = mode
}

// Navigate to source position using direct Monaco editor approach
const navigateToSourcePosition = (position: any) => {
  if (!position) return

  const startLine = position.start.line
  const startColumn = position.start.column
  const endLine = position.end.line
  const endColumn = position.end.column

  // Use direct navigation approach
  if (tokenNavigationCoordinator?.dbmlEditor) {
    try {
      // Create Monaco range for full selection
      const range = { 
        startLineNumber: startLine, 
        startColumn: startColumn, 
        endLineNumber: endLine, 
        endColumn: endColumn
      }
      
      // Set selection to the full range
      tokenNavigationCoordinator.dbmlEditor.setSelection(range)
      
      // Reveal and center the range
      tokenNavigationCoordinator.dbmlEditor.revealRangeInCenter(range)
      
      // Add temporary highlight for the entire range
      const decorations = tokenNavigationCoordinator.dbmlEditor.createDecorationsCollection([
        {
          range: range,
          options: {
            className: 'token-navigation-highlight',
            inlineClassName: 'token-navigation-highlight-inline'
          }
        }
      ])
      
      // Clear highlight after 2 seconds
      setTimeout(() => {
        decorations.clear()
      }, 2000)
      
    } catch (error) {
      console.warn('Direct navigation failed:', error)
      // Fallback to emit
      emit('navigate-to-source', position)
    }
  } else {
    // Fallback to old method if coordinator not available
    emit('navigate-to-source', position)
  }
}

// Raw AST handlers - just for navigation, no selection/details
const handleRawNodeClick = (node: any) => {
  // Just navigate to position if available
  if (node.rawData?.startPos) {
    const position = {
      start: { 
        line: node.rawData.startPos.line + 1, 
        column: node.rawData.startPos.column + 1,
        offset: node.rawData.start || 0
      },
      end: { 
        line: node.rawData.endPos?.line + 1 || node.rawData.startPos.line + 1, 
        column: node.rawData.endPos?.column + 1 || node.rawData.startPos.column + 1,
        offset: node.rawData.end || node.rawData.start || 0
      }
    }
    navigateToSourcePosition(position)
  }
}

const handleRawPositionClick = (event: { node: any; position: any }) => {
  navigateToSourcePosition(event.position)
}

const copyCurrentView = async () => {
  try {
    const dataToCopy = JSON.stringify(rawAST.value, null, 2)

    await navigator.clipboard.writeText(dataToCopy)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
  }
}

// Utility functions
const countRawNodes = (obj: any): number => {
  if (!obj || typeof obj !== 'object') return 0

  let count = 1 // Count this node
  
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      count += value.reduce((sum, item) => sum + countRawNodes(item), 0)
    } else if (typeof value === 'object' && value !== null) {
      count += countRawNodes(value)
    }
  }
  
  return count
}

const getRawASTValue = (ast: any, path: string): any => {
  try {
    const pathParts = path.split('.').filter(part => part !== 'ast')
    let current = ast
    
    for (const part of pathParts) {
      if (part.includes('[') && part.includes(']')) {
        const [property, indexStr] = part.split('[')
        const index = parseInt(indexStr.replace(']', ''))
        current = current[property][index]
      } else {
        current = current[part]
      }
    }
    
    return current
  } catch (error) {
    return null
  }
}

// Expose methods for external access
defineExpose({
  setViewMode,
  copyCurrentView
})
</script>

<style scoped>
/* Component styling */
.h-full {
  height: 100%;
}

.overflow-hidden {
  overflow: hidden;
}

.overflow-auto {
  overflow: auto;
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