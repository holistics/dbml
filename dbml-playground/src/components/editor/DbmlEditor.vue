<template>
  <div class="monaco-editor-wrapper w-full h-full flex flex-col">
    <div
      ref="editorContainer"
      class="flex-1 min-h-0"
    />
    <div class="status-bar bg-gray-50 border-t border-gray-200 px-3 py-1 text-xs text-gray-600 flex justify-between items-center">
      <div class="flex items-center space-x-4">
        <span>DBML</span>
        <span v-if="!readOnly">UTF-8</span>
        <span
          v-if="vim.enabled.value"
          class="vim-mode-indicator bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium"
        >
          -- {{ vim.modeStatus.value }} --
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
import {
  ref, shallowRef, computed, useTemplateRef, watch, nextTick, onMounted, onBeforeUnmount,
} from 'vue';
import * as monaco from 'monaco-editor';
import {
  DBMLLanguageService,
} from '@/components/editor/dbml-language';
import {
  useMonacoModel,
} from '@/components/editor/useMonacoModel';
import {
  useVimController,
} from '@/components/editor/useVimController';
import {
  useParser,
} from '@/stores/parserStore';

const {
  readOnly = false,
  vimMode = false,
  filepath,
} = defineProps<{
  readOnly?: boolean;
  vimMode?: boolean;
  filepath: string;
}>();

const content = defineModel<string>({
  required: true,
});

const emit = defineEmits<{
  (e: 'editor-mounted', editor: monaco.editor.IStandaloneCodeEditor): void;
  (e: 'cursor-move', pos: {
    line: number;
    column: number;
  }): void;
}>();

// Monaco model

const DBML_LANGUAGE_ID = DBMLLanguageService.getLanguageId();

const monacoUri = computed(() => monaco.Uri.file(filepath));

const {
  model,
  setContent,
  setLanguage,
} = useMonacoModel(monacoUri);

setLanguage(DBML_LANGUAGE_ID);
setContent(content.value);

// Sync model <-> v-model
watch(model, (m, _, onCleanup) => {
  content.value = m.getValue();
  const disposable = m.onDidChangeContent(() => {
    content.value = m.getValue();
  });
  onCleanup(() => disposable.dispose());
}, {
  immediate: true,
});

watch(content, (value) => {
  if (model.value.getValue() !== value) {
    setContent(value);
  }
});

// Monaco editor

const editorContainer = useTemplateRef<HTMLElement>('editorContainer');
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null);

function editorConfig (): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    theme: DBMLLanguageService.getThemeName(),
    readOnly,
    minimap: {
      enabled: false,
    },
    wordWrap: 'on',
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
    cursorSmoothCaretAnimation: 'off',
    cursorBlinking: 'solid',
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
    disableLayerHinting: true,
    selectOnLineNumbers: false,
    quickSuggestions: false,
    suggest: {
      showWords: false,
    },
    parameterHints: {
      enabled: false,
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'off',
    wordBasedSuggestions: 'off',
    mouseWheelScrollSensitivity: 1,
    fastScrollSensitivity: 5,
  };
}

onMounted(async () => {
  if (!editorContainer.value) return;
  await nextTick();

  editor.value = monaco.editor.create(editorContainer.value, {
    ...editorConfig(),
    model: model.value,
  });

  emit('editor-mounted', editor.value);
});

onBeforeUnmount(() => {
  const ed = editor.value;
  editor.value = null;
  ed?.dispose();
});

watch(model, (newModel) => {
  editor.value?.setModel(newModel);
});

watch(editorConfig, (newConfig) => {
  editor.value?.updateOptions(newConfig);
});

// Vim

const vim = useVimController(editor);

if (vimMode) vim.enable();

watch(() => vimMode, (on) => {
  if (on) vim.enable();
  else vim.disable();
});

// Status bar

const cursorPosition = ref({
  line: 1,
  column: 1,
});

const selectionInfo = ref({
  hasSelection: false,
  selectedChars: 0,
});

watch(editor, (_editor, _, onCleanup) => {
  if (!_editor) return;

  const disposables: monaco.IDisposable[] = [];

  disposables.push(_editor.onDidChangeCursorPosition(() => {
    const pos = _editor.getPosition();
    if (pos) {
      cursorPosition.value = {
        line: pos.lineNumber,
        column: pos.column,
      };
      emit('cursor-move', {
        line: pos.lineNumber,
        column: pos.column,
      });
    }
  }));

  disposables.push(_editor.onDidChangeCursorSelection(() => {
    const selection = _editor.getSelection();
    if (!selection) return;
    const hasSelection = !selection.isEmpty();
    let selectedChars = 0;
    if (hasSelection) {
      const model = _editor.getModel();
      if (model) {
        selectedChars = model.getValueInRange(selection).length;
      }
    }
    selectionInfo.value = {
      hasSelection,
      selectedChars,
    };
  }));

  const position = _editor.getPosition();
  if (position) {
    cursorPosition.value = {
      line: position.lineNumber,
      column: position.column,
    };
  }

  onCleanup(() => disposables.forEach((d) => d.dispose()));
});

// DBML diagnostics + suggestions

// Character classes that should open / keep the suggestion widget open.
// Extended with quotes + slash + space so filepath completions fire inside
// `use { ... } from '<path>'`.
const SUGGESTION_TRIGGER_CHARS = [
  '.', // subname access
  ',', // next setting
  '[', // setting
  '(',
  ':',
  '>', '<', '-', // ref
  '~', // partial injection
  '\'', '"', // opening string literal (importPath)
  '/', // importPath segment separator
  ' ', // after `from `
];

const parser = useParser();
let pendingRetrigger = false;

function shouldTriggerSuggestion (_editor: monaco.editor.IStandaloneCodeEditor): boolean {
  const model = _editor.getModel();
  if (!model) return false;
  const offset = model.getOffsetAt(_editor.getPosition()!) - 1;
  if (offset < 0) return false;
  const prevChar = model.getValue()[offset];
  if (!prevChar) return false;
  if (SUGGESTION_TRIGGER_CHARS.includes(prevChar)) return true;
  return /[a-zA-Z_]/.test(prevChar);
}

watch(editor, (_editor, _, onCleanup) => {
  if (!_editor) return;
  const disposable = _editor.onDidChangeModelContent(() => {
    pendingRetrigger = shouldTriggerSuggestion(_editor);
  });
  onCleanup(() => disposable.dispose());
});

watch(() => filepath, () => {
  pendingRetrigger = false;
});

watch([() => parser.errors, () => parser.warnings], () => {
  const ed = editor.value;
  if (!ed) return;
  const edModel = ed.getModel();
  if (!edModel) return;
  parser.updateDiagnostics(edModel);
});

// After each completed parse the compiler is fully synced - retrigger the
// suggestion widget so completions reflect the latest state.
// Guard with pendingRetrigger so file switches don't pop up suggestions.
watch(() => parser.tokens, () => {
  const _editor = editor.value;
  if (!_editor) return;
  if (!pendingRetrigger) return;
  pendingRetrigger = false;
  const suggestController = _editor.getContribution('editor.contrib.suggestController') as any;
  if (!suggestController) return;
  if (suggestController.widget?.value?.getFocusedItem()) return;
  suggestController.model?.trigger({
    auto: true,
  });
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
