<template>
  <div>
    <div
      ref="rowEl"
      class="flex items-center py-[3px] cursor-pointer select-none"
      :style="{ paddingLeft: `${8 + level * 14}px` }"
      :class="isActive ? 'bg-yellow-100' : 'hover:bg-blue-50'"
      @click="handleNodeClick"
    >
      <!-- chevron -->
      <button
        v-if="isExpandable"
        class="flex-shrink-0 w-3.5 h-3.5 mr-1 flex items-center justify-center text-gray-400 hover:text-gray-600"
        @click.stop="toggleExpanded"
      >
        <PhCaretRight
          class="w-3 h-3 transition-transform duration-100"
          :class="isExpanded ? 'rotate-90' : ''"
        />
      </button>
      <span
        v-else
        class="flex-shrink-0 w-3.5 h-3.5 mr-1"
      />

      <!-- type icon -->
      <VTooltip
        placement="bottom"
        :distance="6"
        class="flex-shrink-0 mr-1.5"
      >
        <component
          :is="typeIcon.icon"
          class="w-3 h-3"
          :class="typeIcon.color"
        />
        <template #popper>
          <span class="text-xs font-mono">{{ typeIcon.label }}</span>
        </template>
      </VTooltip>

      <span class="text-gray-700 mr-2">{{ node.propertyName }}</span>

      <!-- Tokens render with the same value styling the Tokens tab uses so
           the two views stay visually consistent. -->
      <template v-if="isToken">
        <span
          class="truncate"
          :class="isEof ? 'text-red-400 font-semibold' : 'text-green-700'"
        >{{ isEof ? '<EOF>' : (tokenValue || '·') }}</span>
      </template>
      <template v-else>
        <span
          v-if="hintText"
          class="mr-2 truncate"
          :class="hintClass"
        >{{ hintText }}</span>
        <span
          v-if="leafValue !== ''"
          class="text-green-700"
        >{{ leafValue }}</span>
      </template>
      <span
        v-if="sizeHint"
        class="text-gray-400"
      >{{ sizeHint }}</span>
    </div>

    <div v-if="isExpanded && isExpandable">
      <RawAstTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-node="selectedNode"
        :expanded-nodes="expandedNodes"
        :level="level + 1"
        :cursor-node-id="cursorNodeId"
        @node-click="$emit('node-click', $event)"
        @node-expand="$emit('node-expand', $event)"
        @scroll-to="$emit('scroll-to', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, ref, watch,
} from 'vue';
import {
  PhCaretRight,
  PhDiamond,
  PhFile,
  PhTag,
  PhBracketsSquare,
  PhBracketsCurly,
  PhTextAa,
  PhHash,
  PhToggleLeft,
  PhMinus,
  PhLightning,
  PhMathOperations,
  PhDownloadSimple,
  PhPackage,
  PhPlusMinus,
  PhEquals,
  PhTerminal,
  PhLinkSimple,
  PhListDashes,
  PhAlignCenterHorizontal,
  PhTextColumns,
  PhAt,
  PhCaretDoubleDown,
  PhDotsThree,
  PhPath,
} from '@phosphor-icons/vue';
import {
  SyntaxToken,
  SyntaxTokenKind,
  SyntaxNodeKind,
} from '@dbml/parse';
import {
  tokenIconFor,
} from '@/utils/tokenIcons';

export interface RawAstNode {
  id: string;
  propertyName: string;
  rawData: unknown;
  value?: unknown;
  nameHint?: string;
  children: RawAstNode[];
  accessPath: string;
}

type RawObj = Record<string, unknown>;

interface Props {
  node: RawAstNode;
  selectedNode: RawAstNode | null;
  expandedNodes: Set<string>;
  level: number;
  cursorNodeId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'node-click': [node: RawAstNode];
  'node-expand': [{ id: string;
    expanded: boolean; }];
  'scroll-to': [id: string];
}>();

const rowEl = ref<HTMLElement | null>(null);
const isExpanded = computed(() => props.expandedNodes.has(props.node.id));
const isExpandable = computed(() => props.node.children.length > 0);
const isActive = computed(() => props.node.id === props.cursorNodeId || props.selectedNode?.id === props.node.id);

// Scroll into view when this node becomes the active cursor node
watch(isActive, (active) => {
  if (active && rowEl.value) {
    rowEl.value.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }
});

function asObj (d: unknown): RawObj | null {
  return d !== null && typeof d === 'object' && !Array.isArray(d) ? d as RawObj : null;
}

const nodeKind = computed(() => {
  const d = asObj(props.node.rawData);
  return d && typeof d.kind === 'string' ? d.kind : '';
});

// Tokens get a green hint, nodes blue. EOF tokens use the same red/semibold
// `<EOF>` presentation as the Tokens tab.
const isToken = computed(() => props.node.rawData instanceof SyntaxToken);
const isEof = computed(() => isToken.value && (props.node.rawData as SyntaxToken).kind === SyntaxTokenKind.EOF);
const tokenValue = computed(() => isToken.value ? (props.node.rawData as SyntaxToken).value ?? '' : '');
const hintText = computed(() => isEof.value ? '' : (props.node.nameHint ?? ''));
const hintClass = computed(() => isToken.value ? 'text-green-700' : 'text-blue-600');

interface IconInfo { icon: typeof PhDiamond;
  color: string;
  label: string; }

// Every kind gets a visually distinct icon so users can scan the Nodes tab at
// a glance. Keys come from SyntaxNodeKind so they stay in sync with the
// grammar instead of drifting via stringly-typed literals.
const NODE_KIND_ICONS: Partial<Record<SyntaxNodeKind, IconInfo>> = {
  [SyntaxNodeKind.PROGRAM]: {
    icon: PhFile,
    color: 'text-blue-500',
    label: SyntaxNodeKind.PROGRAM,
  },
  [SyntaxNodeKind.ELEMENT_DECLARATION]: {
    icon: PhPackage,
    color: 'text-indigo-500',
    label: SyntaxNodeKind.ELEMENT_DECLARATION,
  },

  [SyntaxNodeKind.USE_DECLARATION]: {
    icon: PhDownloadSimple,
    color: 'text-purple-500',
    label: SyntaxNodeKind.USE_DECLARATION,
  },
  [SyntaxNodeKind.USE_SPECIFIER]: {
    icon: PhAt,
    color: 'text-purple-400',
    label: SyntaxNodeKind.USE_SPECIFIER,
  },
  [SyntaxNodeKind.USE_SPECIFIER_LIST]: {
    icon: PhListDashes,
    color: 'text-purple-400',
    label: SyntaxNodeKind.USE_SPECIFIER_LIST,
  },

  [SyntaxNodeKind.ATTRIBUTE]: {
    icon: PhTag,
    color: 'text-amber-500',
    label: SyntaxNodeKind.ATTRIBUTE,
  },
  [SyntaxNodeKind.IDENTIFIER_STREAM]: {
    icon: PhTextColumns,
    color: 'text-blue-400',
    label: SyntaxNodeKind.IDENTIFIER_STREAM,
  },

  [SyntaxNodeKind.BLOCK_EXPRESSION]: {
    icon: PhBracketsCurly,
    color: 'text-cyan-500',
    label: SyntaxNodeKind.BLOCK_EXPRESSION,
  },
  [SyntaxNodeKind.LIST_EXPRESSION]: {
    icon: PhBracketsSquare,
    color: 'text-cyan-500',
    label: SyntaxNodeKind.LIST_EXPRESSION,
  },
  [SyntaxNodeKind.TUPLE_EXPRESSION]: {
    icon: PhBracketsCurly,
    color: 'text-cyan-400',
    label: SyntaxNodeKind.TUPLE_EXPRESSION,
  },

  [SyntaxNodeKind.FUNCTION_EXPRESSION]: {
    icon: PhLightning,
    color: 'text-orange-500',
    label: SyntaxNodeKind.FUNCTION_EXPRESSION,
  },
  [SyntaxNodeKind.FUNCTION_APPLICATION]: {
    icon: PhTerminal,
    color: 'text-orange-400',
    label: SyntaxNodeKind.FUNCTION_APPLICATION,
  },

  [SyntaxNodeKind.PREFIX_EXPRESSION]: {
    icon: PhPlusMinus,
    color: 'text-red-400',
    label: SyntaxNodeKind.PREFIX_EXPRESSION,
  },
  [SyntaxNodeKind.INFIX_EXPRESSION]: {
    icon: PhMathOperations,
    color: 'text-red-400',
    label: SyntaxNodeKind.INFIX_EXPRESSION,
  },
  [SyntaxNodeKind.POSTFIX_EXPRESSION]: {
    icon: PhEquals,
    color: 'text-red-400',
    label: SyntaxNodeKind.POSTFIX_EXPRESSION,
  },

  [SyntaxNodeKind.LITERAL]: {
    icon: PhTextAa,
    color: 'text-green-600',
    label: SyntaxNodeKind.LITERAL,
  },
  [SyntaxNodeKind.VARIABLE]: {
    icon: PhAlignCenterHorizontal,
    color: 'text-violet-500',
    label: SyntaxNodeKind.VARIABLE,
  },

  [SyntaxNodeKind.PRIMARY_EXPRESSION]: {
    icon: PhDiamond,
    color: 'text-gray-400',
    label: SyntaxNodeKind.PRIMARY_EXPRESSION,
  },
  [SyntaxNodeKind.GROUP_EXPRESSION]: {
    icon: PhLinkSimple,
    color: 'text-gray-400',
    label: SyntaxNodeKind.GROUP_EXPRESSION,
  },
  [SyntaxNodeKind.COMMA_EXPRESSION]: {
    icon: PhDotsThree,
    color: 'text-gray-400',
    label: SyntaxNodeKind.COMMA_EXPRESSION,
  },
  [SyntaxNodeKind.CALL_EXPRESSION]: {
    icon: PhPath,
    color: 'text-orange-400',
    label: SyntaxNodeKind.CALL_EXPRESSION,
  },
  [SyntaxNodeKind.ARRAY]: {
    icon: PhCaretDoubleDown,
    color: 'text-cyan-500',
    label: SyntaxNodeKind.ARRAY,
  },
  [SyntaxNodeKind.EMPTY]: {
    icon: PhMinus,
    color: 'text-gray-300',
    label: SyntaxNodeKind.EMPTY,
  },
};

const typeIcon = computed((): IconInfo => {
  const d = props.node.rawData;
  // Tokens use the same per-kind icons the Tokens tab does (flag for EOF,
  // newline/space/tab glyphs for trivia, etc.).
  if (d instanceof SyntaxToken) {
    const info = tokenIconFor(d.kind);
    return {
      icon: info.icon as typeof PhDiamond,
      color: d.kind === SyntaxTokenKind.EOF ? 'text-red-400' : info.color,
      label: d.kind,
    };
  }
  if (nodeKind.value) return NODE_KIND_ICONS[nodeKind.value as SyntaxNodeKind] ?? {
    icon: PhDiamond,
    color: 'text-blue-400',
    label: nodeKind.value,
  };
  if (Array.isArray(d)) return {
    icon: PhBracketsSquare,
    color: 'text-cyan-500',
    label: 'array',
  };
  if (d === null || d === undefined) return {
    icon: PhMinus,
    color: 'text-gray-300',
    label: 'null',
  };
  if (typeof d === 'string') return {
    icon: PhTextAa,
    color: 'text-green-600',
    label: 'string',
  };
  if (typeof d === 'number') return {
    icon: PhHash,
    color: 'text-amber-500',
    label: 'number',
  };
  if (typeof d === 'boolean') return {
    icon: PhToggleLeft,
    color: 'text-blue-400',
    label: 'boolean',
  };
  return {
    icon: PhBracketsCurly,
    color: 'text-gray-400',
    label: 'object',
  };
});

const leafValue = computed(() => {
  const d = props.node.rawData;
  if (d === null) return 'null';
  if (d === undefined) return '';
  if (typeof d !== 'object') return typeof d === 'string' ? `"${d}"` : String(d);
  const obj = asObj(d);
  if (obj && 'value' in obj && typeof obj.value === 'string' && !isExpandable.value) {
    if (obj.value === '') return d instanceof SyntaxToken && d.kind === SyntaxTokenKind.EOF ? '<EOF>' : '';
    return `"${obj.value}"`;
  }
  return '';
});

const sizeHint = computed(() => {
  const d = props.node.rawData;
  if (!Array.isArray(d)) return '';
  return d.length === 0 ? '[ ]' : `[ ${d.length} ]`;
});

function handleNodeClick () { emit('node-click', props.node); }
function toggleExpanded () {
  emit('node-expand', {
    id: props.node.id,
    expanded: !isExpanded.value,
  });
}
</script>
