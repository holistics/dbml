import type { languages } from 'monaco-editor-core';

export const dbmlLanguageConfig: languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' },
    { open: '`', close: '`' },
  ],
  indentationRules: {
    increaseIndentPattern: /^(.*\{[^}]*|\s*[\{\[].*)$/,
    decreaseIndentPattern: /^(.*\}.*|\s*[\}\]].*)$/,
  },
};

const dbmlMonarchTokensProvider: languages.IMonarchLanguage = {
  tokenPostfix: '.dbml',
  brackets: [
    {
      open: '[',
      close: ']',
      token: 'delimiter.square',
    },
    {
      open: '(',
      close: ')',
      token: 'delimiter.parenthesis',
    },
    {
      open: '{',
      close: '}',
      token: 'delimiter.curly',
    },
  ],

  decls: [
    'project',
    'tablegroup',
    'table',
    'enum',
    'ref',
    'note',
    'tablepartial',
    'records',
    'checks',
    'diagramview',
  ],

  dataTypes: [
    'TINYINT',
    'SMALLINT',
    'MEDIUMINT',
    'INT',
    'INTEGER',
    'BIGINT',
    'FLOAT',
    'DOUBLE',
    'DECIMAL',
    'DEC',
    'BIT',
    'BOOL',
    'REAL',
    'MONEY',
    'BINARY_FLOAT',
    'BINARY_DOUBLE',
    'smallmoney',
    'ENUM',
    'CHAR',
    'BINARY',
    'VARCHAR',
    'VARBINARY',
    'TINYBLOB',
    'TINYTEXT',
    'BLOB',
    'TEXT',
    'MEDIUMBLOB',
    'MEDIUMTEXT',
    'LONGBLOB',
    'LONGTEXT',
    'SET',
    'INET6',
    'UUID',
    'NVARCHAR',
    'NCHAR',
    'NTEXT',
    'IMAGE',
    'VARCHAR2',
    'NVARCHAR2',
    'DATE',
    'TIME',
    'DATETIME',
    'DATETIME2',
    'TIMESTAMP',
    'YEAR',
    'smalldatetime',
    'datetimeoffset',
    'XML',
    'sql_variant',
    'uniqueidentifier',
    'CURSOR',
    'BFILE',
    'CLOB',
    'NCLOB',
    'RAW',
  ],

  settings: [
    'indexes',
    'ref',
    'note',
    'headercolor',
    'pk',
    'null',
    'increment',
    'unique',
    'default',
    'note',
    'primary',
    'key',
    'name',
    'as',
    'color',
    'check',
    'tables',
    'tablegroups',
    'notes',
    'schemas',
  ],

  symbols: /[=><!~?:&|+\-/^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  newline: /[\r\n]/,
  digits: /\d+(_+\d+)*/,
  idtf: /[\p{L}0-9_]+/u,
  ignoreCase: true,
  unicode: true,

  tokenizer: {
    root: [
      [/[{}[\]()]/, '@bracket'],
      [/[,.:]/, 'delimiter'],
      { include: '@numbers' },
      { include: 'common' },
    ],

    common: [
      { include: '@whitespace' },

      // Reference operators
      [/[<>-]/, 'operators'],

      // Wildcard — standalone * gets its own token type for distinct styling
      [/\*/, 'keyword.wildcard'],

      // Quoted column name followed by type
      [/("[^"\\]*(?:\\.[^"\\]*)*")(\s+)(@idtf(?:\.@idtf*)*)/, ['string', '', 'keyword']],

      // strings
      [/"([^"\\]|\\.)*$/, ''],
      [/'([^'\\]|\\.)*$/, ''],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/`/, 'string', '@string_backtick'],

      [
        /(@idtf)(\s+)(@idtf(?:\.@idtf)*)/,
        {
          cases: {
            '$1@decls': ['keyword', '', 'identifier'],
            '$1==not': {
              cases: {
                '$3==null': ['keyword', '', 'keyword'],
                '@default': ['identifier', '', 'identifier'],
              },
            },
            '@default': ['identifier', '', 'keyword'],
          },
        },
      ],
      [
        /@idtf/,
        {
          cases: {
            '@dataTypes': 'keyword',
            '@decls': 'keyword',
            '@settings': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
    ],

    numbers: [
      [/0[xX][0-9a-fA-F]*/, 'number'],
      [/[$][+-]*\d*(\.\d*)?/, 'number'],
      [/((\d+(\.\d*)?)|(\.\d+))([eE][-+]?\d+)?/, 'number'],
      [/#([0-9A-F]{3}){1,2}/, 'number.hex'],
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],

    string_backtick: [[/[^\\`$]+/, 'string'], [/@escapes/, 'string.escape'], [/`/, 'string', '@pop']],

    endTripleQuotesString: [[/\\'/, 'string'], [/(.*[^\\])?(\\\\)*'''/, 'string', '@popall'], [/.*$/, 'string']],

    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
      [/'''(.*[^\\])?(\\\\)*'''/, 'string'],
      [/'''.*$/, 'string', '@endTripleQuotesString'],
    ],

    comment: [[/[^/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[/*]/, 'comment']],
  },
};

export { dbmlMonarchTokensProvider };
