<template>
  <div class="monaco-editor-wrapper w-full h-full flex flex-col">
    <div
      ref="editorContainer"
      class="flex-1 min-h-0"
    />
    <div class="status-bar bg-white border-t border-gray-200 px-3 py-1 text-xs text-gray-600 flex justify-between items-center">
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
import { DBMLLanguageService } from '@/components/editor/dbml_language';
import { ArchLanguageService } from '@/components/editor/arch_language';
import { isArchitectureSource } from '@dbml/arch';
import { useMonacoModel } from '@/components/editor/useMonacoModel';
import { useVimController } from '@/components/editor/useVimController';
import { useParserStore } from '@/stores/parserStore';
import { useArchStore } from '@/stores/archStore';
import { updateDiagnosticMarkers } from '@/components/editor/dbml_services';

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
const ARCH_LANGUAGE_ID = ArchLanguageService.getLanguageId();

ArchLanguageService.registerLanguage();

/**
 * WHICH HIGHLIGHTER, decided by the document rather than by the filename.
 *
 * `isArchitectureSource` reads `diagram_type` off the head of the string with a regular
 * expression — no lexer, no parser — which is the whole reason the marker lives in front
 * matter. It is cheap enough to ask on every keystroke, so a document that becomes an
 * architecture file lights up the moment the line is typed.
 */
const languageFor = (source: string): string => (
  isArchitectureSource(source) ? ARCH_LANGUAGE_ID : DBML_LANGUAGE_ID
);

const monacoUri = computed(() => monaco.Uri.file(filepath));

const {
  model,
  setContent,
  setLanguage,
} = useMonacoModel(monacoUri);

setLanguage(languageFor(content.value));


// Sync model <-> v-model
watch(model, (m, _, onCleanup) => {
  // On model switch, parent content is authoritative - write it into the model.
  if (m.getValue() !== content.value) {
    m.setValue(content.value);
  }
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

/**
 * Re-highlight when the document changes what it says it is.
 *
 * This sits BELOW `editor` on purpose. It runs immediately, and an immediate watcher that
 * reaches a `const` declared further down the file throws
 * `Cannot access 'editor' before initialization` — a temporal dead zone, not a Vue problem,
 * and one this file has already been bitten by once.
 */
watch(content, (value) => {
  const next = languageFor(value);
  if (model.value.getLanguageId() === next) return;

  setLanguage(next);
  monaco.editor.setTheme(
    next === ARCH_LANGUAGE_ID
      ? ArchLanguageService.getThemeName()
      : DBMLLanguageService.getThemeName(),
  );
}, { immediate: true });

function editorConfig (): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    theme: languageFor(content.value) === ARCH_LANGUAGE_ID
      ? ArchLanguageService.getThemeName()
      : DBMLLanguageService.getThemeName(),
    readOnly,
    minimap: {
      enabled: false,
    },
    wordWrap: 'on',
    scrollBeyondLastLine: true,
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
  const _editor = editor.value;
  editor.value = null;
  _editor?.dispose();
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

const parser = useParserStore();
const arch = useArchStore();
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

watch([() => parser.errors, () => parser.warnings, () => parser.infos, () => arch.hasArchitecture], () => {
  const _editor = editor.value;
  if (!_editor) return;
  const model = _editor.getModel();
  if (!model) return;
  updateDiagnosticMarkers(model, arch.hasArchitecture);
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
