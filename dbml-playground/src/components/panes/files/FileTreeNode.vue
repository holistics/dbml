<template>
  <div>
    <!-- Row -->
    <div
      class="group flex items-center gap-1.5 py-1.5 pr-2 cursor-pointer"
      :style="{ paddingLeft: `${4 + node.depth * 10}px` }"
      :class="isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'"
      @click="handleClick"
      @dblclick="startEditing"
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
        v-if="isEditing"
        ref="editInputElement"
        v-model="editValue"
        class="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 text-xs outline-none font-mono"
        @keydown.enter="commitEdit"
        @keydown.escape="cancelEdit"
        @blur="commitEdit"
        @click.stop
      >
      <span
        v-else
        class="flex-1 min-w-0 truncate text-xs font-mono leading-none"
      >{{ node.name }}</span>

      <!-- Actions (visible on hover) -->
      <div
        v-if="!isEditing"
        :class="['flex items-center flex-shrink-0 transition-opacity', confirmingDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100']"
      >
        <button
          v-if="node.type === 'folder'"
          class="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          title="New file in folder"
          @click.stop="startPending('file')"
        >
          <PhFilePlus class="w-3 h-3" />
        </button>

        <!-- Delete with teleported confirm -->
        <div
          v-if="canDelete"
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
      />

      <!-- Inline input for new file/folder inside this folder -->
      <div
        v-if="pendingChild"
        class="flex items-center gap-1.5 py-1.5 pr-1"
        :style="{ paddingLeft: `${4 + (node.depth + 1) * 10}px` }"
        @click.stop
      >
        <span class="w-2.5 h-2.5 flex-shrink-0" />
        <PhFileText
          v-if="pendingChild.type === 'file'"
          class="w-3.5 h-3.5 flex-shrink-0 opacity-60"
        />
        <PhFolder
          v-else
          class="w-3.5 h-3.5 flex-shrink-0 opacity-70"
        />
        <input
          ref="pendingInputEl"
          v-model="pendingChild.value"
          placeholder="name"
          class="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 text-xs outline-none font-mono"
          @keydown.enter="commitPending"
          @keydown.escape="cancelPending"
          @blur="commitPending"
          @click.stop
        >
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, watch, nextTick, inject, onMounted, onUnmounted, type Ref,
} from 'vue';
import {
  PhCaretRight,
  PhFolder,
  PhFolderOpen,
  PhFileText,
  PhFilePlus,
  PhTrash,
} from '@phosphor-icons/vue';
import { useProjectStore } from '@/stores/projectStore';
import { Filepath } from '@dbml/parse';
import type { TreeNode } from './FilesPane.vue';

const {
  node,
} = defineProps<{
  node: TreeNode;
}>();

const project = useProjectStore();
const editingPath = inject<Ref<string | null>>('editingPath')!;

// Expansion

const open = ref(true);

// Selection

const isActive = computed(() =>
  node.type === 'file' && project.currentFile === node.path,
);

function handleClick () {
  confirmingDelete.value = false;
  if (node.type === 'folder') {
    open.value = !open.value;
  } else {
    project.setCurrentFile(node.path);
  }
}

// Rename

const isEditing = computed(() => editingPath.value === node.path);
const editValue = ref('');
const editInputElement = ref<HTMLInputElement | null>(null);

watch(isEditing, (editing) => {
  if (editing) {
    editValue.value = node.name;
    nextTick(() => editInputElement.value?.select());
  }
});

onMounted(async () => {
  await nextTick();
  if (editInputElement.value) {
    editInputElement.value.focus();
  }
});

function startEditing () {
  editingPath.value = node.path;
}

function commitEdit () {
  if (!isEditing.value) return;
  const rawName = editValue.value.trim();
  editingPath.value = null;
  if (!rawName || rawName === node.name) return;

  const newName = node.type === 'file' && !Filepath.from('/' + rawName).extname
    ? rawName + '.dbml'
    : rawName;
  const oldFp = Filepath.from(node.path);
  const newFp = Filepath.from(oldFp.dirname).join(newName);

  if (node.type === 'file') {
    project.renameFile(oldFp.absolute, newFp.absolute);
  } else {
    project.renameFolder(oldFp.absolute, newFp.absolute);
  }
}

function cancelEdit () {
  editingPath.value = null;
}

// Delete

const canDelete = computed(() =>
  node.type === 'folder' || Object.keys(project.files).length > 1,
);

const confirmingDelete = ref(false);
const deleteButtonRef = ref<HTMLButtonElement | null>(null);
const popoverStyle = ref<{
  top: string;
  left: string;
}>({
  top: '0px',
  left: '0px',
});

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

function confirmDelete () {
  confirmingDelete.value = false;
  if (node.type === 'file') {
    project.deleteFile(node.path);
  } else {
    project.deleteFolder(node.path);
  }
}

function onClickOutside (e: MouseEvent) {
  if (confirmingDelete.value && deleteButtonRef.value && !deleteButtonRef.value.contains(e.target as Node)) {
    confirmingDelete.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));

// Pending create (new file/folder inside this folder)

const pendingChild = ref<{
  type: 'file' | 'folder';
  value: string;
} | null>(null);
const pendingInputEl = ref<HTMLInputElement | null>(null);

function startPending (type: 'file' | 'folder') {
  open.value = true;
  pendingChild.value = {
    type,
    value: '',
  };
  nextTick(() => pendingInputEl.value?.focus());
}

function commitPending () {
  if (!pendingChild.value) return;
  const rawName = pendingChild.value.value.trim();
  if (rawName) {
    const parentFp = Filepath.from(node.path);
    const childFp = parentFp.join(rawName);
    if (pendingChild.value.type === 'folder') {
      project.addFolder(childFp.absolute);
    } else {
      const fileFp = childFp.extname ? childFp : Filepath.from(childFp.absolute + '.dbml');
      project.addFile(fileFp.absolute, '');
    }
  }
  pendingChild.value = null;
}

function cancelPending () {
  pendingChild.value = null;
}
</script>
