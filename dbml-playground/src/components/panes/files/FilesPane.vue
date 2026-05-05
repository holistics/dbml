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
        v-for="treeNode in tree"
        :key="treeNode.path"
        :node="treeNode"
      />
    </div>
  </div>

</template>

<script setup lang="ts">
import {
  ref, computed, provide, onMounted, onUnmounted,
} from 'vue';
import {
  PhFilePlus, PhFolderPlus, PhArrowClockwise,
} from '@phosphor-icons/vue';
import { useProjectStore } from '@/stores/projectStore';
import { Filepath } from '@dbml/parse';
import FileTreeNode from './FileTreeNode.vue';

const project = useProjectStore();

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  depth: number;
}

// Shared editing state (one rename at a time across the whole tree)
const editingPath = ref<string | null>(null);
provide('editingPath', editingPath);

// Tree building

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

  const allEntries: {
    fp: Filepath;
    isFolder: boolean;
  }[] = [
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

// Toolbar actions

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
  editingPath.value = path;
}

function createFolder () {
  const path = uniquePath('/untitled-folder', '');
  project.addFolder(path);
  editingPath.value = path;
}

// Reset

const confirmingReset = ref(false);
const resetButtonRef = ref<HTMLButtonElement | null>(null);
const resetPopoverStyle = ref<{
  top: string;
  left: string;
}>({
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
</script>
