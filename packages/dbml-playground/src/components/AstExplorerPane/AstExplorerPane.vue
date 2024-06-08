<template>
  <pane max-size='30' min-size='30' size='30'>
    <slot>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
</script>
