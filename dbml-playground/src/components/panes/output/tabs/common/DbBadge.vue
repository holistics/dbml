<template>
  <span
    class="text-[10px] px-1 rounded"
    :class="colorClass"
  >{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const {
  color = 'gray', label,
} = defineProps<{
  label: string;
  color?: 'blue' | 'gray' | 'purple' | 'orange' | 'indigo';
}>();

const colorClass = computed(() => ({
  blue: 'bg-blue-100 text-blue-600',
  gray: 'bg-gray-100 text-gray-500',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  indigo: 'bg-indigo-100 text-indigo-600',
}[color]));
</script>
