import { BUILTIN_KINDS, RESERVED } from './vocabulary.js';
import { ICON_NAMES } from './icons.js';

/**
 * SYNTAX HIGHLIGHTING FOR THE DIALECT, which DBML's own provider cannot do.
 *
 * Pointing DBML's tokenizer at an architecture file highlights almost nothing: it knows
 * `table`, `ref`, `pk` and a hundred SQL type names, and this language has none of them. Worse,
 * it knows them LOOSELY — `text`, `set` and `image` are DBML data types and perfectly ordinary
 * words here, so the few things that did light up lit up wrongly.
 *
 * It lives in this package because the vocabulary does. The roles, the reserved words and the
 * icon names are all declared a few files away, and a highlighter that copied them would be a
 * second list to keep in step.
 *
 * ONE RULE CARRIES MOST OF THE WORK: the first word on a line is the element keyword, whatever
 * it is. That has to be positional rather than a word list, because `Kind Microservice` makes
 * a new keyword at compile time and no static list can know it.
 */

/** the words that open a declaration, plus the two that join one */
const DECLARATIONS = [...RESERVED, 'Partial', 'as', 'from'];

/** the settings the drawing reads; everything else in a body is an author's own property */
const DRAWN = ['name', 'type', 'color', 'icon', 'style', 'label', 'inactive', 'glyph',
  'proto', 'host', 'diagram_type'];

export const archLanguageConfiguration = {
  comments: { lineComment: '//', blockComment: ['/*', '*/'] as [string, string] },
  brackets: [['{', '}'], ['[', ']'], ['(', ')']] as [string, string][],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  indentationRules: {
    increaseIndentPattern: /^(.*\{[^}]*|\s*[{[].*)$/,
    decreaseIndentPattern: /^(.*\}.*|\s*[}\]].*)$/,
  },
};

export const archMonarchTokensProvider = {
  tokenPostfix: '.arch',
  ignoreCase: false,
  unicode: true,

  declarations: DECLARATIONS,
  roles: Object.keys(BUILTIN_KINDS),
  settings: DRAWN,
  icons: ICON_NAMES,

  idtf: /[\p{L}_][\p{L}\p{N}_]*/u,

  tokenizer: {
    root: [
      // front matter: fenced, first, and trivia to the lexer — so it reads as one comment
      [/^---[ \t]*$/, { token: 'comment', next: '@frontmatter' }],
      { include: '@common' },

      /**
       * THE DECLARATION LINE. `Database "Users DB" as users_db [inactive] {`
       *
       * The leading word is a keyword by POSITION, not by membership: a `Kind` declaration
       * invents roles, so no list can be complete. A reserved word is painted differently from
       * a role so that `Group` does not look like `Database`.
       */
      [/^(\s*)(@idtf)(\s+)/, {
        cases: {
          '$2@declarations': ['', 'keyword', ''],
          '$2@roles': ['', 'type', ''],
          '@default': ['', 'type', ''],
        },
      }],

      { include: '@body' },
    ],

    // everything that can appear once the leading keyword is behind us
    body: [
      [/\bas\b/, 'keyword'],
      [/~@idtf/, 'keyword.injection'],

      // `key:` at the head of a property or a setting
      [/(@idtf)(\s*)(:)/, {
        cases: {
          '$1@settings': ['attribute.name', '', 'delimiter'],
          '@default': ['variable.name', '', 'delimiter'],
        },
      }],

      [/<>|[<>-]/, 'operators'],
      [/[{}[\]()]/, '@brackets'],
      [/[,.]/, 'delimiter'],

      { include: '@values' },

      [/@idtf/, {
        cases: {
          '@declarations': 'keyword',
          '@icons': 'string.icon',
          '@default': 'identifier',
        },
      }],
    ],

    common: [
      { include: '@whitespace' },
      { include: '@values' },
    ],

    values: [
      [/#([0-9A-Fa-f]{3}){1,2}\b/, 'number.hex'],
      [/\d+(\.\d+)?/, 'number'],
      [/'''/, { token: 'string', next: '@tripleString' }],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/"([^"\\]|\\.)*"/, 'string.name'],
    ],

    tripleString: [
      [/'''/, { token: 'string', next: '@pop' }],
      [/\*\*[^*]+\*\*/, 'string.bold'],
      [/`[^`]*`/, 'string.code'],
      [/^\s*-\s/, 'string.bullet'],
      [/./, 'string'],
    ],

    frontmatter: [
      [/^---[ \t]*$/, { token: 'comment', next: '@pop' }],
      [/^(\s*)([\w-]+)(\s*)(:)/, ['', 'attribute.name', '', 'delimiter']],
      [/.*$/, 'comment'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/\/\*/, { token: 'comment', next: '@comment' }],
      [/\/\/.*$/, 'comment'],
    ],

    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, { token: 'comment', next: '@pop' }],
      [/[/*]/, 'comment'],
    ],
  },
};

/**
 * The colours, kept beside the grammar so the two cannot drift.
 *
 * The scheme says what the language says: the ROLE is the loudest thing on the line because it
 * is the first question a reader has, the NAME is what gets drawn so it reads as content, and
 * an author's own property is dimmer than a setting the drawing acts on — because one of them
 * changes the picture and the other does not.
 */
export const archThemeRules = [
  { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
  { token: 'keyword.injection', foreground: '7a3e9d', fontStyle: 'bold' },
  { token: 'type', foreground: '2f6fb5', fontStyle: 'bold' },
  { token: 'string.name', foreground: '3d7a4e', fontStyle: 'bold' },
  { token: 'attribute.name', foreground: 'b14f86' },
  { token: 'variable.name', foreground: '55636d' },
  { token: 'string', foreground: 'a31515' },
  { token: 'string.icon', foreground: 'b2761c' },
  { token: 'string.bold', foreground: 'a31515', fontStyle: 'bold' },
  { token: 'string.code', foreground: '8a5a2b' },
  { token: 'string.bullet', foreground: 'c0453a' },
  { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
  { token: 'number', foreground: '098658' },
  { token: 'number.hex', foreground: '3030c0' },
  { token: 'operators', foreground: 'c0453a', fontStyle: 'bold' },
  { token: 'delimiter', foreground: '8894a0' },
  { token: 'identifier', foreground: '1b2126' },
];
