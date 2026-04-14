<template>
  <div
    class="h-full flex flex-col text-[13px]"
    style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
  >
    <div class="flex-shrink-0 px-3 py-1 border-b border-gray-200 text-xs text-gray-400 flex items-center justify-between">
      <span>{{ symbols.length }} symbols</span>
      <DecorToggleButton :show-decor="showDecor" @toggle-decor="emit('toggle-decor')" />
    </div>
    <div class="flex-1 overflow-auto">
      <div
        v-if="symbols.length === 0"
        class="text-center text-gray-400 py-8"
      >
        No symbols
      </div>
      <SymbolRow
        v-for="sym in symbols"
        :key="sym.id"
        :sym="sym"
        :level="0"
        @declaration-click="emit('declaration-click', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import DecorToggleButton from './DecorToggleButton.vue';
import SymbolRow from './SymbolRow.vue';
import type {
  SymbolInfo, DeclPos,
} from '@/stores/parserStore';

interface Props {
  symbols: SymbolInfo[];
  showDecor?: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  'declaration-click': [pos: DeclPos];
  'toggle-decor': [];
}>();
</script>
