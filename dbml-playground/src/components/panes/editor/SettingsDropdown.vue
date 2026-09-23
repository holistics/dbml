<template>
  <VDropdown
    :distance="6"
    placement="bottom-end"
    :arrow-padding="0"
    no-auto-focus
    @show="isOpen = true"
    @hide="isOpen = false"
  >
    <VTooltip
      placement="bottom"
      :distance="6"
      :disabled="isOpen"
    >
      <button
        class="p-1.5 rounded transition-colors cursor-pointer flex-shrink-0"
        :class="isOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-900'"
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
            v-model="vimMode"
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
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { PhGear, PhPencilSimple, PhCaretRight } from '@phosphor-icons/vue';
import { useUserStore } from '@/stores/userStore';

const emit = defineEmits<{
  'rename-table': [payload: { oldName: string; newName: string }];
}>();

const user = useUserStore();

const vimMode = ref(user.prefs.isVim);
const isOpen = ref(false);

watch(vimMode, (val) => user.set('isVim', val));

defineExpose({ vimMode });

// Rename Table
const renameOldName = ref('');
const renameNewName = ref('');
const renameError = ref('');
const renameOldInput = ref<HTMLInputElement | null>(null);
const renameNewInput = ref<HTMLInputElement | null>(null);

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
  emit('rename-table', { oldName, newName });
  renameOldName.value = '';
  renameNewName.value = '';
}
</script>
