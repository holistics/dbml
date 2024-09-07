<template>
  <splitpanes vertical class='default-theme w-full h-full p-2'>
    <pane min-size='70' max-size='70' size='70'>
      <splitpanes horizontal>
        <pane min-size='70' max-size='70' size='70'>
          <splitpanes vertical>
            <FileTreePane />
            <DbmlEditorPane />
          </splitpanes>
        </pane>
        <ErrorPane />
      </splitpanes>
    </pane>
    <AstExplorerPane />
  </splitpanes>
</template>

<script setup lang="ts">
  import { reactive } from 'vue';
  import { Splitpanes, Pane } from 'splitpanes';
  import 'splitpanes/dist/splitpanes.css';
  import AstExplorerPane from '../components/AstExplorerPane/AstExplorerPane.vue'
  import ErrorPane from '../components/ErrorPane/ErrorPane.vue'
  import DbmlEditorPane from '../components/DbmlEditorPane/DbmlEditorPane.vue'
  import FileTreePane from '../components/FileTreePane/FileTreePane.vue'
</script>

<style>
div.splitpanes__splitter {
  &::before {
    background-color: #1e1e1e !important;
  }
  &::after {
    background-color: #1e1e1e !important;
  }
}
</style>
