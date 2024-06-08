<template>
  <pane min-size='30' max-size='30' size='30'>
    <slot>
      <section class='h-full overflow-auto bg-white border rounded border-gray-300 flex flex-col p-2'>
        <ul v-if='errors.length'>
          <li v-for='error in errors' :key='error'>
            <p> {{ error }} </p>
          </li>
        </ul>

        <p v-else>
          No errors found
        </p>
      </section>
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
