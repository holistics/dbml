<template>
  <div>
    <div
      class="flex items-center gap-2 py-[3px] cursor-pointer border-b border-gray-50 hover:bg-blue-50"
      :style="{ paddingLeft: `${8 + level * 14}px`, paddingRight: '12px' }"
      @click="emit('symbol-click', symbol)"
    >
      <PhCaretRight
        v-if="hasMembers"
        class="flex-shrink-0 w-3 h-3 text-gray-400 transition-transform duration-100"
        :class="open ? 'rotate-90' : ''"
        @click.stop="toggleOpen()"
      />
      <span
        v-else
        class="flex-shrink-0 w-3"
      />
      <VTooltip
        placement="bottom"
        :distance="6"
        class="flex-shrink-0"
      >
        <component
          :is="icon"
          class="w-3.5 h-3.5"
          :class="iconColor"
        />
        <template #popper>
          <span class="text-xs font-mono">{{ symbol.kind }}</span>
        </template>
      </VTooltip>
      <span class="text-gray-400 text-xs">{{ symbol.kind }}</span>
      <span class="text-blue-500">{{ symbol.name }}</span>
    </div>
    <template v-if="open && hasMembers">
      <SymbolRow
        v-for="child in symbol.members"
        :key="child.id"
        :symbol="child"
        :level="level + 1"
        @symbol-click="emit('symbol-click', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue';
import {
  PhCaretRight,
  PhTable,
  PhListBullets,
  PhArrowsLeftRight,
  PhFolder,
  PhAt,
  PhTextAa,
  PhNumberSquareOne,
  PhPuzzlePiece,
  PhFile,
} from '@phosphor-icons/vue';
import { SymbolKind } from '@dbml/parse';
import type { SymbolInfo } from '@/stores/parserStore';

const {
  symbol,
  level = 0,
} = defineProps<{
  symbol: SymbolInfo;
  level?: number;
}>();

const emit = defineEmits<{ 'symbol-click': [sym: SymbolInfo] }>();

const open = ref(false);
function toggleOpen () { open.value = !open.value; }

const hasMembers = computed(() => symbol.members.length > 0);

const KIND_ICONS: Partial<Record<SymbolKind, Component>> = {
  [SymbolKind.Program]: PhFile,
  [SymbolKind.Schema]: PhFolder,

  [SymbolKind.Table]: PhTable,
  [SymbolKind.Column]: PhListBullets,

  [SymbolKind.TablePartial]: PhPuzzlePiece,
  [SymbolKind.PartialInjection]: PhPuzzlePiece,

  [SymbolKind.Enum]: PhTextAa,
  [SymbolKind.EnumField]: PhNumberSquareOne,

  [SymbolKind.TableGroup]: PhFolder,
  [SymbolKind.TableGroupField]: PhListBullets,

  [SymbolKind.Indexes]: PhArrowsLeftRight,
};

const KIND_COLORS: Partial<Record<SymbolKind, string>> = {
  [SymbolKind.Program]: 'text-gray-500',
  [SymbolKind.Schema]: 'text-orange-500',

  [SymbolKind.Table]: 'text-blue-500',
  [SymbolKind.Column]: 'text-gray-500',

  [SymbolKind.TablePartial]: 'text-teal-500',
  [SymbolKind.PartialInjection]: 'text-teal-500',

  [SymbolKind.Enum]: 'text-green-600',
  [SymbolKind.EnumField]: 'text-green-500',

  [SymbolKind.TableGroup]: 'text-yellow-600',
  [SymbolKind.TableGroupField]: 'text-yellow-500',

  [SymbolKind.Indexes]: 'text-purple-500',
};

const icon = computed((): Component => KIND_ICONS[symbol.kind as SymbolKind] ?? PhAt);
const iconColor = computed(() => KIND_COLORS[symbol.kind as SymbolKind] ?? 'text-gray-400');
</script>
