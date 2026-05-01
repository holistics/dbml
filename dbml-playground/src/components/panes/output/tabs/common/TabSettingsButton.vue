<template>
  <VDropdown
    placement="bottom-end"
    :distance="6"
    :arrow-padding="0"
    no-auto-focus
  >
    <button class="flex items-center gap-1 text-gray-400 hover:text-gray-700 cursor-pointer transition-colors">
      <PhGear class="w-3.5 h-3.5" />
    </button>
    <template #popper>
      <div class="py-1 px-1 min-w-[140px]">
        <button
          class="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-gray-100 transition-colors text-gray-700"
          @click="emit('toggle-decoration')"
        >
          <PhEye
            v-if="showDecoration"
            class="w-3.5 h-3.5 text-blue-500"
          />
          <PhEyeSlash
            v-else
            class="w-3.5 h-3.5 text-gray-400"
          />
          <span>Decorations</span>
          <span class="ml-auto text-[10px] text-gray-400">{{ showDecoration ? 'on' : 'off' }}</span>
        </button>
      </div>
    </template>
  </VDropdown>
</template>

<script setup lang="ts">
import {
  PhGear, PhEye, PhEyeSlash,
} from '@phosphor-icons/vue';

const {
  showDecoration = false,
} = defineProps<{
  showDecoration?: boolean;
}>();
const emit = defineEmits<{ 'toggle-decoration': [] }>();
</script>
