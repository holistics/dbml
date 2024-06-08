<template>
  <pane>
    <slot>
      <Editor />
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
  import Editor from './Editor/Editor.vue';
</script>
