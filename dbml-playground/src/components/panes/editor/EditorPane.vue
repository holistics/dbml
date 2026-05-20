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
            <PhGear class="w-3.5 h-3.5" />
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

            <!-- Rename Table nested dropdown -->
            <VDropdown
              :distance="4"
              placement="right-start"
              :arrow-padding="0"
              no-auto-focus
              @show="onRenameDropdownShow"
              @hide="renameError = ''"
            >
              <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                <PhPencilSimple class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>Rename Table</span>
                <PhCaretRight class="w-3 h-3 text-gray-400 ml-auto flex-shrink-0" />
              </button>
              <template #popper>
                <div class="p-3 flex flex-col gap-2 w-52">
                  <div>
                    <label class="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Old name</label>
                    <input
                      ref="renameOldInput"
                      v-model="renameOldName"
                      class="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-gray-800"
                      placeholder="e.g. users"
                      @keydown.enter="renameNewInput?.focus()"
                    >
                  </div>
                  <div>
                    <label class="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">New name</label>
                    <input
                      ref="renameNewInput"
                      v-model="renameNewName"
                      class="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-gray-800"
                      placeholder="e.g. customers"
                      @keydown.enter="submitRename"
                    >
                  </div>
                  <p
                    v-if="renameError"
                    class="text-[11px] text-red-600"
                  >
                    {{ renameError }}
                  </p>
                  <button
                    class="mt-1 w-full text-xs py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="!renameOldName.trim() || !renameNewName.trim()"
                    @click="submitRename"
                  >
                    Rename
                  </button>
                </div>
              </template>
            </VDropdown>
          </div>
        </template>
      </VDropdown>
    </div>
    <div class="flex-1 overflow-hidden">
      <DbmlEditor
        v-model="content"
        :vim-mode="vimModeEnabled"
        :filepath="project.currentFile"
        @editor-mounted="emit('editor-mounted', $event)"
        @cursor-move="emit('cursor-move', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { PhGear, PhPencilSimple, PhCaretRight } from '@phosphor-icons/vue';
import * as monaco from 'monaco-editor';
import { Filepath } from '@dbml/parse';
import DbmlEditor from '@/components/editor/DbmlEditor.vue';
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
const vimModeEnabled = ref(user.prefs.isVim);
const settingsOpen = ref(false);

const renameOldName = ref('');
const renameNewName = ref('');
const renameError = ref('');
const renameOldInput = ref<HTMLInputElement | null>(null);
const renameNewInput = ref<HTMLInputElement | null>(null);

watch(vimModeEnabled, (val) => user.set('isVim', val));

function onRenameDropdownShow () {
  renameOldName.value = '';
  renameNewName.value = '';
  renameError.value = '';
  nextTick(() => renameOldInput.value?.focus());
}

function submitRename () {
  renameError.value = '';
  const oldName = renameOldName.value.trim();
  const newName = renameNewName.value.trim();
  if (!oldName || !newName) return;
  if (oldName === newName) {
    renameError.value = 'Names are identical.';
    return;
  }
  const filepath = Filepath.fromUri(monaco.Uri.file(project.currentFile).toString());
  const changes = parser.compiler.renameTable(filepath, oldName, newName);
  for (const [absPath, src] of changes) {
    if (project.files[absPath] !== undefined) {
      project.files[absPath] = src;
    }
  }
  renameOldName.value = '';
  renameNewName.value = '';
}
</script>
