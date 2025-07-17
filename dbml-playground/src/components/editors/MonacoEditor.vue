<template>
  <div ref="editorContainer" class="w-full h-full border border-gray-200 rounded-md"></div>
</template>

<script setup lang="ts">
/**
 * Monaco Editor Component
 *
 * A clean wrapper around Monaco Editor that focuses solely on editor concerns.
 * Complex language registration is delegated to specialized services.
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles editor lifecycle and events
 * - Information Hiding: Language setup complexity is hidden in services
 * - Shallow Module: Simple interface that delegates to deep modules
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { DBMLLanguageService } from '@/components/monaco/dbml-language'

interface Props {
  modelValue: string
  language?: string
  readOnly?: boolean
  minimap?: boolean
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded'
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'editor-mounted', editor: monaco.editor.IStandaloneCodeEditor): void
}

const props = withDefaults(defineProps<Props>(), {
  language: 'dbml',
  readOnly: false,
  minimap: true,
  wordWrap: 'on'
})

const emit = defineEmits<Emits>()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

/**
 * Get the appropriate theme for the given language
 */
const getThemeForLanguage = (language: string): string => {
  return language === 'dbml' ? DBMLLanguageService.getThemeName() : 'vs'
}

/**
 * Create Monaco Editor configuration
 */
const createEditorConfig = (): monaco.editor.IStandaloneEditorConstructionOptions => ({
  value: props.modelValue,
  language: props.language,
  theme: getThemeForLanguage(props.language),
  readOnly: props.readOnly,
  minimap: { enabled: props.minimap },
  wordWrap: props.wordWrap,
  scrollBeyondLastLine: false,
  fontSize: 14,
  lineHeight: 20,
  padding: { top: 10, bottom: 10 },
  renderWhitespace: 'boundary',
  renderControlCharacters: true,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on',
  automaticLayout: true,
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    verticalScrollbarSize: 14,
    horizontalScrollbarSize: 14
  }
})

/**
 * Initialize the Monaco Editor
 */
const initializeEditor = async (): Promise<void> => {
  if (!editorContainer.value) return

  // Ensure DBML language support is registered
  DBMLLanguageService.registerLanguage()

  // Wait for next tick to ensure container is properly mounted
  await nextTick()

  // Create the editor with configuration
  editor = monaco.editor.create(editorContainer.value, createEditorConfig())

  // Set up event listeners
  setupEventListeners()

  // Emit editor-mounted event
  emit('editor-mounted', editor)
}

/**
 * Set up editor event listeners
 */
const setupEventListeners = (): void => {
  if (!editor || props.readOnly) return

  editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() || ''
    emit('update:modelValue', value)
  })
}

/**
 * Clean up editor resources
 */
const cleanup = (): void => {
  if (editor) {
    editor.dispose()
    editor = null
  }
}

// Lifecycle hooks
onMounted(() => {
  initializeEditor().catch(error => {
    console.error('Failed to initialize Monaco Editor:', error)
  })
})

onBeforeUnmount(() => {
  cleanup()
})

// Watch for prop changes
watch(() => props.modelValue, (newValue) => {
  if (editor && editor.getValue() !== newValue) {
    editor.setValue(newValue)
  }
})

watch(() => props.readOnly, (newReadOnly) => {
  if (editor) {
    editor.updateOptions({ readOnly: newReadOnly })
  }
})

watch(() => props.language, (newLanguage) => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
      editor.updateOptions({
        theme: getThemeForLanguage(newLanguage)
      })
    }
  }
})
</script>

<style scoped>
/* Ensure the container takes full height */
.monaco-editor-container {
  height: 100%;
  width: 100%;
}
</style>