<template>
  <div>
    <!-- Row -->
    <div
      class="group flex items-center gap-1.5 py-1.5 pr-2 cursor-pointer"
      :style="{ paddingLeft: `${4 + node.depth * 10}px` }"
      :class="isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'"
      @click="handleClick"
      @dblclick="emit('start-rename', node.path)"
    >
      <!-- Folder chevron / file spacer -->
      <PhCaretRight
        v-if="node.type === 'folder'"
        class="w-2.5 h-2.5 flex-shrink-0 transition-transform"
        :class="open ? 'rotate-90' : ''"
      />
      <span
        v-else
        class="w-2.5 h-2.5 flex-shrink-0"
      />

      <!-- Icon -->
      <PhFolderOpen
        v-if="node.type === 'folder' && open"
        class="w-3.5 h-3.5 flex-shrink-0 opacity-70"
      />
      <PhFolder
        v-else-if="node.type === 'folder'"
        class="w-3.5 h-3.5 flex-shrink-0 opacity-70"
      />
      <PhFileText
        v-else
        class="w-3.5 h-3.5 flex-shrink-0 opacity-60"
      />

      <!-- Rename input / name -->
      <input
        v-if="renamingPath === node.path"
        :ref="el => { if (el) emit('rename-input-mounted', el as HTMLInputElement) }"
        :value="renameValue"
        class="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 text-xs outline-none font-mono"
        @input="emit('update-rename', ($event.target as HTMLInputElement).value)"
        @keydown.enter="emit('commit-rename')"
        @keydown.escape="emit('cancel-rename')"
        @blur="emit('commit-rename')"
        @click.stop
      >
      <span
        v-else
        class="flex-1 min-w-0 truncate text-xs font-mono leading-none"
      >{{ node.name }}</span>

      <!-- Actions (visible on hover) -->
      <div
        v-if="renamingPath !== node.path"
        :class="['flex items-center flex-shrink-0 transition-opacity', confirmingDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100']"
      >
        <button
          v-if="node.type === 'folder'"
          class="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          title="New file in folder"
          @click.stop="onAddFileInFolder"
        >
          <PhFilePlus class="w-3 h-3" />
        </button>

        <!-- Delete with teleported confirm -->
        <div
          v-if="node.type === 'folder' || (node.type === 'file' && canDelete)"
          class="relative"
        >
          <button
            ref="deleteButtonRef"
            class="p-0.5 rounded transition-colors cursor-pointer"
            :class="confirmingDelete ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'"
            :title="node.type === 'folder' ? 'Delete folder' : 'Delete file'"
            @click.stop="toggleConfirm"
          >
            <PhTrash class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- Teleported confirm popover -->
    <Teleport to="body">
      <div
        v-if="confirmingDelete"
        class="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-md p-2.5 whitespace-nowrap min-w-[140px]"
        :style="popoverStyle"
        @click.stop
      >
        <p class="text-xs font-medium text-gray-700 mb-2">
          Delete {{ node.type === 'folder' ? 'folder' : 'file' }}?
        </p>
        <p class="text-[11px] text-gray-400 mb-2.5 leading-snug">
          {{ node.type === 'folder' ? 'All files inside will be removed.' : 'This cannot be undone.' }}
        </p>
        <div class="flex items-center gap-1.5">
          <button
            class="flex-1 text-xs py-1 rounded bg-red-500 text-white hover:bg-red-600 cursor-pointer transition-colors font-medium"
            @click.stop="confirmDelete"
          >
            Delete
          </button>
          <button
            class="flex-1 text-xs py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-colors"
            @click.stop="confirmingDelete = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Children + pending new-file input -->
    <template v-if="node.type === 'folder' && open">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :renaming-path="renamingPath"
        :rename-value="renameValue"
        :can-delete="canDelete"
        :pending-node="pendingNode"
        :pending-value="pendingValue"
        @select="emit('select', $event)"
        @start-rename="emit('start-rename', $event)"
        @update-rename="emit('update-rename', $event)"
        @commit-rename="emit('commit-rename')"
        @cancel-rename="emit('cancel-rename')"
        @delete-file="emit('delete-file', $event)"
        @delete-folder="emit('delete-folder', $event)"
        @rename-input-mounted="el => emit('rename-input-mounted', el)"
        @add-file-in-folder="emit('add-file-in-folder', $event)"
        @update-pending="emit('update-pending', $event)"
        @commit-pending="emit('commit-pending')"
        @cancel-pending="emit('cancel-pending')"
        @pending-input-mounted="el => emit('pending-input-mounted', el)"
      />

      <!-- Inline input for new file/folder inside this folder -->
      <div
        v-if="pendingNode && pendingNode.parentPath === node.path"
        class="flex items-center gap-1.5 py-1.5 pr-1"
        :style="{ paddingLeft: `${4 + (node.depth + 1) * 10}px` }"
        @click.stop
      >
        <span class="w-2.5 h-2.5 flex-shrink-0" />
        <PhFileText
          v-if="pendingNode.type === 'file'"
          class="w-3.5 h-3.5 flex-shrink-0 opacity-60"
        />
        <PhFolder
          v-else
          class="w-3.5 h-3.5 flex-shrink-0 opacity-70"
        />
        <input
          :ref="el => { if (el) emit('pending-input-mounted', el as HTMLInputElement) }"
          :value="pendingValue"
          placeholder="name"
          class="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 text-xs outline-none font-mono"
          @input="emit('update-pending', ($event.target as HTMLInputElement).value)"
          @keydown.enter="emit('commit-pending')"
          @keydown.escape="emit('cancel-pending')"
          @blur="emit('commit-pending')"
          @click.stop
        >
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted,
} from 'vue';
import {
  PhCaretRight,
  PhFolder,
  PhFolderOpen,
  PhFileText,
  PhFilePlus,
  PhTrash,
} from '@phosphor-icons/vue';
import {
  useProject,
} from '@/stores/projectStore';
import type {
  TreeNode,
} from './FilesPane.vue';

interface PendingNode {
  type: 'file' | 'folder';
  parentPath: string;
}

interface Props {
  node: TreeNode;
  renamingPath: string | null;
  renameValue: string;
  canDelete: boolean;
  pendingNode?: PendingNode | null;
  pendingValue?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'select': [path: string];
  'start-rename': [path: string];
  'update-rename': [value: string];
  'commit-rename': [];
  'cancel-rename': [];
  'delete-file': [path: string];
  'delete-folder': [path: string];
  'rename-input-mounted': [el: HTMLInputElement];
  'add-file-in-folder': [folderPath: string];
  'update-pending': [value: string];
  'commit-pending': [];
  'cancel-pending': [];
  'pending-input-mounted': [el: HTMLInputElement];
}>();

const project = useProject();
const open = ref(true);
const confirmingDelete = ref(false);
const deleteButtonRef = ref<HTMLButtonElement | null>(null);
const popoverStyle = ref<{ top: string;
  left: string; }>({
  top: '0px',
  left: '0px',
});

const isActive = computed(() =>
  props.node.type === 'file' && project.currentFile === props.node.path,
);

function toggleConfirm () {
  if (!confirmingDelete.value && deleteButtonRef.value) {
    const rect = deleteButtonRef.value.getBoundingClientRect();
    popoverStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.right - 140}px`,
    };
  }
  confirmingDelete.value = !confirmingDelete.value;
}

function onAddFileInFolder () {
  open.value = true;
  emit('add-file-in-folder', props.node.path);
}

function handleClick () {
  confirmingDelete.value = false;
  if (props.node.type === 'folder') {
    open.value = !open.value;
  } else {
    emit('select', props.node.path);
  }
}

function confirmDelete () {
  confirmingDelete.value = false;
  if (props.node.type === 'file') {
    emit('delete-file', props.node.path);
  } else {
    emit('delete-folder', props.node.path);
  }
}

function onClickOutside (e: MouseEvent) {
  if (confirmingDelete.value && deleteButtonRef.value && !deleteButtonRef.value.contains(e.target as Node)) {
    confirmingDelete.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));
</script>
