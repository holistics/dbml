/**
 * DBML Language Support for Monaco Editor
 *
 * A deep module that encapsulates all DBML language definition complexity
 * for Monaco Editor. This module handles syntax highlighting, tokenization,
 * and language configuration while hiding implementation details.
 *
 * Design Principles Applied:
 * - Deep Module: Complex language definition with simple interface
 * - Information Hiding: Monaco-specific details are completely hidden
 * - Single Responsibility: Only handles DBML language support
 * - Pull Complexity Downwards: All Monaco complexity handled internally
 */
import * as monaco from 'monaco-editor'

/**
 * DBML Language Configuration
 */
const DBML_LANGUAGE_CONFIG: monaco.languages.LanguageConfiguration = {
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
}

/**
 * DBML Token Provider for Syntax Highlighting
 */
const DBML_TOKEN_PROVIDER: monaco.languages.IMonarchLanguage = {
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

  tokenizer: {
    root: [
      [/[a-zA-Z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@default': 'identifier'
        }
      }],
      { include: '@whitespace' },
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],
      [/[;,.]/, 'delimiter'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/`/, 'string.backtick', '@string_backtick'],
      [/#[0-9a-fA-F]{3,6}/, 'number.hex'],
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
}

/**
 * DBML Theme Definition
 */
const DBML_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
    { token: 'type', foreground: '008000', fontStyle: 'bold' },
    { token: 'string', foreground: 'a31515' },
    { token: 'string.backtick', foreground: 'a31515', fontStyle: 'italic' },
    { token: 'comment', foreground: '008000', fontStyle: 'italic' },
    { token: 'number', foreground: '098658' },
    { token: 'number.hex', foreground: '3030c0' },
    { token: 'operator', foreground: '000000' },
    { token: 'delimiter', foreground: '000000' },
    { token: 'annotation', foreground: '808080' },
    { token: 'identifier', foreground: '000000' }
  ],
  colors: {}
}

/**
 * DBML Language Service
 *
 * Provides a simple interface for registering DBML language support
 * in Monaco Editor. All complexity is hidden within this module.
 */
export class DBMLLanguageService {
  private static readonly LANGUAGE_ID = 'dbml'
  private static readonly THEME_NAME = 'dbml-theme'
  private static isRegistered = false

  /**
   * Register DBML language support in Monaco Editor
   *
   * This method is idempotent - multiple calls are safe.
   */
  public static registerLanguage(): void {
    if (this.isRegistered) {
      return
    }

    try {
      // Register the language
      monaco.languages.register({ id: this.LANGUAGE_ID })

      // Set token provider for syntax highlighting
      monaco.languages.setMonarchTokensProvider(this.LANGUAGE_ID, DBML_TOKEN_PROVIDER)

      // Set language configuration
      monaco.languages.setLanguageConfiguration(this.LANGUAGE_ID, DBML_LANGUAGE_CONFIG)

      // Define theme
      monaco.editor.defineTheme(this.THEME_NAME, DBML_THEME)

      this.isRegistered = true
    } catch (error) {
      console.warn('Failed to register DBML language:', error)
    }
  }

  /**
   * Get the DBML language identifier
   */
  public static getLanguageId(): string {
    return this.LANGUAGE_ID
  }

  /**
   * Get the DBML theme name
   */
  public static getThemeName(): string {
    return this.THEME_NAME
  }

  /**
   * Check if DBML language is registered
   */
  public static isLanguageRegistered(): boolean {
    return this.isRegistered
  }
}