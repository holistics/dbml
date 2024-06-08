<template>
  <div ref='editorDomNode' class='w-full h-full'></div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import * as monaco from 'monaco-editor';
  import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker&inline';

  const editorWorker = new EditorWorker();

  (window as any).MonacoEnvironment = {
    getWorker () {
      return editorWorker;
    },
  };

  const emit = defineEmits<{
    (e: 'sourceChange', source: string): void,
  }>();

  const editorDomNode = ref(null);
  let editor: monaco.editor.ICodeEditor | null = null;
  let model: monaco.editor.ITextModel | null = null;
  onMounted(() => {
    editor = monaco.editor.create(editorDomNode.value, {
      value: '',
      automaticLayout: true,
      theme: 'vs-dark'
    });

    model = editor.getModel();

    model.onDidChangeContent(() => {
      const currentSource = model.getValue();
      emit('sourceChange', currentSource);       
    });
  }); 
</script>
