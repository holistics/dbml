<template>
  <DbRow
    v-if="entries.length"
    :icon="PhCode"
    icon-color="text-yellow-500"
    tooltip="Metadata"
    hover="yellow"
    dense
  >
    <span class="text-gray-700 font-medium">metadata</span>
    <template #trailing>
      <span class="text-gray-400 text-xs">{{ entries.length }} {{ entries.length === 1 ? 'key' : 'keys' }}</span>
    </template>
    <template #children>
      <DbRow
        v-for="(entry, i) in entries"
        :key="i"
        hover="yellow"
        dense
      >
        <span class="text-yellow-700 font-medium">{{ entry.key }}</span>
        <span class="text-gray-700 truncate">{{ entry.value }}</span>
        <template #trailing>
          <span class="text-green-700">{{ entry.valueType }}</span>
        </template>
      </DbRow>
    </template>
  </DbRow>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PhCode } from '@phosphor-icons/vue';
import type { CustomMetadata } from '@dbml/parse';
import DbRow from './DbRow.vue';

const { metadata = {} } = defineProps<{
  metadata?: CustomMetadata;
}>();

const entries = computed(() => Object.entries(metadata ?? {}).map(([key, entry]) => ({
  key,
  value: typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value),
  valueType: entry.type,
})));
</script>
