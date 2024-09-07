<template>
  <splitpanes vertical class='default-theme w-full h-full p-2 bg-gray-300'>
    <pane min-size='70' max-size='70' size='70'>
      <splitpanes horizontal class='bg-gray-300'>
        <pane min-size='70' max-size='70' size='70'>
          <splitpanes vertical class='bg-gray-300'>
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
  background-color: rgb(209, 213, 219) !important;
  &::before {
    background-color: #1e1e1e !important;
  }
  &::after {
    background-color: #1e1e1e !important;
  }
}
</style>
