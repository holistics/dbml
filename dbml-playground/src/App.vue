<template>
  <div class="h-screen flex flex-col bg-gray-100">
    <header class="bg-white border-b border-gray-200 flex-shrink-0 h-14">
      <div class="w-full h-full px-6 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <img
            src="/dbml-logo.png"
            alt="DBML Logo"
            class="h-6 w-auto"
          >
          <span class="text-base font-semibold text-gray-900">DBML Playground</span>
          <span class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            {{ displayVersion === 'development' ? 'development' : `v${displayVersion}` }}
          </span>
        </div>
        <div class="flex items-center gap-4">
          <button
            class="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 text-xs font-medium leading-none border rounded transition-colors cursor-pointer"
            :class="copySuccess
              ? 'text-blue-700 border-blue-300 bg-blue-50'
              : 'text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400'"
            @click="copyShareUrl"
          >
            <CheckIcon
              v-if="copySuccess"
              class="w-3.5 h-3.5 flex-shrink-0"
            />
            <ClipboardDocumentCheckIcon
              v-else
              class="w-3.5 h-3.5 flex-shrink-0"
            />
            {{ copySuccess ? 'Copied!' : 'Copy link' }}
          </button>
          <a
            href="https://dbml.dbdiagram.io"
            target="_blank"
            class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Docs
          </a>
          <a
            href="https://github.com/holistics/dbml"
            target="_blank"
            class="text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="GitHub"
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </div>
    </header>

    <div
      v-if="project.isLarge"
      class="flex-shrink-0 bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 text-xs text-yellow-800 flex items-center gap-2"
    >
      <span class="font-medium">Project too large to share.</span>
      <span>Reduce file sizes to enable the Copy link button.</span>
    </div>

    <div
      class="h-0.5 flex-shrink-0 transition-opacity duration-200"
      :class="parser.isLoading ? 'opacity-100' : 'opacity-0'"
    >
      <div class="h-full bg-blue-500 animate-pulse w-full" />
    </div>

    <main class="flex-1 overflow-hidden p-2">
      <Splitpanes class="h-full">
        <Pane
          :size="15"
          :min-size="10"
          :max-size="30"
        >
          <FilesPane />
        </Pane>
        <Pane
          :size="42"
          :min-size="20"
          :max-size="70"
        >
          <EditorPane
            v-model="project.currentContent"
            @editor-mounted="onDbmlEditorMounted"
            @cursor-move="(pos) => { dbmlCursorPos.value = pos }"
          />
        </Pane>
        <Pane
          :min-size="20"
          :max-size="70"
        >
          <div class="flex flex-col h-full bg-white rounded border border-gray-200 overflow-hidden">
            <OutputPane ref="outputPaneRef" />
          </div>
        </Pane>
      </Splitpanes>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  ref, provide, onMounted, onBeforeUnmount,
} from 'vue';
import {
  Splitpanes, Pane,
} from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import {
  ClipboardDocumentCheckIcon, CheckIcon,
} from '@heroicons/vue/24/outline';
import {
  useParser,
} from '@/stores/parserStore';
import {
  useProject,
} from '@/stores/projectStore';
import FilesPane from '@/components/panes/files/FilesPane.vue';
import EditorPane from '@/components/panes/editor/EditorPane.vue';
import OutputPane from '@/components/panes/output/OutputPane.vue';
import * as monaco from 'monaco-editor';
import logger from '@/utils/logger';
import packageJson from '../package.json';

const parser = useParser();
const project = useProject();

const copySuccess = ref(false);

async function copyShareUrl () {
  const url = project.getShareUrl();
  if (!url) {
    logger.warn('Project too large to share');
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    copySuccess.value = true;
    setTimeout(() => { copySuccess.value = false; }, 2000);
  } catch (err) {
    logger.warn('Failed to copy to clipboard:', err);
  }
}

function onKeyDown (e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    project.saveNow();
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));

const dbmlEditorRef = ref<monaco.editor.IStandaloneCodeEditor | null>(null);
let dbmlEditor: monaco.editor.IStandaloneCodeEditor | null = null;
const dbmlCursorPos = ref({
  line: 1,
  column: 1,
});
const outputPaneRef = ref<InstanceType<typeof OutputPane> | null>(null);

const onDbmlEditorMounted = (editor: monaco.editor.IStandaloneCodeEditor) => {
  dbmlEditor = editor;
  dbmlEditorRef.value = editor;
  parser.setupMonacoServices(editor);
};

provide('getDbmlEditor', () => dbmlEditor);
provide('dbmlEditorRef', dbmlEditorRef);
provide('dbmlCursorPos', dbmlCursorPos);

const version = packageJson.version;
const isUsingWorkspaceVersion = packageJson.dependencies['@dbml/parse'].startsWith('workspace:');
const displayVersion = isUsingWorkspaceVersion ? 'development' : version;
</script>

<style>
.v-popper--theme-dropdown .v-popper__arrow-container {
  display: none !important;
}

.splitpanes__splitter {
  background: transparent !important;
  width: 8px !important;
  min-width: 8px !important;
  border: none !important;
  cursor: col-resize;
}
.splitpanes__splitter:hover {
  background: transparent !important;
}

html, body {
  height: 100%;
  overflow: hidden;
}

#app {
  height: 100vh;
  overflow: hidden;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
