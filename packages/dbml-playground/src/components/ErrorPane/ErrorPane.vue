<template>
  <pane max-size='40' size='40'>
    <slot>
      <ul v-if='errors.length'>
        <li v-for='error in errors' :key='error'>
          <p> {{ error }} </p>
        </li>
      </ul>

      <p v-else>
        No errors found
      </p>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Pane } from 'splitpanes';
  import type { Compiler } from '@dbml/parse';

  const { compiler } = defineProps<{ compiler: Compiler }>();
  const errors = computed(() => compiler.parse.errors());
</script>
