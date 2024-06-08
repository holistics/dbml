<template>
  <splitpanes vertical>
    <splitpanes horizontal>
      <splitpanes vertical>
        <FileTreePane />
        <DbmlEditorPane />
      </splitpanes>
      <ErrorPane />
    </splitpanes>
    <AstExplorerPane />
  </splitpanes>
</template>

<script setup lang="ts">
  import { Splitpanes } from 'splitpanes';
  import AstExplorerPane from '../components/AstExplorerPane/AstExplorerPane.vue'
  import ErrorPane from '../components/ErrorPane/ErrorPane.vue'
  import DbmlEditorPane from '../components/DbmlEditorPane/DbmlEditorPane.vue'
  import FileTreePane from '../components/FileTreePane/FileTreePane.vue'
</script>
