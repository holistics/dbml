<template>
  <pane min-size='30' max-size='30' size='30'>
    <slot>
      <section class='h-full overflow-auto bg-dark border rounded border-gray-300 flex flex-col p-4 text-sm text-gray-400'>
        <ul v-if='errors.length' class='list-none'>
          <li v-for='error in errors' :key='error'>
            <p class='font-light flex gap-2 items-center'>
              <FontAwesomeIcon :icon='faExclamationCircle' class='text-red-500' />
              {{ error }}
            </p>
          </li>
        </ul>

        <p v-else class='font-light flex gap-2 items-center'>
          <FontAwesomeIcon :icon='faCheckCircle' class='text-green-400' />
          <span>No errors.</span>
        </p>
      </section>
    </slot>
  </pane>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Pane } from 'splitpanes';
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
  import { faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
  import { useCompilerStore } from '@/stores/compiler';

  const compiler = useCompilerStore();
  const errors = computed(() => compiler.errors)
</script>
