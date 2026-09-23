<template>
  <div class="flex flex-col h-full bg-white rounded border border-gray-200 overflow-hidden">
    <div class="bg-white border-b border-gray-200 flex-shrink-0 flex items-center justify-between pr-0.5 pl-3 h-[33px]">
      <span class="text-xs text-gray-400 font-mono truncate">{{ project.currentFile }}</span>
      <SettingsDropdown
        ref="settingsRef"
        @rename-table="onRenameTable"
      />
    </div>
    <div class="flex-1 overflow-hidden relative">
      <DbmlEditor
        v-model="content"
        :vim-mode="settingsRef?.vimMode ?? user.prefs.isVim"
        :filepath="project.currentFile"
        @editor-mounted="emit('editor-mounted', $event)"
        @cursor-move="emit('cursor-move', $event)"
      />
      <DiagnosticsPopover
        :errors="parser.errors"
        :warnings="parser.warnings"
        :infos="parser.infos"
        :source="content"
        @diagnostic-jump="onDiagnosticJump"
        @apply-fix="onApplyFix"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, type ShallowRef } from 'vue';
import * as monaco from 'monaco-editor';
import { Filepath } from '@dbml/parse';
import type { ParserDiagnostic, QuickFixAction } from '@/types';
import DbmlEditor from '@/components/editor/DbmlEditor.vue';
import DiagnosticsPopover from '@/components/panes/editor/DiagnosticsPopover.vue';
import SettingsDropdown from '@/components/panes/editor/SettingsDropdown.vue';
import { useUserStore } from '@/stores/userStore';
import { useProjectStore } from '@/stores/projectStore';
import { useParserStore } from '@/stores/parserStore';

const content = defineModel<string>({
  required: true,
});

const emit = defineEmits<{
  'editor-mounted': [editor: monaco.editor.IStandaloneCodeEditor];
  'cursor-move': [position: {
    line: number;
    column: number;
  }];
}>();

const user = useUserStore();
const project = useProjectStore();
const parser = useParserStore();
const settingsRef = ref<InstanceType<typeof SettingsDropdown> | null>(null);
const dbmlEditorRef = inject<ShallowRef<monaco.editor.IStandaloneCodeEditor | null>>('dbmlEditorRef');

function onDiagnosticJump (diag: ParserDiagnostic) {
  const editor = dbmlEditorRef?.value;
  if (!editor) return;
  const range = {
    startLineNumber: diag.location.line,
    startColumn: diag.location.column,
    endLineNumber: diag.endLocation.line,
    endColumn: diag.endLocation.column,
  };
  editor.setSelection(range);
  editor.revealRangeAtTop(range);
  editor.focus();
}

function onApplyFix ({ fix }: { diagnostic: ParserDiagnostic; fix: QuickFixAction }) {
  const editor = dbmlEditorRef?.value;
  if (!editor) return;
  const model = editor.getModel();
  if (!model) return;

  const edits = fix.edits.map((e) => {
    const startPos = model.getPositionAt(e.start);
    const endPos = model.getPositionAt(e.end);
    return {
      range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
      text: e.newText,
    };
  });

  model.pushEditOperations([], edits, () => null);
}

function onRenameTable ({ oldName, newName }: { oldName: string; newName: string }) {
  const filepath = Filepath.fromUri(monaco.Uri.file(project.currentFile).toString());
  const changes = parser.compiler.renameTable(filepath, oldName, newName);
  for (const [absPath, src] of changes) {
    if (project.files[absPath] !== undefined) {
      project.files[absPath] = src;
    }
  }
}
</script>
