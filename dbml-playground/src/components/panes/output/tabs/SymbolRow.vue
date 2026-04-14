<template>
  <div>
    <div
      class="flex items-center gap-2 py-[3px] cursor-pointer border-b border-gray-50 hover:bg-blue-50"
      :style="{ paddingLeft: `${8 + level * 14}px`, paddingRight: '12px' }"
      @click="hasMembers && toggleOpen()"
    >
      <ChevronRightIcon
        v-if="hasMembers"
        class="flex-shrink-0 w-3 h-3 text-gray-400 transition-transform duration-100"
        :class="open ? 'rotate-90' : ''"
      />
      <span
        v-else
        class="flex-shrink-0 w-3"
      />
      <component
        :is="icon"
        class="flex-shrink-0 w-3.5 h-3.5"
        :class="iconColor"
      />
      <span class="text-blue-500 min-w-[80px]">{{ sym.name }}</span>
      <span class="text-gray-400 text-xs">{{ sym.kind }}</span>
      <span
        v-if="sym.declPos"
        class="ml-auto text-[10px] text-blue-400 hover:underline hover:text-blue-600 cursor-pointer flex-shrink-0"
        @click.stop="emit('declaration-click', sym.declPos)"
      >{{ sym.declPos.startLine }}:{{ sym.declPos.startCol }}</span>
    </div>
    <template v-if="open && hasMembers">
      <SymbolRow
        v-for="child in sym.members"
        :key="child.id"
        :sym="child"
        :level="level + 1"
        @declaration-click="emit('declaration-click', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, type Component,
} from 'vue';
import {
  ChevronRightIcon,
  TableCellsIcon,
  ListBulletIcon,
  ArrowsRightLeftIcon,
  FolderIcon,
  AtSymbolIcon,
} from '@heroicons/vue/24/outline';
import type {
  SymbolInfo, DeclPos,
} from '@/stores/parserStore';

interface Props {
  sym: SymbolInfo;
  level?: number;
}

const props = withDefaults(defineProps<Props>(), { level: 0 });
const emit = defineEmits<{
  'declaration-click': [pos: DeclPos];
}>();

const open = ref(false);
function toggleOpen () { open.value = !open.value; }

const hasMembers = computed(() => props.sym.members.length > 0);

const KIND_ICONS: Record<string, Component> = {
  'Table': TableCellsIcon,
  'Column': ListBulletIcon,
  'Ref': ArrowsRightLeftIcon,
  'Enum': ListBulletIcon,
  'Enum field': ListBulletIcon,
  'TableGroup': FolderIcon,
  'Schema': FolderIcon,
};

const KIND_COLORS: Record<string, string> = {
  'Table': 'text-blue-500',
  'Column': 'text-gray-500',
  'Ref': 'text-purple-500',
  'Enum': 'text-green-600',
  'Enum field': 'text-green-500',
  'TableGroup': 'text-yellow-600',
  'Schema': 'text-orange-500',
};

const icon = computed((): Component => KIND_ICONS[props.sym.kind] ?? AtSymbolIcon);
const iconColor = computed(() => KIND_COLORS[props.sym.kind] ?? 'text-gray-400');
</script>
