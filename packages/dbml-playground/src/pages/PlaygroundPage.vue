<template>
  <splitpanes vertical>
    <splitpanes horizontal>
      <splitpanes vertical>
        <FileTreePane />
        <DbmlEditorPane :compiler="compiler"/>
      </splitpanes>
      <ErrorPane :compiler="compiler"/>
    </splitpanes>
    <AstExplorerPane :compiler="compiler"/>
  </splitpanes>
</template>

<script setup lang="ts">
  import { Splitpanes } from 'splitpanes';
  import AstExplorerPane from '../components/AstExplorerPane/AstExplorerPane.vue'
  import ErrorPane from '../components/ErrorPane/ErrorPane.vue'
  import DbmlEditorPane from '../components/DbmlEditorPane/DbmlEditorPane.vue'
  import FileTreePane from '../components/FileTreePane/FileTreePane.vue'
  import { Compiler } from '@dbml/parse';

  const compiler = new Compiler();
</script>
