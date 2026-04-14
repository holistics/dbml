<template>
  <div class="flex flex-col h-full bg-white rounded border border-gray-200 overflow-hidden">
    <div class="bg-white border-b border-gray-200 flex-shrink-0 flex items-center justify-between pr-0.5 pl-3 h-[33px]">
      <span class="text-xs text-gray-400 font-mono truncate">{{ project.currentFile }}</span>
      <VDropdown
        :distance="6"
        placement="bottom-end"
        :arrow-padding="0"
        no-auto-focus
        @show="settingsOpen = true"
        @hide="settingsOpen = false"
      >
        <VTooltip
          placement="bottom"
          :distance="6"
          :disabled="settingsOpen"
        >
          <button
            class="p-1.5 rounded transition-colors cursor-pointer flex-shrink-0"
            :class="settingsOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-900'"
          >
            <Cog6ToothIcon class="w-3.5 h-3.5" />
          </button>
          <template #popper>
            <span class="text-xs">Settings</span>
          </template>
        </VTooltip>
        <template #popper>
          <div class="py-1 min-w-[10rem]">
            <label class="flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                v-model="vimModeEnabled"
                class="rounded border-gray-300 text-blue-600"
              >
              <span>Vim Mode</span>
            </label>
          </div>
        </template>
      </VDropdown>
    </div>
    <div class="flex-1 overflow-hidden">
      <MonacoEditor
        v-model="content"
        language="dbml"
        :minimap="false"
        word-wrap="on"
        :vim-mode="vimModeEnabled"
        :filepath="project.currentFile"
        @editor-mounted="emit('editor-mounted', $event)"
        @cursor-move="emit('cursor-move', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref, watch,
} from 'vue';
import {
  Cog6ToothIcon,
} from '@heroicons/vue/24/outline';
import MonacoEditor from '@/components/editor/MonacoEditor.vue';
import {
  useUser,
} from '@/stores/userStore';
import {
  useProject,
} from '@/stores/projectStore';
import type * as monaco from 'monaco-editor';

const content = defineModel<string>({
  required: true,
});

const emit = defineEmits<{
  'editor-mounted': [editor: monaco.editor.IStandaloneCodeEditor];
  'cursor-move': [pos: { line: number;
    column: number; }];
}>();

const user = useUser();
const project = useProject();
const vimModeEnabled = ref(user.prefs.isVim);
const settingsOpen = ref(false);

watch(vimModeEnabled, (val) => user.set('isVim', val));
</script>
