<template>
  <div>
    <div
      class="flex items-center gap-2 py-[3px] cursor-pointer border-b border-gray-50 hover:bg-blue-50"
      :style="{ paddingLeft: `${8 + level * 14}px`, paddingRight: '12px' }"
      @click="emit('symbol-click', sym)"
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
      <VTooltip placement="bottom" :distance="6" class="flex-shrink-0">
        <component
          :is="icon"
          class="w-3.5 h-3.5"
          :class="iconColor"
        />
        <template #popper>
          <span class="text-xs font-mono">{{ sym.kind }}</span>
        </template>
      </VTooltip>
      <span class="text-blue-500">{{ sym.name }}</span>
    </div>
    <template v-if="open && hasMembers">
      <SymbolRow
        v-for="child in sym.members"
        :key="child.id"
        :sym="child"
        :level="level + 1"
        @symbol-click="emit('symbol-click', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, type Component,
} from 'vue';
import {
  PhCaretRight,
  PhTable,
  PhListBullets,
  PhArrowsLeftRight,
  PhFolder,
  PhAt,
} from '@phosphor-icons/vue';
import type {
  SymbolInfo,
} from '@/stores/parserStore';

interface Props {
  sym: SymbolInfo;
  level?: number;
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
});

const emit = defineEmits<{ 'symbol-click': [sym: SymbolInfo] }>();

const open = ref(false);
function toggleOpen () { open.value = !open.value; }

const hasMembers = computed(() => props.sym.members.length > 0);

const KIND_ICONS: Record<string, Component> = {
  'Table': PhTable,
  'Column': PhListBullets,
  'Ref': PhArrowsLeftRight,
  'Enum': PhListBullets,
  'Enum field': PhListBullets,
  'TableGroup': PhFolder,
  'Schema': PhFolder,
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

const icon = computed((): Component => KIND_ICONS[props.sym.kind] ?? PhAt);
const iconColor = computed(() => KIND_COLORS[props.sym.kind] ?? 'text-gray-400');
</script>
