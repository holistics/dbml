<template>
  <div ref="editorContainer" class="w-full h-full border border-gray-200 rounded-md"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

interface Props {
  modelValue: string
  language?: string
  readOnly?: boolean
  minimap?: boolean
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded'
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  language: 'dbml',
  readOnly: false,
  minimap: true,
  wordWrap: 'on'
})

const emit = defineEmits<Emits>()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// Register DBML language
const registerDBMLLanguage = () => {
  // Register the language
  monaco.languages.register({ id: 'dbml' })

  // Set the tokens provider
  monaco.languages.setMonarchTokensProvider('dbml', {
    // Define the token types
    keywords: [
      'Table', 'Enum', 'Ref', 'Project', 'TableGroup', 'Note',
      'indexes', 'Indexes', 'enum', 'table', 'ref', 'project', 'tablegroup', 'note'
    ],
    typeKeywords: [
      'int', 'integer', 'bigint', 'smallint', 'tinyint',
      'varchar', 'char', 'text', 'nvarchar', 'nchar', 'ntext',
      'decimal', 'numeric', 'float', 'double', 'real', 'money',
      'datetime', 'timestamp', 'date', 'time',
      'boolean', 'bool', 'bit',
      'json', 'jsonb', 'xml',
      'uuid', 'uniqueidentifier',
      'blob', 'binary', 'varbinary'
    ],
    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
      '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
      '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
      '%=', '<<=', '>>=', '>>>='
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer
    tokenizer: {
      root: [
        // DBML keywords
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@default': 'identifier'
          }
        }],

        // Whitespace
        { include: '@whitespace' },

        // Delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],

        // Delimiter: after number because of .\d floats
        [/[;,.]/, 'delimiter'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
        [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],

        // Function expressions with backticks
        [/`/, 'string.backtick', '@string_backtick'],

        // Color literals
        [/#[0-9a-fA-F]{3,6}/, 'number.hex'],

        // Settings in brackets
        [/\[/, 'annotation', '@settings'],
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        ["\\*/", 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop']
      ],

      string_single: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop']
      ],

      string_backtick: [
        [/[^\\`]+/, 'string.backtick'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/`/, 'string.backtick', '@pop']
      ],

      settings: [
        [/[^\[\]]+/, 'annotation'],
        [/\[/, 'annotation', '@push'],
        [/\]/, 'annotation', '@pop']
      ],
    },
  })

  // Set the language configuration
  monaco.languages.setLanguageConfiguration('dbml', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/']
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' }
    ],
    indentationRules: {
      increaseIndentPattern: /^(.*\{[^}]*|\s*[\{\[].*)$/,
      decreaseIndentPattern: /^(.*\}.*|\s*[\}\]].*)$/
    }
  })

  // Define the theme
  monaco.editor.defineTheme('dbml-theme', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
      { token: 'type', foreground: '008000', fontStyle: 'bold' },
      { token: 'string', foreground: 'a31515' },
      { token: 'string.backtick', foreground: '795e26' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'number', foreground: '098658' },
      { token: 'number.hex', foreground: '0000ff' },
      { token: 'annotation', foreground: '267f99' },
      { token: 'operator', foreground: '000000' },
      { token: 'identifier', foreground: '000000' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#237893',
      'editor.selectionBackground': '#add6ff'
    }
  })
}

onMounted(async () => {
  if (!editorContainer.value) return

  // Register DBML language first
  registerDBMLLanguage()

  // Wait for next tick to ensure container is properly mounted
  await nextTick()

  // Create the editor
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language,
    theme: props.language === 'dbml' ? 'dbml-theme' : 'vs',
    readOnly: props.readOnly,
    minimap: { enabled: props.minimap },
    wordWrap: props.wordWrap,
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineHeight: 20,
    padding: { top: 10, bottom: 10 },
    renderWhitespace: 'boundary',
    renderControlCharacters: true,
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on',
    automaticLayout: true,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      verticalScrollbarSize: 14,
      horizontalScrollbarSize: 14
    }
  })

  // Listen for content changes
  if (!props.readOnly) {
    editor.onDidChangeModelContent(() => {
      const value = editor?.getValue() || ''
      emit('update:modelValue', value)
    })
  }
})

// Watch for prop changes
watch(() => props.modelValue, (newValue) => {
  if (editor && editor.getValue() !== newValue) {
    editor.setValue(newValue)
  }
})

watch(() => props.readOnly, (newReadOnly) => {
  if (editor) {
    editor.updateOptions({ readOnly: newReadOnly })
  }
})

watch(() => props.language, (newLanguage) => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
      editor.updateOptions({
        theme: newLanguage === 'dbml' ? 'dbml-theme' : 'vs'
      })
    }
  }
})

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose()
  }
})
</script>

<style scoped>
/* Ensure the container takes full height */
.monaco-editor-container {
  height: 100%;
  width: 100%;
}
</style> 