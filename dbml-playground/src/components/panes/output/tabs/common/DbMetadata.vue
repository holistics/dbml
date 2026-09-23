<template>
  <div v-if="entries.length">
    <div
      class="flex items-center gap-1.5 py-[3px] border-b border-gray-50 cursor-pointer select-none hover:bg-yellow-50"
      :style="{ paddingLeft: `${indent}px`, paddingRight: '12px' }"
      @click="open = !open"
    >
      <PhCaretRight
        class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
        :class="open ? 'rotate-90' : ''"
      />
      <VTooltip
        placement="right"
        :distance="6"
      >
        <PhCode class="w-3 h-3 text-yellow-500 flex-shrink-0" />
        <template #popper>
          <span class="text-xs">Metadata</span>
        </template>
      </VTooltip>
      <span class="text-gray-700 font-medium">metadata</span>
      <span class="text-gray-400 text-xs ml-auto">{{ entries.length }} {{ entries.length === 1 ? 'key' : 'keys' }}</span>
    </div>
    <!-- One row per key-value pair -->
    <template v-if="open">
      <div
        v-for="(entry, i) in entries"
        :key="i"
        class="flex items-center gap-2 py-[3px] border-b border-gray-50 hover:bg-yellow-50"
        :style="{ paddingLeft: `${indent + 16}px`, paddingRight: '12px' }"
      >
        <span class="text-yellow-700 font-medium">{{ entry.key }}</span>
        <span class="text-gray-700 truncate">{{ entry.value }}</span>
        <span class="text-green-700 ml-auto">{{ entry.valueType }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { PhCode, PhCaretRight } from '@phosphor-icons/vue';

const { metadata = {}, indent = 40 } = defineProps<{
  metadata?: { [key: string]: unknown };
  indent?: number;
}>();

const open = ref(false);

const entries = computed(() => Object.entries(metadata ?? {}).map(([key, value]) => ({
  key,
  value: typeof value === 'string' ? value : JSON.stringify(value),
  valueType: typeof value,
})));
</script>
