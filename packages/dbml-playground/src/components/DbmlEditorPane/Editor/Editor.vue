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

  const editorDomNode = ref(null);
  const editor = ref<monaco.editor.ICodeEditor | null>(null);
  
  onMounted(() => {
    editor.value = monaco.editor.create(editorDomNode.value, {
      value: '',
      automaticLayout: true,
      theme: 'vs-dark'
    });
  });

  const emit = defineEmits<{
    (e: 'sourceChange', source: string): void,
  }>();

  onMounted(() => {
    editor.value
      .getModel()
      .onDidChangeContent(() => {
        emit('sourceChange', editor.value.getModel().getValue());       
      });
  });
</script>
