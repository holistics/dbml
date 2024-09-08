<template>
  <pane max-size='30' min-size='30' size='30'>
    <slot>
      <section class='h-full bg-white overflow-auto border rounded border-gray-300 flex flex-col p-2'>
      </section>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
</script>
