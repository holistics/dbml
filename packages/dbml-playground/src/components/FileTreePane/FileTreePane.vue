<template>
  <pane min-size='30' max-size='30' size='30'>
    <slot>
      <section class='h-full overflow-auto bg-dark font-white border rounded border-gray-300 flex flex-col p-2'>
      </section>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
</script>
