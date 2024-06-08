<template>
  <splitpane vertical>
    <splitpane horizontal>
      <splitpane vertical>
        <FileTreePane />
        <DbmlEditorPane />
      </splitpane>
      <ErrorPane />
    </splitpane>
    <AstExplorerPane />
  </splitpane>
</template>

<script setup lang="ts">
  import { Splitpanes } from 'splitpanes';
  import AstExplorerPane from '../components/AstExplorerPane/AstExplorerPane.vue'
  import ErrorPane from '../components/ErrorPane/ErrorPane.vue'
  import DbmlEditorPane from '../components/DbmlEditorPane/DbmlEditorPane.vue'
  import FileTreePane from '../components/FileTreePane/FileTreePane.vue'
</script>
