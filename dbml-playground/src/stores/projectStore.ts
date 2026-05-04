import {
  ref, computed, watch,
} from 'vue';
import {
  defineStore,
} from 'pinia';
import {
  debounce,
} from 'lodash-es';
import {
  DEFAULT_SAMPLE_CONTENT,
} from '@/services/sample-content';
import logger from '../utils/logger';
import {
  DEFAULT_ENTRY,
} from '@dbml/parse';

const PROJECT_KEY = 'PROJECT_DATA';
const CURRENT_FILE_KEY = 'PROJECT_CURRENT_FILE';
const DEFAULT_FILE = DEFAULT_ENTRY.absolute;

const MAX_SHARE_SIZE = 15000;

interface ProjectData {
  files: Record<string, string>;
  folders: string[];
}

/* Compress and decompress project content to url-encoded content */

// So we can share projects without a backend
async function compressToBase64 (input: string): Promise<string> {
  const encoder = new TextEncoder();
  const stream = new Blob([encoder.encode(input)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const compressed = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(compressed);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompressFromBase64 (encoded: string): Promise<string> {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

async function loadFromUrl (): Promise<ProjectData | undefined> {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return undefined;
    const json = await decompressFromBase64(code);
    const decoded = JSON.parse(json);
    if (decoded && typeof decoded === 'object' && 'files' in decoded) return decoded as ProjectData;
    if (decoded && typeof decoded === 'object') return {
      files: decoded as Record<string, string>,
      folders: [],
    };
    return undefined;
  } catch {
    return undefined;
  }
}

// Local storage

function saveProject (files: Record<string, string>, folders: string[]): void {
  const data: ProjectData = {
    files,
    folders,
  };
  localStorage.setItem(PROJECT_KEY, JSON.stringify(data));
}

function initProject (): {
  files: Record<string, string>;
  folders: string[];
  currentFile: string;
} {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (raw) {
      const stored: ProjectData = JSON.parse(raw);
      if (Object.keys(stored.files ?? {}).length > 0) {
        const saved = localStorage.getItem(CURRENT_FILE_KEY);
        const currentFile = (saved && stored.files[saved] !== undefined) ? saved : Object.keys(stored.files).sort()[0];
        return {
          files: stored.files,
          folders: stored.folders ?? [],
          currentFile,
        };
      }
    }
  } catch (_err) {
    logger.warn('Failed to load project from storage');
  }

  const files = {
    [DEFAULT_FILE]: DEFAULT_SAMPLE_CONTENT,
  };
  saveProject(files, []);
  return {
    files,
    folders: [],
    currentFile: DEFAULT_FILE,
  };
}

export const useProjectStore = defineStore('project', () => {
  const {
    files: initialFiles, folders: initialFolders, currentFile: initialCurrentFile,
  } = initProject();

  const files = ref<Record<string, string>>(initialFiles);
  const folders = ref<string[]>(initialFolders);
  const currentFile = ref<string>(initialCurrentFile);

  // Load from URL asynchronously
  // If ?code= is present, the project is shared
  // We load from there and overwrite the project state
  loadFromUrl().then((fromUrl) => {
    if (!fromUrl || Object.keys(fromUrl.files).length === 0) return;
    files.value = fromUrl.files;
    folders.value = fromUrl.folders ?? [];
    currentFile.value = Object.keys(fromUrl.files).sort()[0];
    saveProject(fromUrl.files, fromUrl.folders ?? []);
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState(null, '', url.toString());
  });

  const currentContent = computed({
    get: () => files.value[currentFile.value] ?? '',
    set: (content: string) => { files.value[currentFile.value] = content; },
  });

  // Warn when the total project size is large enough that sharing will fail.
  const LOCAL_SIZE_WARN_BYTES = 50_000;
  const totalSize = computed(() => Object.values(files.value).reduce((sum, v) => sum + v.length, 0));
  const isLarge = computed(() => totalSize.value > LOCAL_SIZE_WARN_BYTES);

  const persistProject = debounce(() => saveProject(files.value, folders.value), 500);

  watch(files, () => persistProject(), {
    deep: true,
  });
  watch(folders, () => persistProject(), {
    deep: true,
  });

  watch(currentFile, (path) => {
    localStorage.setItem(CURRENT_FILE_KEY, path);
  });

  function setCurrentFile (path: string) {
    if (files.value[path] !== undefined) currentFile.value = path;
  }

  function addFile (path: string, content = '') {
    files.value[path] = content;
    currentFile.value = path;
    persistProject();
  }

  function deleteFile (path: string) {
    delete files.value[path];
    if (currentFile.value === path) {
      const remaining = Object.keys(files.value);
      if (remaining.length === 0) {
        addFile(DEFAULT_FILE);
      } else {
        currentFile.value = remaining.sort()[0];
      }
    }
    persistProject();
  }

  function renameFile (oldPath: string, newPath: string) {
    if (oldPath === newPath || files.value[newPath] !== undefined) return;
    const content = files.value[oldPath] ?? '';
    files.value[newPath] = content;
    delete files.value[oldPath];
    if (currentFile.value === oldPath) {
      currentFile.value = newPath;
    }
    persistProject();
  }

  function addFolder (path: string) {
    if (!folders.value.includes(path)) {
      folders.value.push(path);
      persistProject();
    }
  }

  function deleteFolder (folderPath: string) {
    const prefix = folderPath + '/';
    folders.value = folders.value.filter((f) => f !== folderPath && !f.startsWith(prefix));
    for (const p of Object.keys(files.value).filter((f) => f.startsWith(prefix))) {
      delete files.value[p];
    }
    if (!files.value[currentFile.value]) {
      const remaining = Object.keys(files.value);
      if (remaining.length === 0) addFile(DEFAULT_FILE);
      else currentFile.value = remaining.sort()[0];
    }
    persistProject();
  }

  function renameFolder (oldPath: string, newPath: string) {
    if (oldPath === newPath) return;
    const prefix = oldPath + '/';
    folders.value = folders.value.map((f) => {
      if (f === oldPath) return newPath;
      if (f.startsWith(prefix)) return newPath + '/' + f.slice(prefix.length);
      return f;
    });
    for (const p of Object.keys(files.value).filter((f) => f.startsWith(prefix))) {
      renameFile(p, newPath + '/' + p.slice(prefix.length));
    }
    persistProject();
  }

  function save () {
    saveProject(files.value, folders.value);
  }

  function reset () {
    const defaultFiles = {
      [DEFAULT_FILE]: DEFAULT_SAMPLE_CONTENT,
    };
    files.value = defaultFiles;
    folders.value = [];
    currentFile.value = DEFAULT_FILE;
    saveProject(defaultFiles, []);
  }

  async function getShareUrl (): Promise<string | undefined> {
    try {
      const data: ProjectData = {
        files: files.value,
        folders: folders.value,
      };
      const encoded = await compressToBase64(JSON.stringify(data));
      if (encoded.length > MAX_SHARE_SIZE) return undefined;
      const url = new URL(window.location.href);
      url.searchParams.set('code', encoded);
      return url.toString();
    } catch (_err) {
      logger.warn('Failed to generate share URL');
      return undefined;
    }
  }

  return {
    files,
    folders,
    currentFile,
    currentContent,
    isLarge,
    setCurrentFile,
    addFile,
    deleteFile,
    renameFile,
    addFolder,
    deleteFolder,
    renameFolder,
    save,
    reset,
    getShareUrl,
  };
});
