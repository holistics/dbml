<template>
  <div class="h-screen flex flex-col bg-gray-100">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 flex-shrink-0">
      <div class="w-full px-6">
        <div class="flex justify-between items-center py-4">
          <div class="flex items-center">
            <img src="/dbml-logo.png" alt="DBML Logo" class="h-8 w-auto mr-3" />
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-gray-900">DBML Parser Playground</span>
              <span class="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {{ displayVersion === 'development' ? 'development' : `v${displayVersion}` }}
              </span>
            </div>
          </div>
          <div class="flex items-center space-x-6">
            <a
              href="https://dbml.dbdiagram.io"
              target="_blank"
              class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Documentation
            </a>
            <a
              href="https://github.com/holistics/dbml"
              target="_blank"
              class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Parser Content -->
      <div class="flex-1 flex overflow-hidden w-full">
        <!-- Input Section -->
        <div class="flex flex-col border-r border-gray-200" :style="{ width: `${mainPanelWidth}%` }">
          <div class="bg-white px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div class="flex justify-between items-start">
              <div>
                <h2 class="text-lg font-semibold text-gray-900">DBML Input</h2>
                <p class="text-sm text-gray-500 mt-1">Enter your DBML schema code below</p>
              </div>
              <!-- Vim Mode Toggle for DBML Editor -->
              <div class="flex items-center space-x-2">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="vimModeEnabled"
                    class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span class="text-sm text-gray-600">Vim Mode</span>
                </label>
              </div>
            </div>
          </div>
          <div class="flex-1 p-6 overflow-hidden bg-gray-50">
            <div class="h-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <MonacoEditor
                v-model="parser.dbmlInput.value"
                language="dbml"
                :minimap="false"
                word-wrap="on"
                :vim-mode="vimModeEnabled"
                @editor-mounted="onDbmlEditorMounted"
              />
            </div>
          </div>
        </div>

        <!-- Resize Handle -->
        <div
          class="w-1 bg-gray-300 hover:bg-gray-400 cursor-col-resize transition-colors flex-shrink-0"
          @mousedown="startMainResize"
        ></div>

        <!-- Output Section -->
        <div class="flex flex-col" :style="{ width: `${100 - mainPanelWidth}%` }">
          <div class="bg-white px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-900">Parser Pipeline</h2>
                <p class="text-sm text-gray-500 mt-1">View the output of each parsing stage</p>
              </div>
              <div class="flex bg-gray-100 rounded-lg p-1">
                <button
                  v-for="stage in PIPELINE_STAGES"
                  :key="stage.id"
                  @click="activeStage = stage.id"
                  :class="[
                    'relative px-3 py-2 text-sm font-medium rounded-md transition-all',
                    activeStage === stage.id
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  ]"
                >
                  {{ stage.name }}
                  <span v-if="stage.id === 'errors' && parser.errors.value.length > 0"
                        class="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                    {{ parser.errors.value.length }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-hidden bg-gray-50 p-6">
            <div class="h-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <!-- Error Display -->
              <div v-if="activeStage === 'errors'" class="h-full flex flex-col">
                <div class="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
                  <h3 class="text-sm font-medium text-gray-700">
                    Parse Errors ({{ parser.errors.value.length }})
                  </h3>
                </div>
                <div class="flex-1 overflow-auto p-4">
                  <div v-if="parser.errors.value.length === 0" class="text-center py-8">
                    <svg class="w-12 h-12 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <p class="text-sm text-gray-500">No parse errors</p>
                  </div>
                  <div v-else class="space-y-3">
                    <div
                      v-for="(error, index) in parser.formatErrors(parser.errors.value)"
                      :key="index"
                      class="bg-red-50 border border-red-200 rounded-lg p-4"
                    >
                      <div class="flex items-start">
                        <svg class="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div class="flex-1">
                          <p class="text-sm font-medium text-red-800">{{ error.message }}</p>
                          <p class="text-xs text-red-600 mt-1">
                            Line {{ error.location.line }}, Column {{ error.location.column }}
                          </p>
                          <p class="text-xs text-red-500 mt-1">Error Code: {{ error.code }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Interpreter stage with semantic view -->
              <div v-else-if="activeStage === 'interpreter'" class="h-full">
                <ParserOutputViewer
                  :data="getCurrentStageOutput()"
                  :title="`${getStageTitle(activeStage)} Semantic View`"
                />
              </div>

              <!-- Lexer stage with ParserOutputViewer for token navigation -->
              <div v-else-if="activeStage === 'lexer'" class="h-full">
                <ParserOutputViewer
                  :data="getCurrentStageOutput()"
                  ref="lexerViewer"
                />
              </div>

              <!-- Parser and Analyzer stages with AST debugger -->
              <div v-else-if="activeStage === 'parser' || activeStage === 'analyzer'" class="h-full">
                <ParserOutputViewer
                  :data="getCurrentStageOutput()"
                  :title="`${getStageTitle(activeStage)} AST Debugger`"
                  @navigate-to-source="handleNavigateToSource"
                />
              </div>

              <!-- Other stages with JSON Viewer -->
              <div v-else class="h-full">
                <JsonOutputViewer
                  :json-content="getCurrentStageOutputString()"
                  :title="`${getStageTitle(activeStage)} Output`"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * DBML Playground Application
 *
 * Main application component that orchestrates the playground interface.
 * This component focuses solely on UI concerns and delegates complex logic
 * to specialized modules.
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles UI orchestration
 * - Information Hiding: Business logic hidden in composables and services
 * - Shallow Module: Simple interface that coordinates deeper modules
 */
import { ref, provide, watch, onMounted } from 'vue'
import { useParser } from '@/composables/useParser'
import { useUserData } from '@/composables/useUserData'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import ParserOutputViewer from '@/components/outputs/ParserOutputViewer.vue'
import JsonOutputViewer from '@/components/outputs/JsonOutputViewer.vue'
import * as monaco from 'monaco-editor'
import { TokenMappingService } from '@/core/token-mapping'
import { TokenNavigationCoordinator } from '@/core/token-navigation'
import packageJson from '../package.json'
import type { PipelineStage } from '@/types'

// Initialize parser with clean interface
const parser = useParser()

// Initialize user data management
const { userData, updateUserData, saveDbml } = useUserData()

// Reactive state derived from user data
const vimModeEnabled = ref(userData.value.isVim)
const activeStage = ref<PipelineStage | 'errors'>(userData.value.openingTab)

// Initialize token navigation system
const tokenMapping = new TokenMappingService()
const tokenNavigationCoordinator = new TokenNavigationCoordinator(tokenMapping)

// Reference to components
let dbmlEditor: monaco.editor.IStandaloneCodeEditor | null = null
const lexerViewer = ref<InstanceType<typeof ParserOutputViewer> | null>(null)

/**
 * Handle DBML editor mounted event
 */
const onDbmlEditorMounted = (editor: monaco.editor.IStandaloneCodeEditor) => {
  dbmlEditor = editor
  tokenNavigationCoordinator.setDbmlEditor(editor)

  // Add Cmd/Ctrl+S shortcut for manual save
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveDbml(parser.dbmlInput.value)
    // Show brief save indicator
    console.log('DBML content saved to localStorage')
  })
}

/**
 * Setup lexer viewer when it's mounted
 */
watch(lexerViewer, (newViewer) => {
  if (newViewer) {
    // The ParserOutputViewer will delegate to LexerView when appropriate
    tokenNavigationCoordinator.setLexerViewer(newViewer)
  }
})

/**
 * Sync reactive state with user data
 */
watch(vimModeEnabled, (newValue) => {
  updateUserData('isVim', newValue)
})

watch(activeStage, (newValue) => {
  if (newValue !== 'errors') {
    updateUserData('openingTab', newValue)
  }
})

// Watch for changes in lexer view mode and save to user data
watch(() => lexerViewer.value?.getViewMode?.(), (newMode) => {
  if (newMode) {
    updateUserData('isRawJson', newMode === 'json')
  }
})

/**
 * Initialize DBML content from user data
 */
onMounted(() => {
  // Set initial DBML content from user data
  parser.dbmlInput.value = userData.value.dbml

  // Setup auto-save for DBML content
  let autoSaveTimeout: number | null = null

  watch(parser.dbmlInput, (newContent) => {
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
    }

    // Set new timeout for auto-save (1 second delay)
    autoSaveTimeout = window.setTimeout(() => {
      updateUserData('dbml', newContent)
    }, 1000)
  })

  // Initialize lexer view mode from user data
  watch(lexerViewer, (newViewer) => {
    if (newViewer) {
      const initialViewMode = userData.value.isRawJson ? 'json' : 'cards'
      newViewer.setViewMode?.(initialViewMode)
    }
  }, { immediate: true })
})

/**
 * Setup app state accessors for token navigation coordinator
 */
tokenNavigationCoordinator.setAppStateAccessors(
  () => activeStage.value,
  () => {
    // Get lexer view mode from the parser output viewer component
    return lexerViewer.value?.getViewMode?.() || 'cards'
  },
  (mode: string) => {
    // Set lexer view mode on the parser output viewer component
    lexerViewer.value?.setViewMode?.(mode as 'cards' | 'json')
  }
)

/**
 * Update token mapping when lexer output changes
 */
watch(() => parser.tokens.value, (newTokens) => {
  if (newTokens && Array.isArray(newTokens)) {
    tokenNavigationCoordinator.updateTokenMapping(newTokens)
  }
}, { immediate: true })

/**
 * Provide services to child components
 */
provide('tokenNavigationBus', tokenNavigationCoordinator.getEventBus())
provide('getDbmlEditor', () => dbmlEditor)
provide('tokenNavigationCoordinator', tokenNavigationCoordinator)

// UI state management
const version = packageJson.version

// Check if using workspace version (local development)
const isUsingWorkspaceVersion = packageJson.dependencies['@dbml/parse'].startsWith('workspace:')

const displayVersion = isUsingWorkspaceVersion ? 'development' : version

// Main panel resize state
const mainPanelWidth = ref(50) // Default 50% width for DBML editor
const isMainResizing = ref(false)

/**
 * Available pipeline stages for visualization
 */
const PIPELINE_STAGES = [
  { id: 'lexer' as const, name: 'Lexer', description: 'Tokenization stage' },
  { id: 'parser' as const, name: 'Parser', description: 'Syntax analysis stage' },
  { id: 'analyzer' as const, name: 'Analyzer', description: 'Semantic analysis stage' },
  { id: 'interpreter' as const, name: 'Interpreter', description: 'Code generation stage' },
  { id: 'errors' as const, name: 'Errors', description: 'Error reports' }
] as const

/**
 * Get output for the currently active stage
 */
const getCurrentStageOutput = () => {
  if (activeStage.value === 'errors') {
    return null // Errors are handled separately
  }
  return parser.getStageOutput(activeStage.value)
}

/**
 * Get formatted output string for the currently active stage
 */
const getCurrentStageOutputString = () => {
  if (activeStage.value === 'errors') {
    return 'View errors in the dedicated errors panel'
  }
  return parser.getStageOutputString(activeStage.value)
}

/**
 * Get title for the current active stage
 */
const getStageTitle = (stage: PipelineStage) => {
  const stageInfo = PIPELINE_STAGES.find(s => s.id === stage)
  return stageInfo ? stageInfo.name : stage
}

/**
 * Main panel resize functionality
 */
const startMainResize = (event: MouseEvent) => {
  isMainResizing.value = true
  const startX = event.clientX
  const startWidth = mainPanelWidth.value

  const handleMouseMove = (e: MouseEvent) => {
    if (!isMainResizing.value) return

    const containerWidth = window.innerWidth
    const deltaX = e.clientX - startX
    const deltaPercent = (deltaX / containerWidth) * 100

    // Calculate new width (moving right increases panel width, moving left decreases it)
    const newWidth = Math.max(20, Math.min(80, startWidth + deltaPercent))
    mainPanelWidth.value = newWidth
  }

  const handleMouseUp = () => {
    isMainResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  event.preventDefault()
}

/**
 * Handle navigate to source event from AST viewer
 * Highlights the corresponding DBML source code
 */
const handleNavigateToSource = (position: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } }) => {
  // Get reference to the DBML editor (MonacoEditor)
  const dbmlEditor = document.querySelector('.dbml-editor')
  if (dbmlEditor) {
    // Use Monaco editor API to highlight the specific range
    // The position is 1-based from the parser, Monaco uses 1-based as well
    const startLine = position.start.line
    const startColumn = position.start.column
    const endLine = position.end.line
    const endColumn = position.end.column

    console.log(`Navigating to source: Line ${startLine}:${startColumn} - ${endLine}:${endColumn}`)

    // TODO: Implement actual Monaco editor highlighting
    // This would require accessing the Monaco editor instance and using:
    // editor.setSelection(new monaco.Range(startLine, startColumn, endLine, endColumn))
    // editor.revealLineInCenter(startLine)
  }
}

</script>

<style>
/* Ensure proper scrolling */
html, body {
  height: 100%;
  overflow: hidden;
}

#app {
  height: 100vh;
  overflow: hidden;
}

/* Custom scrollbar for consistency */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>