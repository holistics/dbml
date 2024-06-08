<template>
  <pane min-size='70' size='70'>
    <slot>
      <Editor class='w-full h-full'/>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
  import Editor from './Editor/Editor.vue';
</script>
