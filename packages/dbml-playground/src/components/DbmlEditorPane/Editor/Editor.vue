<template>
  <div ref='editorRef' class='w-full h-full p-1'></div>
</template>

<script setup lang="ts">
  import { ref, onMounted, watch, } from 'vue';
  import * as monaco from 'monaco-editor';
  import { services } from '@dbml/parse';
  import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker&inline';
  import { initialCode } from './initialCode';
  import { useCompilerStore } from '@/stores/compiler';

  const editorWorker = new EditorWorker();

  (window as any).MonacoEnvironment = {
    getWorker () {
      return editorWorker;
    },
  };

  const emit = defineEmits<{
    (e: 'source-change', source: string): void,
  }>();

  const editorRef = ref(null);
  let editor: monaco.editor.ICodeEditor | null = null;
  let model: monaco.editor.ITextModel | null = null;
  
  watch(
    () => undefined,
    () => {
      const { compiler } = useCompilerStore();
      const languageServices = compiler.initMonacoServices();
      monaco.languages.register({ id: 'dbml' });
      monaco.languages.registerDefinitionProvider('dbml', languageServices.definitionProvider);
      monaco.languages.registerReferenceProvider('dbml', languageServices.referenceProvider);
      monaco.languages.registerCompletionItemProvider('dbml', languageServices.autocompletionProvider);
    },
    { once: true, immediate: true },
  );

  onMounted(() => {
    editor = monaco.editor.create(editorRef.value, {
      language: 'dbml',
      value: initialCode,
      automaticLayout: true,
    });
    emit('source-change', initialCode);       

    model = editor.getModel();

    model.onDidChangeContent(() => {
      const currentSource = model.getValue();
      emit('source-change', currentSource);       
    });
  }); 
</script>
