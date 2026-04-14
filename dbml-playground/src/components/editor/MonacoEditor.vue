<template>
  <div class="monaco-editor-wrapper w-full h-full flex flex-col">
    <div
      ref="editorContainer"
      class="flex-1 min-h-0"
    />
    <div class="status-bar bg-gray-50 border-t border-gray-200 px-3 py-1 text-xs text-gray-600 flex justify-between items-center">
      <div class="flex items-center space-x-4">
        <span>{{ props.language.toUpperCase() }}</span>
        <span v-if="!props.readOnly">UTF-8</span>
        <span
          v-if="props.vimMode"
          class="vim-mode-indicator bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium"
        >
          -- {{ vimModeStatus }} --
        </span>
      </div>
      <div class="flex items-center space-x-4">
        <span>Ln {{ cursorPosition.line }}, Col {{ cursorPosition.column }}</span>
        <span v-if="selectionInfo.hasSelection">
          ({{ selectionInfo.selectedChars }} selected)
        </span>
      </div>
    </div>
  </div>
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
import {
  ref, onMounted, onBeforeUnmount, watch, nextTick,
} from 'vue';
import * as monaco from 'monaco-editor';
import {
  DBMLLanguageService,
} from '@/components/monaco/dbml-language';
import logger from '@/utils/logger';
import {
  useParser,
} from '@/stores/parserStore';

interface Props {
  modelValue: string;
  language?: string;
  readOnly?: boolean;
  minimap?: boolean;
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  vimMode?: boolean;
  filepath?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'editor-mounted', editor: monaco.editor.IStandaloneCodeEditor): void;
  (e: 'cursor-move', pos: { line: number;
    column: number; }): void;
}

const props = withDefaults(defineProps<Props>(), {
  language: 'dbml',
  readOnly: false,
  minimap: true,
  wordWrap: 'on',
  vimMode: false,
});

const emit = defineEmits<Emits>();

const parser = useParser();
const editorContainer = ref<HTMLElement>();
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

/**
 * Reactive cursor position tracking
 */
const cursorPosition = ref({
  line: 1,
  column: 1,
});

/**
 * Reactive selection info tracking
 */
const selectionInfo = ref({
  hasSelection: false,
  selectedChars: 0,
});

/**
 * Vim mode state
 */
// eslint-disable-next-line vue/no-dupe-keys
let vimMode: { on?: (event: string, handler: (mode: { mode?: string }) => void) => void;
  dispose?: () => void; } | null = null;
const vimModeStatus = ref('NORMAL');

/**
 * Get the appropriate theme for the given language
 * Use DBML theme for both DBML and JSON to maintain consistency
 */
const getThemeForLanguage = (_language: string): string => {
  return DBMLLanguageService.getThemeName();
};

/**
 * Create a Monaco model with the correct URI so language services can key on filepath.
 */
const createModel = (): monaco.editor.ITextModel => {
  const uri = props.filepath
    ? monaco.Uri.file(props.filepath)
    : undefined;
  // Reuse existing model with that URI if already created (e.g. on hot-reload).
  const existing = uri ? monaco.editor.getModel(uri) : undefined;
  if (existing) {
    existing.setValue(props.modelValue);
    return existing;
  }
  return monaco.editor.createModel(props.modelValue, props.language ?? 'dbml', uri);
};

/**
 * Create Monaco Editor configuration
 */
const createEditorConfig = (): monaco.editor.IStandaloneEditorConstructionOptions => ({
  theme: getThemeForLanguage(props.language),
  readOnly: props.readOnly,
  minimap: {
    enabled: props.minimap,
  },
  wordWrap: props.wordWrap,
  scrollBeyondLastLine: false,
  fontSize: 14,
  lineHeight: 20,
  tabSize: 2,
  insertSpaces: true,
  lineNumbers: 'on',
  lineNumbersMinChars: 2,
  lineDecorationsWidth: 4,
  columnSelection: false,
  padding: {
    top: 10,
    bottom: 10,
  },
  renderWhitespace: 'boundary',
  renderControlCharacters: true,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'off', // Disable for better vim performance
  cursorBlinking: 'solid', // Use solid cursor for vim mode
  automaticLayout: true,
  fixedOverflowWidgets: true,
  glyphMargin: true,
  folding: true,
  showFoldingControls: 'always',
  foldingStrategy: 'indentation',
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    verticalScrollbarSize: 14,
    horizontalScrollbarSize: 14,
  },
  // Performance optimizations for vim mode
  disableLayerHinting: true, // Disable GPU acceleration that can interfere with vim
  selectOnLineNumbers: false, // Disable line number selection for vim compatibility
  cursorWidth: props.vimMode ? 2 : 1, // Slightly wider cursor for vim visibility
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false,
  },
  parameterHints: {
    enabled: false,
  },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on',
  tabCompletion: 'off',
  wordBasedSuggestions: 'off',
  // Reduce rendering frequency for better performance
  mouseWheelScrollSensitivity: 1,
  fastScrollSensitivity: 5,
});

/**
 * Setup vim mode using monaco-vim
 */
const setupVimMode = async (): Promise<void> => {
  if (!editor || !props.vimMode) return;

  try {
    // Dynamically import monaco-vim
    const {
      initVimMode,
    } = await import('monaco-vim') as any;

    // Initialize vim mode with status tracking
    vimMode = initVimMode(editor);

    // Track vim mode status changes
    if (vimMode && vimMode.on) {
      vimMode.on('vim-mode-change', (mode) => {
        vimModeStatus.value = mode.mode?.toUpperCase() || 'NORMAL';
      });
    }
  } catch (error) {
    logger.warn('Failed to initialize vim mode:', error);
  }
};

/**
 * Clear vim mode
 */
const clearVimMode = (): void => {
  if (vimMode && typeof vimMode.dispose === 'function') {
    vimMode.dispose();
    vimMode = null;
  }
};

/**
 * Initialize the Monaco Editor
 */
const initializeEditor = async (): Promise<void> => {
  if (!editorContainer.value) return;

  // Ensure DBML language support is registered
  DBMLLanguageService.registerLanguage();

  // Wait for next tick to ensure container is properly mounted
  await nextTick();

  // Create the editor with configuration
  const model = createModel();
  editor = monaco.editor.create(editorContainer.value, {
    ...createEditorConfig(),
    model,
  });

  // Set up event listeners
  setupEventListeners();

  // Setup vim mode if enabled
  setupVimMode();

  // Emit editor-mounted event
  emit('editor-mounted', editor);
};

/**
 * Update cursor position tracking
 */
const updateCursorPosition = (): void => {
  if (!editor) return;

  const position = editor.getPosition();
  if (position) {
    cursorPosition.value = {
      line: position.lineNumber,
      column: position.column,
    };
  }
};

/**
 * Update selection info tracking
 */
const updateSelectionInfo = (): void => {
  if (!editor) return;

  const selection = editor.getSelection();
  if (selection) {
    const hasSelection = !selection.isEmpty();
    let selectedChars = 0;

    if (hasSelection) {
      const model = editor.getModel();
      if (model) {
        const selectedText = model.getValueInRange(selection);
        selectedChars = selectedText.length;
      }
    }

    selectionInfo.value = {
      hasSelection,
      selectedChars,
    };
  }
};

/**
 * Set up editor event listeners
 */
const setupEventListeners = (): void => {
  if (!editor) return;

  // Content change listener (only for non-readonly editors)
  if (!props.readOnly) {
    editor.onDidChangeModelContent(() => {
      const value = editor?.getValue() || '';
      emit('update:modelValue', value);
    });
  }

  // Cursor position change listener
  editor.onDidChangeCursorPosition(() => {
    updateCursorPosition();
    const pos = editor?.getPosition();
    if (pos) emit('cursor-move', {
      line: pos.lineNumber,
      column: pos.column,
    });
  });

  // Selection change listener
  editor.onDidChangeCursorSelection(() => {
    updateSelectionInfo();
  });

  // Initial position and selection update
  updateCursorPosition();
  updateSelectionInfo();
};

/**
 * Clean up editor resources
 */
const cleanup = (): void => {
  clearVimMode();
  if (editor) {
    editor.dispose();
    editor = null;
  }
};

// Lifecycle hooks
onMounted(() => {
  initializeEditor().catch((error) => {
    logger.error('Failed to initialize Monaco Editor:', error);
  });
});

onBeforeUnmount(() => {
  cleanup();
});

// Watch for prop changes
watch(() => props.modelValue, (newValue) => {
  if (editor && editor.getValue() !== newValue) {
    editor.setValue(newValue);
  }
});

watch(() => props.readOnly, (newReadOnly) => {
  if (editor) {
    editor.updateOptions({
      readOnly: newReadOnly,
    });
  }
});

watch(() => props.language, (newLanguage) => {
  if (editor) {
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage);
      editor.updateOptions({
        theme: getThemeForLanguage(newLanguage),
      });
    }
  }
});

watch(() => props.filepath, () => {
  if (!editor) return;
  const newModel = createModel();
  editor.setModel(newModel);
});

// Update Monaco markers whenever parser errors/warnings change.
// errors/warnings are replaced wholesale on each parse (ref<readonly ParserError[]>),
// so a shallow watch on the array reference is sufficient — no deep traversal needed.
watch([() => parser.errors, () => parser.warnings], () => {
  if (!editor || props.language !== 'dbml') return;
  const model = editor.getModel();
  if (!model) return;
  parser.updateDiagnostics(model);
});

// Watch for vim mode changes
watch(() => props.vimMode, (newVimMode) => {
  if (editor) {
    if (newVimMode) {
      setupVimMode();
    } else {
      clearVimMode();
    }
  }
});
</script>

<style scoped>
/* Monaco Editor Wrapper Styles */
.monaco-editor-wrapper {
  height: 100%;
  width: 100%;
}

/* Status Bar Styles */
.status-bar {
  height: 22px;
  min-height: 22px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace;
  user-select: none;
  flex-shrink: 0;
}

.status-bar span {
  white-space: nowrap;
}
</style>
