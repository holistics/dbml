<template>
  <splitpanes vertical class='default-theme w-full h-full'>
    <pane max-size='70' size='70'>
      <splitpanes horizontal>
        <pane max-size='60' size='60'>
          <splitpanes vertical>
            <FileTreePane />
            <DbmlEditorPane :compiler="compiler"/>
          </splitpanes>
        </pane>
        <ErrorPane :compiler="compiler"/>
      </splitpanes>
    </pane>
    <AstExplorerPane :compiler="compiler"/>
  </splitpanes>
</template>

<script setup lang="ts">
  import { Splitpanes, Pane } from 'splitpanes';
  import 'splitpanes/dist/splitpanes.css';
  import AstExplorerPane from '../components/AstExplorerPane/AstExplorerPane.vue'
  import ErrorPane from '../components/ErrorPane/ErrorPane.vue'
  import DbmlEditorPane from '../components/DbmlEditorPane/DbmlEditorPane.vue'
  import FileTreePane from '../components/FileTreePane/FileTreePane.vue'
  import { Compiler } from '@dbml/parse';

  const compiler = new Compiler();
</script>
