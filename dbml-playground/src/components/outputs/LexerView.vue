<template>
  <div class="h-full flex flex-col">
    <!-- Top Controls Bar -->
    <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h3 class="text-sm font-medium text-gray-700">Lexer Tokens</h3>
          <div class="text-xs text-gray-500">
            {{ tokens.length }} tokens
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <!-- View Toggle Switch -->
          <div class="flex items-center space-x-2">
            <span class="text-xs text-gray-600">Cards</span>
            <button
              @click="viewMode = viewMode === 'cards' ? 'json' : 'cards'"
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
            <span>{{ copySuccess ? 'Copied!' : 'Copy JSON' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-hidden">
      <!-- Cards View -->
      <div v-if="viewMode === 'cards'" class="h-full flex flex-col">
        <!-- Cards Header -->
        <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
          <div class="text-xs text-gray-500">
            Click to navigate • ⌘+Click in DBML to find token
          </div>
        </div>

        <!-- Token Cards List -->
        <div class="flex-1 overflow-auto p-4 space-y-3">
          <div
            v-for="(token, index) in tokens"
            :key="index"
            @click="navigateToToken(index)"
            class="token-card bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all duration-200"
            :class="{ 'ring-2 ring-blue-500 bg-blue-50': highlightedTokenIndex === index }"
          >
            <div class="space-y-2">
              <!-- Token info -->
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span class="font-medium text-gray-600">Kind:</span>
                  <code class="ml-1 px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{{ token.kind }}</code>
                </div>
                <div>
                  <span class="font-medium text-gray-600">Value:</span>
                  <code class="ml-1 px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">{{ token.value }}</code>
                </div>
              </div>

              <!-- Position info -->
              <div class="text-xs text-gray-500">
                Line {{ token.position.line }}, Column {{ token.position.column }}
                <span class="mx-1">•</span>
                Range: {{ token.position.column }}-{{ token.position.column + token.value.length }}
              </div>
            </div>

            <!-- Hover indicator -->
            <div class="opacity-0 group-hover:opacity-100 transition-opacity">
              <svg class="w-4 h-4 text-blue-600 float-right mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- JSON Only View -->
      <div v-else class="h-full flex flex-col">
        <!-- JSON Header -->
        <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
          <div class="text-xs text-gray-500">
            ⌘+Click in DBML to find token
          </div>
        </div>

        <!-- Monaco JSON Editor (Full Width) -->
        <div class="flex-1 overflow-hidden">
          <MonacoEditor
            :model-value="jsonString"
            language="json"
            :read-only="true"
            :minimap="false"
            word-wrap="on"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Lexer View Component
 *
 * Specialized component for displaying lexer tokens with both card view and raw JSON.
 * Provides clickable token navigation and integrates with the token navigation system.
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles lexer token display and navigation
 * - Information Hiding: Token navigation complexity is encapsulated
 * - Deep Module: Rich functionality with simple interface
 */
import { computed, ref, inject } from 'vue'
import MonacoEditor from '@/components/editors/MonacoEditor.vue'
import type { TokenNavigationEventBus } from '@/core/token-navigation'

interface Props {
  readonly tokens: Token[]
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

// Inject the token navigation system
const tokenNavigationBus = inject<TokenNavigationEventBus>('tokenNavigationBus')

// Component state
const highlightedTokenIndex = ref<number | null>(null)
const viewMode = ref<'cards' | 'json'>('cards')
const copySuccess = ref(false)

/**
 * Convert tokens array to formatted JSON string
 */
const jsonString = computed(() => {
  return JSON.stringify(props.tokens, null, 2)
})

/**
 * Navigate to a specific token in the DBML editor
 */
const navigateToToken = (tokenIndex: number) => {
  if (!tokenNavigationBus) {
    console.warn('Token navigation bus not available')
    return
  }

  tokenNavigationBus.emit('navigate:token-to-dbml', {
    tokenIndex,
    modifier: 'button'
  })

  // Briefly highlight the clicked token
  highlightedTokenIndex.value = tokenIndex
  setTimeout(() => {
    highlightedTokenIndex.value = null
  }, 1500)
}

/**
 * Scroll to a specific token (called from navigation coordinator)
 */
const scrollToToken = (tokenIndex: number) => {
  const tokenElement = document.querySelector(`.token-card:nth-child(${tokenIndex + 1})`)
  if (tokenElement) {
    tokenElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}

/**
 * Highlight a specific token (called from navigation coordinator)
 */
const highlightToken = (tokenIndex: number) => {
  highlightedTokenIndex.value = tokenIndex
  scrollToToken(tokenIndex)

  // Clear highlight after 2 seconds
  setTimeout(() => {
    highlightedTokenIndex.value = null
  }, 2000)
}

/**
 * Highlight multiple tokens (called from navigation coordinator)
 */
const highlightTokens = (tokenIndices: number[]) => {
  // For multiple tokens, just scroll to the first one
  if (tokenIndices.length > 0) {
    scrollToToken(tokenIndices[0])

    // Highlight the first token
    highlightToken(tokenIndices[0])
  }
}

/**
 * Copy JSON string to clipboard
 */
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(jsonString.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy JSON to clipboard:', err)
  }
}

/**
 * Get current view mode
 */
const getViewMode = (): 'cards' | 'json' => {
  return viewMode.value
}

/**
 * Set view mode externally
 */
const setViewMode = (mode: 'cards' | 'json'): void => {
  viewMode.value = mode
}

// Expose methods for the navigation coordinator
defineExpose({
  scrollToToken,
  highlightToken,
  highlightTokens,
  getViewMode,
  setViewMode
})
</script>

<style scoped>
/* Token card styling */
.token-card {
  transition: all 0.2s ease-in-out;
  position: relative;
  group: true;
}

.token-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.token-card:active {
  transform: translateY(0);
}

/* Highlighted token styling */
.token-card.ring-2 {
  animation: tokenHighlight 0.6s ease-in-out;
}

@keyframes tokenHighlight {
  0% {
    background-color: rgb(239, 246, 255);
  }
  50% {
    background-color: rgb(219, 234, 254);
  }
  100% {
    background-color: rgb(239, 246, 255);
  }
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

/* Split view styling */
.h-full {
  height: 100%;
}

/* Ensure Monaco editor takes full height */
.flex-1 {
  min-height: 0;
}
</style>