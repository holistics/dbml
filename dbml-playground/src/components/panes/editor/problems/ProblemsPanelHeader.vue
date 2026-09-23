<template>
  <div class="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
    <div class="flex items-center gap-2">
      <span class="text-[14px] font-bold text-gray-900">Problems</span>
      <span class="text-[13px] text-gray-500">{{ total }} in this file</span>
    </div>
    <div class="flex items-center gap-1 ml-auto">
      <button
        class="px-2.5 py-0.5 text-[12px] rounded-md transition-colors cursor-pointer"
        :class="modelValue === 'all' ? 'bg-gray-100 text-gray-800 font-semibold' : 'text-gray-400 hover:bg-gray-50'"
        @click="emit('update:modelValue', 'all')"
      >
        All {{ total }}
      </button>
      <button
        v-if="errorCount > 0"
        class="flex items-center gap-1.5 px-2 py-0.5 text-[12px] rounded-md transition-colors cursor-pointer"
        :class="modelValue === 'error' ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-50'"
        @click="emit('update:modelValue', 'error')"
      >
        <span class="w-[7px] h-[7px] rounded-full bg-red-500" />
        {{ errorCount }}
      </button>
      <button
        v-if="warningCount > 0"
        class="flex items-center gap-1.5 px-2 py-0.5 text-[12px] rounded-md transition-colors cursor-pointer"
        :class="modelValue === 'warning' ? 'bg-yellow-50 text-yellow-600' : 'text-gray-500 hover:bg-gray-50'"
        @click="emit('update:modelValue', 'warning')"
      >
        <span class="w-[7px] h-[7px] rounded-full bg-yellow-400" />
        {{ warningCount }}
      </button>
      <button
        v-if="infoCount > 0"
        class="flex items-center gap-1.5 px-2 py-0.5 text-[12px] rounded-md transition-colors cursor-pointer"
        :class="modelValue === 'info' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'"
        @click="emit('update:modelValue', 'info')"
      >
        <span class="w-[7px] h-[7px] rounded-full bg-blue-500" />
        {{ infoCount }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiagnosticFilter } from '@/types';

defineProps<{
  modelValue: DiagnosticFilter;
  total: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DiagnosticFilter];
}>();
</script>
