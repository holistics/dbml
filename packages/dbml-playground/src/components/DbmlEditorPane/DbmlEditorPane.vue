<template>
  <pane min-size='75' max-size='75' size='75'>
    <slot>
      <Editor
        class='h-full overflow-auto bg-white border rounded border-gray-300 flex flex-col'
        @source-change='(newSource) => compiler.setSource(newSource)'
      />
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
  import Editor from './Editor/Editor.vue';
  import { useCompilerStore } from '@/stores/compiler';

  const compiler = useCompilerStore();
</script>
