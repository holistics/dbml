<template>
  <div>
    <div
      class="flex items-center gap-2 border-b"
      :class="[
        dense ? 'py-[3px]' : 'py-1',
        heading ? 'bg-gray-50/60 border-gray-100 select-none' : ['border-gray-50', hoverClass],
        expandable ? 'cursor-pointer select-none' : '',
      ]"
      :style="{ paddingLeft: `${indentFor(level)}px`, paddingRight: '12px' }"
      @click="expandable && (open = !open)"
    >
      <PhCaretRight
        v-if="expandable"
        class="w-3.5 h-3.5 text-gray-400 transition-transform duration-100 flex-shrink-0"
        :class="open ? 'rotate-90' : ''"
      />
      <VTooltip
        v-if="icon && tooltip"
        placement="right"
        :distance="6"
      >
        <component
          :is="icon"
          class="w-3.5 h-3.5 flex-shrink-0"
          :class="iconColor"
        />
        <template #popper>
          <span class="text-xs">{{ tooltip }}</span>
        </template>
      </VTooltip>
      <component
        :is="icon"
        v-else-if="icon"
        class="w-3.5 h-3.5 flex-shrink-0"
        :class="iconColor"
      />
      <slot />
      <span
        v-if="slots.trailing"
        class="ml-auto flex-shrink-0 flex items-center gap-1"
      >
        <slot name="trailing" />
      </span>
    </div>
    <!-- Always-visible nested content (e.g. metadata), one level deeper -->
    <slot name="attached" />
    <!-- Collapsible nested content, one level deeper -->
    <slot
      v-if="expandable && open"
      name="children"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, useSlots, type Component,
} from 'vue';
import { PhCaretRight } from '@phosphor-icons/vue';
import { indentFor, useDbTreeLevel } from './dbTree';

// Tailwind needs literal class names, so hover colors go through a lookup.
const HOVER_CLASSES = {
  blue: 'hover:bg-blue-50',
  indigo: 'hover:bg-indigo-50',
  pink: 'hover:bg-pink-50',
  yellow: 'hover:bg-yellow-50',
} as const;

const {
  icon = undefined,
  iconColor = 'text-gray-500',
  tooltip = '',
  hover = 'blue',
  dense = false,
  heading = false,
} = defineProps<{
  icon?: Component;
  iconColor?: string;
  tooltip?: string;
  hover?: keyof typeof HOVER_CLASSES;
  /** Tighter vertical padding, used for nested leaf rows. */
  dense?: boolean;
  /** Subtle grouping header style (no hover highlight). */
  heading?: boolean;
}>();

const level = useDbTreeLevel();
const slots = useSlots();
// A row is expandable iff it was given children.
const expandable = computed(() => !!slots.children);
const hoverClass = computed(() => HOVER_CLASSES[hover]);
const open = ref(false);
</script>
