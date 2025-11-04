<template>
  <div class="ast-details-panel h-full flex flex-col">
    <!-- Header -->
    <div class="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
      <h3 class="text-sm font-medium text-gray-900">
        Node Details
      </h3>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4 space-y-4">
      <!-- Selected Node Info -->
      <div
        v-if="selectedNode"
        class="section"
      >
        <h4 class="text-xs font-medium text-gray-700 mb-2">
          Selected Node
        </h4>
        <div class="bg-gray-50 rounded-lg p-3 space-y-3">
          <!-- Node Header -->
          <div class="flex items-center">
            <span class="mr-2">{{ selectedNode.icon }}</span>
            <span class="font-medium text-gray-800">{{ selectedNode.displayName }}</span>
          </div>

          <!-- Basic Info -->
          <div class="text-xs text-gray-600 space-y-1">
            <div><span class="font-medium">Type:</span> {{ selectedNode.type }}</div>
            <!-- Only show Parser Node ID if it actually exists in the real AST -->
            <div v-if="realParserNodeId !== null">
              <span class="font-medium">Parser Node ID:</span> {{ realParserNodeId }}
            </div>
            <!-- Don't show anything if no real parser node ID - this is just organizational -->
          </div>

          <!-- Position & Debug Information -->
          <div
            v-if="selectedNode.sourcePosition"
            class="border-t border-gray-200 pt-2"
          >
            <div class="text-xs font-medium text-gray-700 mb-2">
              Position & Debug Info
            </div>
            <div class="text-xs text-gray-600 space-y-1">
              <!-- Position -->
              <div>
                <span class="font-medium">Position:</span>
                Line {{ selectedNode.sourcePosition.start.line }}, Column {{ selectedNode.sourcePosition.start.column }}
              </div>
              <div>
                <span class="font-medium">Offset:</span>
                {{ selectedNode.sourcePosition.start.offset }}-{{ selectedNode.sourcePosition.end.offset }}
              </div>

              <!-- Raw AST Node Info - Only show if values actually exist -->
              <div v-if="selectedNode.sourcePosition.raw?.id">
                <span class="font-medium">Node ID:</span> {{ selectedNode.sourcePosition.raw.id }}
              </div>
              <div v-if="selectedNode.sourcePosition.raw?.kind">
                <span class="font-medium">Kind:</span> {{ selectedNode.sourcePosition.raw.kind }}
              </div>

              <!-- Token Info -->
              <div
                v-if="selectedNode.sourcePosition.token"
                class="border-t border-gray-300 pt-1 mt-1"
              >
                <div class="font-medium text-gray-700 mb-1">
                  Token Information
                </div>
                <div><span class="font-medium">Token Kind:</span> {{ selectedNode.sourcePosition.token.kind || 'none' }}</div>
                <div v-if="selectedNode.sourcePosition.token.value">
                  <span class="font-medium">Token Value:</span> "{{ selectedNode.sourcePosition.token.value }}"
                </div>
                <div v-if="selectedNode.sourcePosition.token.leadingTrivia || selectedNode.sourcePosition.token.trailingTrivia">
                  <span class="font-medium">Trivia:</span>
                  Leading: {{ selectedNode.sourcePosition.token.leadingTrivia?.length || 0 }},
                  Trailing: {{ selectedNode.sourcePosition.token.trailingTrivia?.length || 0 }}
                </div>
                <div v-if="selectedNode.sourcePosition.token.isInvalid">
                  <span class="font-medium text-red-600">Invalid Token</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      <!-- Access Path -->
      <div
        v-if="selectedNode?.accessPath"
        class="section"
      >
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-medium text-gray-700">
            JavaScript Access Path
          </h4>
          <button
            @click="copySelectedNodeAccessPath"
            class="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            :class="{ 'text-green-700 border-green-300 bg-green-50': copyAccessPathSuccess }"
            title="Copy JavaScript access path"
          >
            <svg
              v-if="!copyAccessPathSuccess"
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <svg
              v-else
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{{ copyAccessPathSuccess ? 'Copied!' : 'Copy' }}</span>
          </button>
        </div>
        <div class="bg-slate-100 rounded-lg p-4 border border-slate-300 shadow-inner">
          <code class="font-mono text-sm text-slate-700 break-all leading-relaxed select-all">{{ selectedNode.accessPath }}</code>
        </div>
      </div>

      <!-- Raw AST Data - Collapsible -->
      <div
        v-if="selectedNode && (selectedNode.data || selectedNode.accessPath) && selectedNode.type !== 'database'"
        class="section"
      >
        <div class="flex items-center justify-between mb-2">
          <button
            @click="showRawAst = !showRawAst"
            class="flex items-center space-x-2 text-xs font-medium text-gray-700 hover:text-gray-900"
          >
            <svg
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-90': showRawAst }"
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
            <span>{{ selectedNode.data ? 'Parser AST Data' : 'Node JSON' }}</span>
          </button>
          <button
            v-if="showRawAst"
            @click="copyNodeJson"
            class="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            :class="{ 'text-green-700 border-green-300 bg-green-50': copyJsonSuccess }"
            title="Copy node as JSON"
          >
            <svg
              v-if="!copyJsonSuccess"
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <svg
              v-else
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{{ copyJsonSuccess ? 'Copied!' : 'Copy' }}</span>
          </button>
        </div>
        <div
          v-if="showRawAst"
          class="bg-slate-50 rounded-lg overflow-hidden border border-slate-200 shadow-sm"
          :style="{ height: `${jsonViewerHeight}px` }"
        >
          <MonacoEditor
            :model-value="nodeJson"
            language="json"
            :read-only="true"
            :minimap="false"
            word-wrap="on"
            :options="{
              fontSize: 12,
              lineNumbers: 'on',
              folding: true,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              theme: 'vs',
              padding: { top: 8, bottom: 8 },
              lineNumbersMinChars: 3,
              glyphMargin: false,
              renderLineHighlight: 'none'
            }"
          />
          <!-- Resize Handle for JSON Viewer -->
          <div
            class="w-full h-1 bg-gray-300 hover:bg-gray-400 cursor-row-resize transition-colors"
            @mousedown="startJsonResize"
          />
        </div>
      </div>

      <!-- Source Navigation -->
      <div
        v-if="selectedNode?.sourcePosition"
        class="section"
      >
        <h4 class="text-xs font-medium text-gray-700 mb-2">
          Source Location
        </h4>
        <button
          @click="navigateToSource"
          class="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <svg
            class="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Go to Source
        </button>
      </div>

      <!-- AST Statistics & Debugging Info -->
      <div
        v-if="selectedNode?.type === 'database'"
        class="section"
      >
        <h4 class="text-xs font-medium text-gray-700 mb-2">
          AST Statistics
        </h4>
        <div class="bg-slate-50 rounded-lg p-3 text-xs text-gray-600 space-y-2">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="font-medium">Total Elements:</span>
              <span class="ml-1">{{ getASTStats().totalElements }}</span>
            </div>
            <div>
              <span class="font-medium">Element Types:</span>
              <span class="ml-1">{{ getASTStats().uniqueTypes }}</span>
            </div>
          </div>
          <div class="border-t border-gray-200 pt-2">
            <div class="font-medium mb-1">
              Element Breakdown:
            </div>
            <div class="space-y-1">
              <div
                v-for="[type, count] in getASTStats().typeBreakdown"
                :key="type"
                class="flex justify-between"
              >
                <span class="capitalize">{{ type }}:</span>
                <span>{{ count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AST Details Panel Component
 *
 * Shows detailed information about selected AST nodes including
 * access paths, properties, and navigation options.
 */
import { computed, ref, inject } from 'vue'
import type { SemanticASTNode, AccessPath } from '@/core/ast-transformer'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import type { TokenNavigationEventBus } from '@/core/token-navigation'
import consoleLogger from '@/utils/logger'

interface Props {
  readonly selectedNode: SemanticASTNode | null
  readonly selectedPath: string | null
  readonly rawAst: any
  readonly accessPath: AccessPath | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'copy-path': [path: AccessPath]
  'navigate-to-source': [position: any]
}>()

// Inject the token navigation system (like in LexerView)
const tokenNavigationBus = inject<TokenNavigationEventBus>('tokenNavigationBus')
// Also inject the coordinator for direct navigation
const tokenNavigationCoordinator = inject<any>('tokenNavigationCoordinator')

const nodeJson = computed(() => {
  if (!props.selectedNode) return ''

  // Priority 1: Show the raw parser data stored in the semantic node
  if (props.selectedNode.data) {
    return JSON.stringify(props.selectedNode.data, null, 2)
  }

  // Priority 2: For nodes with access paths, show the raw AST node
  if (props.selectedNode.accessPath && props.rawAst) {
    const rawNode = getRawASTNode(props.rawAst, props.selectedNode.accessPath)
    if (rawNode) {
      return JSON.stringify(rawNode, null, 2)
    }
  }

  // Priority 3: For organizational nodes (like group nodes), show minimal semantic info
  // but exclude internal Vue-specific fields
  const cleanSemanticNode = {
    type: props.selectedNode.type,
    name: props.selectedNode.name,
    displayName: props.selectedNode.displayName,
    accessPath: props.selectedNode.accessPath,
    childrenCount: props.selectedNode.children.length
  }
  return JSON.stringify(cleanSemanticNode, null, 2)
})

const realParserNodeId = computed(() => {
  if (!props.selectedNode?.sourcePosition?.raw?.id) return null
  return props.selectedNode.sourcePosition.raw.id
})

// JSON viewer resize state
const jsonViewerHeight = ref(360) // Default height - increased for better JSON viewing
const isJsonResizing = ref(false)

// Copy success states
const copyAccessPathSuccess = ref(false)
const copyJsonSuccess = ref(false)

// UI state
const showRawAst = ref(false) // Collapsed by default

// Removed currentValue, nodeProperties, shouldShowProperty, getValueType, and formatValue - no longer needed

const copySelectedNodeAccessPath = async () => {
  if (!props.selectedNode?.accessPath) return
  try {
    await navigator.clipboard.writeText(props.selectedNode.accessPath)
    copyAccessPathSuccess.value = true
    setTimeout(() => {
      copyAccessPathSuccess.value = false
    }, 2000)
  } catch (err) {
    consoleLogger.error('Failed to copy access path:', err)
  }
}

const copyNodeJson = async () => {
  if (!props.selectedNode) return

  try {
    // Use the same logic as nodeJson computed property
    const jsonToCopy = nodeJson.value
    await navigator.clipboard.writeText(jsonToCopy)
    copyJsonSuccess.value = true
    setTimeout(() => {
      copyJsonSuccess.value = false
    }, 2000)
  } catch (err) {
    consoleLogger.error('Failed to copy node JSON:', err)
  }
}

// Helper function to get raw AST node using access path
const getRawASTNode = (rawAst: any, accessPath: string): any => {
  if (!accessPath || !rawAst) return null

  try {
    // Parse the access path (e.g., "body[0]" or "body[0].body.body[1]")
    // Remove 'ast.' prefix if present
    const path = accessPath.replace(/^ast\./, '')

    // Split by dots and evaluate each part
    const parts = path.split('.')
    let current = rawAst

    for (const part of parts) {
      if (part.includes('[') && part.includes(']')) {
        // Handle array access like "body[0]"
        const [property, indexStr] = part.split('[')
        const index = parseInt(indexStr.replace(']', ''))

        if (property) {
          current = current[property]
        }
        if (Array.isArray(current) && !isNaN(index)) {
          current = current[index]
        }
      } else {
        // Handle simple property access
        current = current[part]
      }

      if (current === undefined || current === null) {
        return null
      }
    }

    return current
  } catch (err) {
    consoleLogger.error('Failed to parse access path:', accessPath, err)
    return null
  }
}

// JSON viewer resize functionality
const startJsonResize = (event: MouseEvent) => {
  isJsonResizing.value = true
  const startY = event.clientY
  const startHeight = jsonViewerHeight.value

  const handleMouseMove = (e: MouseEvent) => {
    if (!isJsonResizing.value) return

    const deltaY = e.clientY - startY
    // Moving down increases height, moving up decreases height
    const newHeight = Math.max(150, Math.min(800, startHeight + deltaY))
    jsonViewerHeight.value = newHeight
  }

  const handleMouseUp = () => {
    isJsonResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  event.preventDefault()
}

const navigateToSource = () => {
  if (props.selectedNode?.sourcePosition) {
    emit('navigate-to-source', props.selectedNode.sourcePosition)
  }
}

// Handle clicking on position/location text to navigate to source
const handleLocationClick = (locationText: string) => {
  // Extract range from text like "line 1:2 → 5:10 (click to navigate)" or "line 1:2 (click to navigate)"
  const rangeMatch = locationText.match(/line (\d+):(\d+) → (\d+):(\d+)/)
  const singleMatch = locationText.match(/line (\d+):(\d+)/)

  if (rangeMatch) {
    // Handle full range navigation
    const startLine = parseInt(rangeMatch[1])
    const startColumn = parseInt(rangeMatch[2])
    const endLine = parseInt(rangeMatch[3])
    const endColumn = parseInt(rangeMatch[4])

    navigateToRange(startLine, startColumn, endLine, endColumn)
  } else if (singleMatch) {
    // Handle single position navigation
    const line = parseInt(singleMatch[1])
    const column = parseInt(singleMatch[2])

    navigateToPosition(line, column)
  }
}

// Navigate to a single position
const navigateToPosition = (line: number, column: number) => {
  // Direct navigation approach using the coordinator's methods
  if (tokenNavigationCoordinator?.dbmlEditor) {
    try {
      // Create Monaco position (1-indexed)
      const position = { lineNumber: line, column: column }

      // Set cursor position
      tokenNavigationCoordinator.dbmlEditor.setPosition(position)

      // Reveal and center the position
      const range = {
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: column + 1
      }
      tokenNavigationCoordinator.dbmlEditor.revealRangeInCenter(range)

      // Add temporary highlight
      const decorations = tokenNavigationCoordinator.dbmlEditor.createDecorationsCollection([
        {
          range: range,
          options: {
            className: 'token-navigation-highlight',
            inlineClassName: 'token-navigation-highlight-inline'
          }
        }
      ])

      // Clear highlight after 1.5 seconds
      setTimeout(() => {
        decorations.clear()
      }, 1500)

    } catch (error) {
      consoleLogger.warn('Direct navigation failed:', error)
      // Fallback to emit
      const position = {
        start: { line, column, offset: 0 },
        end: { line, column, offset: 0 }
      }
      emit('navigate-to-source', position)
    }
  } else {
    // Fallback to old method if coordinator not available
    const position = {
      start: { line, column, offset: 0 },
      end: { line, column, offset: 0 }
    }
    emit('navigate-to-source', position)
  }
}

// Navigate to a full range (multi-line selection)
const navigateToRange = (startLine: number, startColumn: number, endLine: number, endColumn: number) => {
  // Direct navigation approach using the coordinator's methods
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

      // Clear highlight after 2 seconds (longer for ranges)
      setTimeout(() => {
        decorations.clear()
      }, 2000)

    } catch (error) {
      consoleLogger.warn('Direct range navigation failed:', error)
      // Fallback to emit
      const position = {
        start: { line: startLine, column: startColumn, offset: 0 },
        end: { line: endLine, column: endColumn, offset: 0 }
      }
      emit('navigate-to-source', position)
    }
  } else {
    // Fallback to old method if coordinator not available
    const position = {
      start: { line: startLine, column: startColumn, offset: 0 },
      end: { line: endLine, column: endColumn, offset: 0 }
    }
    emit('navigate-to-source', position)
  }
}

// AST Statistics for debugging
const getASTStats = () => {
  if (!props.rawAst?.body) {
    return { totalElements: 0, uniqueTypes: 0, typeBreakdown: [] }
  }

  const typeCounts: Record<string, number> = {}
  let totalElements = 0

  const countElements = (elements: any[]) => {
    elements.forEach((element: any) => {
      if (element?.type?.value) {
        const type = element.type.value.toLowerCase()
        typeCounts[type] = (typeCounts[type] || 0) + 1
        totalElements++
      }
    })
  }

  countElements(props.rawAst.body)

  const typeBreakdown = Object.entries(typeCounts).sort(([,a], [,b]) => b - a)

  return {
    totalElements,
    uniqueTypes: Object.keys(typeCounts).length,
    typeBreakdown
  }
}




</script>

<style scoped>
.ast-details-panel {
  background-color: #fafafa;
}

.section {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.section:last-child {
  border-bottom: none;
  padding-bottom: 0;
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