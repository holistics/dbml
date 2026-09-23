<template>
  <VDropdown
    ref="dropdown"
    :distance="4"
    placement="bottom-start"
    :arrow-padding="0"
    :container="container"
    no-auto-focus
  >
    <button
      class="max-w-[200px] px-2.5 py-1 text-xs border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-1"
      @click.stop
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <svg
        class="w-3 h-3 text-gray-400 flex-shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      ><path d="M3 4.5L6 7.5L9 4.5" /></svg>
    </button>
    <template #popper>
      <div class="py-1 max-w-[16rem]">
        <button
          v-for="(option, i) in options"
          :key="i"
          class="w-full text-left px-3 py-1.5 text-xs cursor-pointer"
          :class="modelValue === i ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'"
          @click.stop="select(i)"
        >
          {{ option }}
        </button>
      </div>
    </template>
  </VDropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  options: readonly string[];
  labels?: readonly string[];
  modelValue: number;
  container?: HTMLElement;
}>();

const emit = defineEmits<{
  'update:modelValue': [index: number];
}>();

const dropdown = ref<any>(null);

const selectedLabel = computed(() => (props.labels ?? props.options)[props.modelValue] ?? '');

function select (i: number) {
  emit('update:modelValue', i);
  dropdown.value?.hide();
}
</script>
