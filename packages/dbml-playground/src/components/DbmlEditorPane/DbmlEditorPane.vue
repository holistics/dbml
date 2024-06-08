<template>
  <pane min-size='70' max-size='70' size='70'>
    <slot>
      <Editor class='h-full overflow-auto bg-white border rounded border-gray-300 flex flex-col p-2'/>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
  import Editor from './Editor/Editor.vue';
</script>
