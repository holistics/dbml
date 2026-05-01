<template>
  <div class="flex flex-col h-full bg-white rounded border border-gray-200 overflow-hidden select-none">
    <div class="flex items-center justify-between pl-[22px] pr-1 h-[33px] border-b border-gray-200 flex-shrink-0">
      <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Files</span>
      <div class="flex items-center">
        <VTooltip
          placement="bottom"
          :distance="6"
        >
          <button
            class="p-1.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            @click="createFile"
          >
            <PhFilePlus class="w-3.5 h-3.5" />
          </button>
          <template #popper>
            <span class="text-xs">New file</span>
          </template>
        </VTooltip>
        <VTooltip
          placement="bottom"
          :distance="6"
        >
          <button
            class="p-1.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            @click="createFolder"
          >
            <PhFolderPlus class="w-3.5 h-3.5" />
          </button>
          <template #popper>
            <span class="text-xs">New folder</span>
          </template>
        </VTooltip>
        <div>
          <VTooltip
            placement="bottom"
            :distance="6"
            :disabled="confirmingReset"
          >
            <button
              ref="resetButtonRef"
              class="p-1.5 rounded transition-colors cursor-pointer"
              :class="confirmingReset ? 'text-red-600 bg-red-50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'"
              @click="toggleReset"
            >
              <PhArrowClockwise class="w-3.5 h-3.5" />
            </button>
            <template #popper>
              <span class="text-xs">Reset to default</span>
            </template>
          </VTooltip>
        </div>

        <Teleport to="body">
          <div
            v-if="confirmingReset"
            class="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-md p-2.5 whitespace-nowrap min-w-[150px]"
            :style="resetPopoverStyle"
            @click.stop
          >
            <p class="text-xs font-medium text-gray-700 mb-2">
              Reset project?
            </p>
            <p class="text-[11px] text-gray-400 mb-2.5 leading-snug">
              All files will be replaced with the default sample.
            </p>
            <div class="flex items-center gap-1.5">
              <button
                class="flex-1 text-xs py-1 rounded bg-red-500 text-white hover:bg-red-600 cursor-pointer transition-colors font-medium"
                @click="doReset"
              >
                Reset
              </button>
              <button
                class="flex-1 text-xs py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-colors"
                @click="confirmingReset = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </Teleport>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
      <FileTreeNode
        v-for="node in tree"
        :key="node.path"
        :node="node"
        :renaming-path="renamingPath"
        :rename-value="renameValue"
        :can-delete="totalFiles > 1"
        :pending-node="pendingNode"
        :pending-value="pendingValue"
        @select="project.setCurrentFile($event)"
        @start-rename="startRename"
        @update-rename="renameValue = $event"
        @commit-rename="commitRename"
        @cancel-rename="cancelRename"
        @delete-file="project.deleteFile($event)"
        @delete-folder="deleteFolder($event)"
        @rename-input-mounted="el => { renameInputEl = el }"
        @add-file-in-folder="createFileInFolder($event)"
        @update-pending="pendingValue = $event"
        @commit-pending="commitPending"
        @cancel-pending="cancelPending"
        @pending-input-mounted="el => { pendingInputEl = el }"
      />
      <!-- Root-level pending node -->
      <div
        v-if="pendingNode && pendingNode.parentPath === ''"
        class="flex items-center gap-1 py-1"
        style="padding-left: 4px"
      >
        <span class="w-2.5 h-2.5 flex-shrink-0" />
        <PhFolder
          v-if="pendingNode.type === 'folder'"
          class="w-3.5 h-3.5 flex-shrink-0 opacity-70"
        />
        <PhFileText
          v-else
          class="w-3.5 h-3.5 flex-shrink-0 opacity-60"
        />
        <input
          :ref="el => { if (el) pendingInputEl = el as HTMLInputElement }"
          :value="pendingValue"
          placeholder="name"
          class="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 text-xs outline-none font-mono"
          @input="pendingValue = ($event.target as HTMLInputElement).value"
          @keydown.enter="commitPending"
          @keydown.escape="cancelPending"
          @blur="commitPending"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, nextTick, onMounted, onUnmounted,
} from 'vue';
import {
  PhFilePlus, PhFolderPlus, PhFolder, PhFileText, PhArrowClockwise,
} from '@phosphor-icons/vue';
import {
  useProjectStore,
} from '@/stores/projectStore';
import {
  Filepath,
} from '@dbml/parse';
import FileTreeNode from './FileTreeNode.vue';

const project = useProjectStore();

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  depth: number;
}

function depthOf (fp: Filepath): number {
  return fp.absolute.split('/').filter(Boolean).length - 1;
}

function buildTree (filePaths: string[], explicitFolders: string[] = []): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();
  const folderSet = new Set(explicitFolders);

  function ensureFolder (fp: Filepath, siblings: TreeNode[]): TreeNode {
    const key = fp.absolute;
    if (!folderMap.has(key)) {
      const node: TreeNode = {
        name: fp.basename,
        path: key,
        type: 'folder',
        children: [],
        depth: depthOf(fp),
      };
      folderMap.set(key, node);
      siblings.push(node);
    }
    return folderMap.get(key)!;
  }

  function getSiblings (fp: Filepath): TreeNode[] {
    const dir = fp.dirname;
    if (dir === '/') return root;
    const parentFp = Filepath.from(dir);
    return ensureFolder(parentFp, getSiblings(parentFp)).children;
  }

  const allEntries: { fp: Filepath;
    isFolder: boolean; }[] = [
    ...explicitFolders.map((p) => ({
      fp: Filepath.from(p),
      isFolder: true,
    })),
    ...filePaths.map((p) => ({
      fp: Filepath.from(p),
      isFolder: false,
    })),
  ];

  allEntries.sort((a, b) => {
    const ad = depthOf(a.fp);
    const bd = depthOf(b.fp);
    if (ad !== bd) return ad - bd;
    // Folders before files at the same depth
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.fp.basename.localeCompare(b.fp.basename);
  });

  for (const {
    fp, isFolder,
  } of allEntries) {
    const siblings = getSiblings(fp);
    if (isFolder) {
      ensureFolder(fp, siblings);
    } else if (!folderSet.has(fp.absolute)) {
      siblings.push({
        name: fp.basename,
        path: fp.absolute,
        type: 'file',
        children: [],
        depth: depthOf(fp),
      });
    }
  }

  return root;
}

const tree = computed(() => buildTree(Object.keys(project.files), project.folders));
const totalFiles = computed(() => Object.keys(project.files).length);

const renamingPath = ref<string | null>(null);
const renameValue = ref('');
const renameInputEl = ref<HTMLInputElement | null>(null);

interface PendingNode {
  type: 'file' | 'folder';
  parentPath: string;
}
const pendingNode = ref<PendingNode | null>(null);
const pendingValue = ref('');
const pendingInputEl = ref<HTMLInputElement | null>(null);

const confirmingReset = ref(false);
const resetButtonRef = ref<HTMLButtonElement | null>(null);
const resetPopoverStyle = ref<{ top: string;
  left: string; }>({
  top: '0px',
  left: '0px',
});

function toggleReset () {
  if (!confirmingReset.value && resetButtonRef.value) {
    const rect = resetButtonRef.value.getBoundingClientRect();
    resetPopoverStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.right - 150}px`,
    };
  }
  confirmingReset.value = !confirmingReset.value;
}

function doReset () {
  confirmingReset.value = false;
  project.reset();
}

function onClickOutside (e: MouseEvent) {
  if (confirmingReset.value && resetButtonRef.value && !resetButtonRef.value.contains(e.target as Node)) {
    confirmingReset.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));

function findNode (nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    const found = findNode(n.children, path);
    if (found) return found;
  }
  return null;
}

function startRename (path: string) {
  const node = findNode(tree.value, path);
  renamingPath.value = path;
  renameValue.value = node?.name ?? Filepath.from(path).basename;
  nextTick(() => renameInputEl.value?.select());
}

function ensureDbmlExtension (name: string): string {
  return Filepath.from('/' + name).extname ? name : name + '.dbml';
}

function commitRename () {
  if (!renamingPath.value) return;
  const node = findNode(tree.value, renamingPath.value);
  const rawName = renameValue.value.trim();
  if (!rawName || !node) { renamingPath.value = null; return; }

  const newName = node.type === 'file' ? ensureDbmlExtension(rawName) : rawName;
  if (newName === node.name) { renamingPath.value = null; return; }

  const oldFp = Filepath.from(renamingPath.value);
  const newFp = Filepath.from(oldFp.dirname).join(newName);

  if (node.type === 'file') {
    project.renameFile(oldFp.absolute, newFp.absolute);
  } else {
    project.renameFolder(oldFp.absolute, newFp.absolute);
  }
  renamingPath.value = null;
}

function cancelRename () {
  renamingPath.value = null;
}

function deleteFolder (folderPath: string) {
  project.deleteFolder(folderPath);
}

function uniquePath (base: string, ext: string): string {
  const existing = new Set(Object.keys(project.files));
  let path = `${base}${ext}`;
  let n = 1;
  while (existing.has(path)) path = `${base}-${n++}${ext}`;
  return path;
}

function createFile () {
  const path = uniquePath('/untitled', '.dbml');
  project.addFile(path, '');
  nextTick(() => startRename(path));
}

function createFolder () {
  pendingNode.value = {
    type: 'folder',
    parentPath: '',
  };
  pendingValue.value = '';
  nextTick(() => pendingInputEl.value?.focus());
}

function createFileInFolder (folderPath: string) {
  pendingNode.value = {
    type: 'file',
    parentPath: folderPath,
  };
  pendingValue.value = '';
  nextTick(() => pendingInputEl.value?.focus());
}

function commitPending () {
  if (!pendingNode.value) return;
  const rawName = pendingValue.value.trim();
  if (rawName) {
    const {
      type, parentPath,
    } = pendingNode.value;
    const parentFp = parentPath ? Filepath.from(parentPath) : Filepath.from('/');
    const childFp = parentFp.join(rawName);
    if (type === 'folder') {
      project.addFolder(childFp.absolute);
    } else {
      const fileFp = childFp.extname ? childFp : Filepath.from(childFp.absolute + '.dbml');
      project.addFile(fileFp.absolute, '');
    }
  }
  pendingNode.value = null;
}

function cancelPending () {
  pendingNode.value = null;
}
</script>
