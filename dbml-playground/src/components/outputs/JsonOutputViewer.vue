<template>
  <div class="h-full flex flex-col">
    <!-- Header with Copy Button -->
    <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-700">{{ title }}</h3>

        <!-- Copy Button -->
        <button
          @click="copyToClipboard"
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

    <!-- Monaco JSON Editor -->
    <div class="flex-1 overflow-hidden">
      <MonacoEditor
        :model-value="jsonContent"
        language="json"
        :read-only="true"
        :minimap="false"
        word-wrap="on"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * JSON Output Viewer Component
 *
 * A consistent component for displaying JSON output with copy functionality.
 * Used across Parser, Analyzer, and Interpreter stages for UI consistency.
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles JSON display and copy functionality
 * - Consistency: Provides uniform appearance across all JSON output stages
 * - Deep Module: Rich functionality with simple interface
 */
import { ref } from 'vue'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import consoleLogger from '@/utils/logger';

interface Props {
  readonly jsonContent: string
  readonly title: string
}

const props = defineProps<Props>()

// Component state
const copySuccess = ref(false)

/**
 * Copy JSON content to clipboard
 */
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.jsonContent)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    consoleLogger.error('Failed to copy JSON to clipboard:', err)
  }
}
</script>

<style scoped>
/* Ensure Monaco editor takes full height */
.flex-1 {
  min-height: 0;
}
</style>