<template>
  <div>
    <div
      class="flex items-center gap-2 px-3 py-1 bg-gray-100 border-b border-gray-200 cursor-pointer hover:bg-gray-200 select-none sticky top-0 z-10"
      @click="open = !open"
    >
      <PhCaretRight
        class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
        :class="open ? 'rotate-90' : ''"
      />
      <component
        v-if="icon"
        :is="icon"
        class="w-3.5 h-3.5 flex-shrink-0"
        :class="iconColor"
      />
      <span class="text-gray-700 font-medium">{{ label }}</span>
      <span class="text-gray-400 text-xs">({{ count }})</span>
    </div>
    <slot v-if="open" />
  </div>
</template>

<script setup lang="ts">
import {
  ref, type Component,
} from 'vue';
import {
  PhCaretRight,
} from '@phosphor-icons/vue';

const {
  label,
  count,
  icon = undefined,
  iconColor = 'text-gray-500',
} = defineProps<{
  label: string;
  count: number;
  icon?: Component;
  iconColor?: string;
}>();
const open = ref(true);
</script>
