<template>
  <div class="h-full flex flex-col">
    <div
      v-if="ast != null"
      class="flex-shrink-0 px-3 py-1 border-b border-gray-200 text-xs text-gray-400 flex items-center justify-between"
    >
      <span>{{ nodeCount }} nodes</span>
      <TabSettingsButton :show-decor="showDecor" @toggle-decor="emit('toggle-decor')" />
    </div>
    <div class="flex-1 overflow-auto">
      <RawAstTreeView
        v-if="ast != null"
        :raw-ast="ast"
        @node-click="emit('node-click', $event)"
      />
      <div
        v-else
        class="text-center text-gray-400 py-8 text-sm"
      >
        No AST data
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
} from 'vue';
import TabSettingsButton from './TabSettingsButton.vue';
import RawAstTreeView from '../ast/RawAstTreeView.vue';
import type {
  RawAstNode,
} from '../ast/RawAstTreeNode.vue';
import type {
  ProgramNode,
} from '@dbml/parse';

interface Props {
  ast: ProgramNode | null;
  showDecor?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'node-click': [node: RawAstNode];
  'toggle-decor': [];
}>();

// Properties that reference outside the AST tree (symbols, parents, sources).
// Skipping these keeps the traversal bounded to the syntax tree itself.
const COUNT_SKIP = new Set(['parentNode', 'parent', 'symbol', 'referee', 'source', 'filepath']);

// Count SyntaxNode-like objects (those with a 'kind' own property).
// Only traverses downward tree edges; uses a WeakSet to guard against any
// remaining cycles.
function countNodes (obj: unknown, seen = new WeakSet()): number {
  if (!obj || typeof obj !== 'object') return 0;
  if (seen.has(obj as object)) return 0;
  seen.add(obj as object);
  if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countNodes(item, seen), 0);
  const isNode = Object.prototype.hasOwnProperty.call(obj, 'kind');
  const childSum = Object.entries(obj as Record<string, unknown>)
    .filter(([k]) => !COUNT_SKIP.has(k))
    .reduce((sum, [, v]) => sum + countNodes(v, seen), 0);
  return (isNode ? 1 : 0) + childSum;
}

const nodeCount = computed(() => countNodes(props.ast));
</script>
