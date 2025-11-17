<template>
  <div class="w-full h-full overflow-hidden bg-white border border-gray-200 rounded-md">
    <div
      v-if="!data"
      class="p-4 text-gray-500 text-center"
    >
      No data to display
    </div>

    <!-- Lexer view with specialized component -->
    <div
      v-else-if="isLexerData"
      class="h-full"
    >
      <LexerView
        :tokens="tokens"
        ref="lexerViewRef"
      />
    </div>

    <!-- AST view for parser/analyzer stages -->
    <div
      v-else-if="isASTData"
      class="h-full"
    >
      <ParserASTView
        :ast="transformedData"
        ref="astViewRef"
        @navigate-to-source="handleNavigateToSource"
      />
    </div>

    <!-- Semantic view for interpreter output -->
    <div
      v-else-if="isInterpreterData"
      class="h-full"
    >
      <InterpreterView
        :interpreter-output="transformedData"
      />
    </div>

    <!-- Regular JSON display for other parser stages -->
    <div
      v-else
      class="h-full"
    >
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
import { computed, ref } from 'vue';
import MonacoEditor from '@/components/editors/MonacoEditor.vue';
import LexerView from './LexerView.vue';
import ParserASTView from './ParserASTView.vue';
import InterpreterView from './InterpreterView.vue';
import type { Token, ParserOutputViewerProps, NavigationPosition } from '@/types';

const props = defineProps<ParserOutputViewerProps>();

// Define emits for navigation events
const emit = defineEmits<{
  'navigate-to-source': [position: NavigationPosition];
}>();

// Reference to LexerView component for navigation coordination
const lexerViewRef = ref<InstanceType<typeof LexerView> | null>(null);

// Reference to ParserASTView component for AST navigation
const astViewRef = ref<InstanceType<typeof ParserASTView> | null>(null);

/**
 * Transform data for display
 */
const transformedData = computed(() => {
  if (props.data === null || props.data === undefined) {
    return null;
  }

  if (typeof props.data === 'object') {
    return props.data;
  }

  if (typeof props.data === 'string') {
    try {
      return JSON.parse(props.data);
    } catch {
      return { value: props.data };
    }
  }

  return { value: props.data };
});

/**
 * Check if data contains lexer tokens
 */
const isLexerData = computed(() => {
  const data = transformedData.value;
  return Array.isArray(data)
    && data.length > 0
    && typeof data[0] === 'object'
    && 'kind' in data[0]
    && 'value' in data[0]
    && 'position' in data[0];
});

/**
 * Check if data contains AST structure
 */
const isASTData = computed(() => {
  const data = transformedData.value;
  return typeof data === 'object'
    && data !== null
    && !Array.isArray(data)
    && ('body' in data || 'kind' in data);
});

/**
 * Check if data contains interpreter output (Database JSON Model)
 */
const isInterpreterData = computed(() => {
  const data = transformedData.value;
  return typeof data === 'object'
    && data !== null
    && !Array.isArray(data)
  // Interpreter output has database model structure
    && ('tables' in data || 'enums' in data || 'refs' in data || 'project' in data)
  // Make sure it's not AST data
    && !('body' in data || 'kind' in data);
});

/**
 * Get tokens array when data is lexer tokens
 */
const tokens = computed((): Token[] => {
  if (!isLexerData.value) return [];
  return transformedData.value as Token[];
});

/**
 * Get formatted JSON string for Monaco editor
 */
const transformedDataString = computed(() => {
  return transformedData.value ? JSON.stringify(transformedData.value, null, 2) : '';
});

/**
 * Scroll to a specific token (called from navigation coordinator)
 * Delegates to LexerView component
 */
const scrollToToken = (tokenIndex: number) => {
  if (lexerViewRef.value && isLexerData.value) {
    lexerViewRef.value.scrollToToken(tokenIndex);
  }
};

/**
 * Highlight a specific token (called from navigation coordinator)
 * Delegates to LexerView component
 */
const highlightToken = (tokenIndex: number) => {
  if (lexerViewRef.value && isLexerData.value) {
    lexerViewRef.value.highlightToken(tokenIndex);
  }
};

/**
 * Highlight multiple tokens (called from navigation coordinator)
 * Delegates to LexerView component
 */
const highlightTokens = (tokenIndices: number[]) => {
  if (lexerViewRef.value && isLexerData.value) {
    lexerViewRef.value.highlightTokens(tokenIndices);
  }
};

/**
 * Get current view mode from LexerView (called from navigation coordinator)
 */
const getViewMode = (): 'cards' | 'json' => {
  if (lexerViewRef.value && isLexerData.value) {
    return lexerViewRef.value.getViewMode?.() || 'cards';
  }
  return 'cards';
};

/**
 * Set view mode on LexerView (called from navigation coordinator)
 */
const setViewMode = (mode: 'cards' | 'json'): void => {
  if (lexerViewRef.value && isLexerData.value) {
    lexerViewRef.value.setViewMode?.(mode);
  }
};

/**
 * Handle navigate to source event from AST view
 */
const handleNavigateToSource = (position: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } }) => {
  emit('navigate-to-source', position);
};

// Expose methods for the navigation coordinator
defineExpose({
  scrollToToken,
  highlightToken,
  highlightTokens,
  getViewMode,
  setViewMode,
});
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
