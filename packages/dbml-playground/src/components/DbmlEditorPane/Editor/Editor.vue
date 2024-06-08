<template>
  <div ref='editorDomNode' class='w-full h-full'></div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import * as monaco from 'monaco-editor';
  
  const editorDomNode = ref(null);
  const editor = ref<monaco.editor.IEditor | null>(null);
  onMounted(() => {
    editor.value = monaco.editor.create(editorDomNode.value, {
      value: '',
      automaticLayout: true,
      theme: 'vs-dark'
    });
  });
</script>
