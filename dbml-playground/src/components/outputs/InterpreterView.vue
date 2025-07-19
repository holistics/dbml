<template>
  <div class="h-full flex flex-col">
    <!-- Top Controls Bar -->
    <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h3 class="text-sm font-medium text-gray-700">Interpreter Debugger</h3>
          <div v-if="databaseModel" class="text-xs text-gray-500">
            Database JSON Model
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <!-- View Mode Toggle (2-way) -->
          <div class="flex items-center space-x-1">
            <button
              @click="setViewMode('tree')"
              class="px-2 py-1 text-xs font-medium rounded transition-colors"
              :class="viewMode === 'tree' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
            >
              Tree
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

    <!-- Content Area -->
    <div class="flex-1 overflow-hidden">
      <div v-if="!databaseModel" class="text-center text-gray-500 py-8">
        No data available
      </div>

      <!-- Tree Debugger View -->
      <div v-if="viewMode === 'tree'" class="h-full flex flex-col">
        <!-- Tree Header -->
        <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
          <div class="text-xs text-gray-500">
            Interpreter Database JSON Tree Structure
          </div>
        </div>

        <!-- Tree View -->
        <div class="flex-1 overflow-hidden">
          <InterpreterTreeView
            v-if="databaseModel"
            :interpreter-output="databaseModel"
            @node-click="handleTreeNodeClick"
            @position-click="handleTreePositionClick"
          />
          <div v-else class="text-center text-gray-500 py-8">
            No database model data available
          </div>
        </div>
      </div>

      <!-- Raw JSON View -->
      <div v-else class="h-full flex flex-col">
        <!-- JSON Header -->
        <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
          <div class="text-xs text-gray-500">
            Interpreter Database JSON Model
          </div>
        </div>

        <!-- Monaco JSON Editor -->
        <div class="flex-1 overflow-hidden">
          <MonacoEditor
            v-if="databaseModel"
            :model-value="jsonString"
            language="json"
            :read-only="true"
            :minimap="false"
            word-wrap="on"
          />
          <div v-else class="text-center text-gray-500 py-8">
            No database model data available
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Interpreter Semantic View Component
 *
 * Displays the interpreted database model in a user-friendly way.
 * This view is based on the interpreter output (Database JSON Model)
 * rather than raw AST, making it more stable and maintainable.
 *
 * Generic design allows it to handle new features added to dbml-parse
 * without breaking when the parser structure evolves.
 */
import { computed, ref } from 'vue'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import InterpreterTreeView from './ast/InterpreterTreeView.vue'
import type { Database, InterpreterViewProps } from '@/types'

const props = defineProps<InterpreterViewProps>()

// Component state
const viewMode = ref<'tree' | 'json'>('tree')
const copySuccess = ref(false)

// Parse the interpreter output
const databaseModel = computed(() => {
  if (!props.interpreterOutput || typeof props.interpreterOutput !== 'object') {
    return null
  }
  return props.interpreterOutput as Database
})

// View mode and copy functionality
const jsonString = computed(() => {
  return databaseModel.value ? JSON.stringify(databaseModel.value, null, 2) : ''
})

const setViewMode = (mode: 'tree' | 'json') => {
  viewMode.value = mode
}

const copyCurrentView = async () => {
  try {
    const dataToCopy = jsonString.value

    await navigator.clipboard.writeText(dataToCopy)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
  }
}

// Tree view handlers
const handleTreeNodeClick = (node: any) => {
  console.log('Tree node clicked:', node)
}

const handleTreePositionClick = (event: { node: any; position: any }) => {
  console.log('Tree position clicked:', event)
}
</script>

<style scoped>
.section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.section-title {
  background: #f9fafb;
  padding: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.item-card {
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: all 0.2s ease;
}

.item-card:hover {
  background-color: #f9fafb;
}

.item-card:last-child {
  border-bottom: none;
}

.item-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-details {
  padding: 0 1rem 1rem 1rem;
  background: #fafafa;
  border-top: 1px solid #f3f4f6;
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field-item {
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.field-item:hover {
  border-color: #d1d5db;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.badge-primary {
  background: #fef3c7;
  color: #92400e;
}

.badge-blue {
  background: #dbeafe;
  color: #1e40af;
}

.badge-orange {
  background: #fed7aa;
  color: #c2410c;
}

.badge-green {
  background: #dcfce7;
  color: #166534;
}

.badge-purple {
  background: #e9d5ff;
  color: #7c3aed;
}
</style>