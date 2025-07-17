<template>
  <div class="w-full h-full overflow-hidden bg-white border border-gray-200 rounded-md">
    <div v-if="!data" class="p-4 text-gray-500 text-center">
      No data to display
    </div>

    <!-- Lexer view with specialized component -->
    <div v-else-if="isLexerData" class="h-full">
      <LexerView
        :tokens="tokens"
        ref="lexerViewRef"
      />
    </div>

    <!-- Regular JSON display for other parser stages -->
    <div v-else class="h-full">
      <MonacoEditor
        :model-value="transformedDataString"
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
 * Parser Output Viewer
 *
 * A specialized viewer for different parser pipeline stages. Automatically detects
 * the data type and renders appropriately:
 * - Lexer tokens: Uses LexerView with token cards and raw JSON
 * - Other stages: Uses Monaco JSON editor
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles parser output display
 * - Information Hiding: Stage detection logic is encapsulated
 * - Shallow Module: Simple interface that delegates to specialized components
 */
import { computed, ref } from 'vue'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import LexerView from './LexerView.vue'

interface Props {
  readonly data: unknown
  readonly title?: string
}

interface Token {
  kind: string
  value: string
  position: {
    line: number
    column: number
  }
}

const props = defineProps<Props>()

// Reference to LexerView component for navigation coordination
const lexerViewRef = ref<InstanceType<typeof LexerView> | null>(null)

/**
 * Transform data for display
 */
const transformedData = computed(() => {
  if (props.data === null || props.data === undefined) {
    return null
  }

  if (typeof props.data === 'object') {
    return props.data
  }

  if (typeof props.data === 'string') {
    try {
      return JSON.parse(props.data)
    } catch {
      return { value: props.data }
    }
  }

  return { value: props.data }
})

/**
 * Check if data contains lexer tokens
 */
const isLexerData = computed(() => {
  const data = transformedData.value
  return Array.isArray(data) &&
         data.length > 0 &&
         typeof data[0] === 'object' &&
         'kind' in data[0] &&
         'value' in data[0] &&
         'position' in data[0]
})

/**
 * Get tokens array when data is lexer tokens
 */
const tokens = computed((): Token[] => {
  if (!isLexerData.value) return []
  return transformedData.value as Token[]
})

/**
 * Get formatted JSON string for Monaco editor
 */
const transformedDataString = computed(() => {
  return transformedData.value ? JSON.stringify(transformedData.value, null, 2) : ''
})

/**
 * Scroll to a specific token (called from navigation coordinator)
 * Delegates to LexerView component
 */
const scrollToToken = (tokenIndex: number) => {
  if (lexerViewRef.value && isLexerData.value) {
    lexerViewRef.value.scrollToToken(tokenIndex)
  }
}

/**
 * Highlight a specific token (called from navigation coordinator)
 * Delegates to LexerView component
 */
const highlightToken = (tokenIndex: number) => {
  if (lexerViewRef.value && isLexerData.value) {
    lexerViewRef.value.highlightToken(tokenIndex)
  }
}

/**
 * Highlight multiple tokens (called from navigation coordinator)
 * Delegates to LexerView component
 */
const highlightTokens = (tokenIndices: number[]) => {
  if (lexerViewRef.value && isLexerData.value) {
    lexerViewRef.value.highlightTokens(tokenIndices)
  }
}

// Expose methods for the navigation coordinator
defineExpose({
  scrollToToken,
  highlightToken,
  highlightTokens
})
</script>

<style scoped>
/* Container styling */
.overflow-hidden {
  /* Ensure proper containment */
}

/* For non-lexer JSON content */
.h-full {
  height: 100%;
}
</style>