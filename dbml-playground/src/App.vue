<template>
  <div id="app" class="h-screen flex flex-col bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-gray-900">
              DBML Parser Playground
            </h1>
            <span class="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
              Debug Tool
            </span>
            <div v-if="isLoading" class="ml-3 flex items-center">
              <div class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span class="ml-2 text-sm text-gray-500">Parsing...</span>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <a
              href="https://dbml.dbdiagram.io"
              target="_blank"
              class="text-sm text-gray-500 hover:text-gray-700"
            >
              Documentation
            </a>
            <a
              href="https://github.com/holistics/dbml"
              target="_blank"
              class="text-sm text-gray-500 hover:text-gray-700"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Input Section -->
      <div class="w-1/2 flex flex-col border-r border-gray-200">
        <div class="bg-white px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 class="text-lg font-medium text-gray-900">DBML Input</h2>
        </div>
        <div class="flex-1 p-4 overflow-hidden">
          <MonacoEditor
            v-model="dbmlInput"
            language="dbml"
            :minimap="false"
            word-wrap="on"
          />
        </div>
      </div>

      <!-- Output Section -->
      <div class="w-1/2 flex flex-col">
        <div class="bg-white px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-medium text-gray-900">Parser Pipeline</h2>
            <div class="flex space-x-1">
              <button
                v-for="stage in stages"
                :key="stage.id"
                @click="activeStage = stage.id"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  activeStage === stage.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                ]"
              >
                {{ stage.name }}
                <span v-if="stage.id === 'errors' && errors.length > 0"
                      class="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                  {{ errors.length }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex-1 p-4 overflow-hidden">
          <!-- Error Display -->
          <div v-if="activeStage === 'errors'" class="h-full overflow-auto">
            <div v-if="errors.length === 0" class="text-green-600 font-medium">
              ✅ No errors found! Your DBML is valid.
            </div>
            <div v-else class="space-y-3">
              <h3 class="font-bold text-red-600 mb-3">
                Found {{ errors.length }} error{{ errors.length > 1 ? 's' : '' }}:
              </h3>
              <div v-for="(error, index) in formatErrors(errors)" :key="index"
                   class="bg-red-50 border border-red-200 rounded-md p-3 mb-2">
                <div class="text-sm font-medium text-red-800">
                  Error {{ error.code }} at line {{ error.location.line }}, column {{ error.location.column }}
                </div>
                <div class="text-sm text-red-700 mt-1">{{ error.message }}</div>
              </div>
            </div>
          </div>

          <!-- Stage Output Display -->
          <div v-else-if="activeStage === 'interpreter'" class="h-full">
            <JsonViewer :data="getCurrentStageOutput()" />
          </div>

          <!-- Other stages with Monaco Editor for JSON -->
          <div v-else class="h-full">
            <MonacoEditor
              :model-value="getCurrentStageOutputString()"
              language="json"
              :read-only="true"
              :minimap="false"
              word-wrap="on"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useParser } from '@/composables/useParser'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import JsonViewer from '@/components/outputs/JsonViewer.vue'

// @ts-ignore: Module resolution issue with workspace dependencies
const {
  dbmlInput,
  isLoading,
  tokens,
  ast,
  analyzedAst,
  json,
  errors,
  formatTokens,
  formatAST,
  formatJSON,
  formatErrors
} = useParser()

const activeStage = ref('lexer')

const stages = [
  { id: 'lexer', name: 'Lexer' },
  { id: 'parser', name: 'Parser' },
  { id: 'analyzer', name: 'Analyzer' },
  { id: 'interpreter', name: 'Interpreter' },
  { id: 'errors', name: 'Errors' }
]

const getCurrentStageOutput = () => {
  switch (activeStage.value) {
    case 'lexer':
      return formatTokens(tokens.value)
    case 'parser':
      return formatAST(ast.value)
    case 'analyzer':
      return formatAST(analyzedAst.value)
    case 'interpreter':
      return formatJSON(json.value)
    default:
      return null
  }
}

const getCurrentStageOutputString = () => {
  const output = getCurrentStageOutput()
  return output ? JSON.stringify(output, null, 2) : 'Select a stage to view output'
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