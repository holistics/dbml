<template>
  <pane min-size='25' max-size='25' size='25'>
    <slot>
      <section class='h-full overflow-auto border rounded border-gray-300 flex flex-col p-2'>
      </section>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
</script>
