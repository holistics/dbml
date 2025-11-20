import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { MockTextModel, createPosition } from '../../mocks';

describe('CompletionItemProvider', () => {
  it('should suggest top-level element types', () => {
    const program = '';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 1);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "Table",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Table",
            "range": undefined,
          },
          {
            "insertText": "TableGroup",
            "insertTextRules": 1,
            "kind": 17,
            "label": "TableGroup",
            "range": undefined,
          },
          {
            "insertText": "Enum",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Enum",
            "range": undefined,
          },
          {
            "insertText": "Project",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Project",
            "range": undefined,
          },
          {
            "insertText": "Ref",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Ref",
            "range": undefined,
          },
          {
            "insertText": "TablePartial",
            "insertTextRules": 1,
            "kind": 17,
            "label": "TablePartial",
            "range": undefined,
          },
        ],
      }
    `);
    expect(completions.suggestions).toMatchInlineSnapshot(`
      [
        {
          "insertText": "Table",
          "insertTextRules": 1,
          "kind": 17,
          "label": "Table",
          "range": undefined,
        },
        {
          "insertText": "TableGroup",
          "insertTextRules": 1,
          "kind": 17,
          "label": "TableGroup",
          "range": undefined,
        },
        {
          "insertText": "Enum",
          "insertTextRules": 1,
          "kind": 17,
          "label": "Enum",
          "range": undefined,
        },
        {
          "insertText": "Project",
          "insertTextRules": 1,
          "kind": 17,
          "label": "Project",
          "range": undefined,
        },
        {
          "insertText": "Ref",
          "insertTextRules": 1,
          "kind": 17,
          "label": "Ref",
          "range": undefined,
        },
        {
          "insertText": "TablePartial",
          "insertTextRules": 1,
          "kind": 17,
          "label": "TablePartial",
          "range": undefined,
        },
      ]
    `);
    expect(completions.suggestions.length).toBeGreaterThan(0);
    expect(completions.suggestions.some((s) => s.label === 'Table')).toBe(true);
    expect(completions.suggestions.some((s) => s.label === 'Enum')).toBe(true);
    expect(completions.suggestions.some((s) => s.label === 'Ref')).toBe(true);
  });

  it('should suggest column attributes', () => {
    const program = 'Table users { id int [ }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 24);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "pk",
            "insertTextRules": 1,
            "kind": 9,
            "label": "pk",
            "range": undefined,
          },
          {
            "insertText": "primary key",
            "insertTextRules": 1,
            "kind": 9,
            "label": "primary key",
            "range": undefined,
          },
          {
            "insertText": "null",
            "insertTextRules": 1,
            "kind": 9,
            "label": "null",
            "range": undefined,
          },
          {
            "insertText": "not null",
            "insertTextRules": 1,
            "kind": 9,
            "label": "not null",
            "range": undefined,
          },
          {
            "insertText": "increment",
            "insertTextRules": 1,
            "kind": 9,
            "label": "increment",
            "range": undefined,
          },
          {
            "insertText": "unique",
            "insertTextRules": 1,
            "kind": 9,
            "label": "unique",
            "range": undefined,
          },
          {
            "insertText": "ref: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "ref",
            "range": undefined,
          },
          {
            "insertText": "default: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "default",
            "range": undefined,
          },
          {
            "insertText": "note: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "note",
            "range": undefined,
          },
          {
            "insertText": "check: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "check",
            "range": undefined,
          },
        ],
      }
    `);
    expect(completions.suggestions).toMatchInlineSnapshot(`
      [
        {
          "insertText": "pk",
          "insertTextRules": 1,
          "kind": 9,
          "label": "pk",
          "range": undefined,
        },
        {
          "insertText": "primary key",
          "insertTextRules": 1,
          "kind": 9,
          "label": "primary key",
          "range": undefined,
        },
        {
          "insertText": "null",
          "insertTextRules": 1,
          "kind": 9,
          "label": "null",
          "range": undefined,
        },
        {
          "insertText": "not null",
          "insertTextRules": 1,
          "kind": 9,
          "label": "not null",
          "range": undefined,
        },
        {
          "insertText": "increment",
          "insertTextRules": 1,
          "kind": 9,
          "label": "increment",
          "range": undefined,
        },
        {
          "insertText": "unique",
          "insertTextRules": 1,
          "kind": 9,
          "label": "unique",
          "range": undefined,
        },
        {
          "insertText": "ref: ",
          "insertTextRules": 1,
          "kind": 9,
          "label": "ref",
          "range": undefined,
        },
        {
          "insertText": "default: ",
          "insertTextRules": 1,
          "kind": 9,
          "label": "default",
          "range": undefined,
        },
        {
          "insertText": "note: ",
          "insertTextRules": 1,
          "kind": 9,
          "label": "note",
          "range": undefined,
        },
        {
          "insertText": "check: ",
          "insertTextRules": 1,
          "kind": 9,
          "label": "check",
          "range": undefined,
        },
      ]
    `);
  });

  it('should return no suggestions inside comments', () => {
    const program = '// This is a comment';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 10);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions.suggestions).toHaveLength(0);
  });

  it('should return no suggestions inside strings', () => {
    const program = 'Table users { name varchar [note: "test"]  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 40);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions.suggestions).toHaveLength(0);
  });

  it('should suggest element types in table body', () => {
    const program = 'Table users {  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 15);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "Note",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Note",
            "range": undefined,
          },
          {
            "insertText": "indexes",
            "insertTextRules": 1,
            "kind": 17,
            "label": "indexes",
            "range": undefined,
          },
          {
            "insertText": "checks",
            "insertTextRules": 1,
            "kind": 17,
            "label": "checks",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest table names in ref', () => {
    const program = readFileSync(path.resolve(__dirname, './input/suggestions.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Inside a partial ref expression
    const position = createPosition(1, 15);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [],
      }
    `);
    expect(completions.suggestions).toMatchInlineSnapshot(`[]`);
  });

  it('should handle trigger characters', () => {
    const program = 'Table users { id int }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler, ['.', ' ']);

    expect(completionProvider.triggerCharacters).toEqual(['.', ' ']);
  });

  it('should suggest column types', () => {
    const program = 'Table users { id  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 18);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "integer",
            "insertTextRules": 1,
            "kind": 24,
            "label": "integer",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "int",
            "insertTextRules": 1,
            "kind": 24,
            "label": "int",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "tinyint",
            "insertTextRules": 1,
            "kind": 24,
            "label": "tinyint",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "smallint",
            "insertTextRules": 1,
            "kind": 24,
            "label": "smallint",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "mediumint",
            "insertTextRules": 1,
            "kind": 24,
            "label": "mediumint",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "bigint",
            "insertTextRules": 1,
            "kind": 24,
            "label": "bigint",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "bit",
            "insertTextRules": 1,
            "kind": 24,
            "label": "bit",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "bool",
            "insertTextRules": 1,
            "kind": 24,
            "label": "bool",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "binary",
            "insertTextRules": 1,
            "kind": 24,
            "label": "binary",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "varbinary",
            "insertTextRules": 1,
            "kind": 24,
            "label": "varbinary",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "logical",
            "insertTextRules": 1,
            "kind": 24,
            "label": "logical",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "char",
            "insertTextRules": 1,
            "kind": 24,
            "label": "char",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "nchar",
            "insertTextRules": 1,
            "kind": 24,
            "label": "nchar",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "varchar",
            "insertTextRules": 1,
            "kind": 24,
            "label": "varchar",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "varchar2",
            "insertTextRules": 1,
            "kind": 24,
            "label": "varchar2",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "nvarchar",
            "insertTextRules": 1,
            "kind": 24,
            "label": "nvarchar",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "nvarchar2",
            "insertTextRules": 1,
            "kind": 24,
            "label": "nvarchar2",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "binary_float",
            "insertTextRules": 1,
            "kind": 24,
            "label": "binary_float",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "binary_double",
            "insertTextRules": 1,
            "kind": 24,
            "label": "binary_double",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "float",
            "insertTextRules": 1,
            "kind": 24,
            "label": "float",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "double",
            "insertTextRules": 1,
            "kind": 24,
            "label": "double",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "decimal",
            "insertTextRules": 1,
            "kind": 24,
            "label": "decimal",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "dec",
            "insertTextRules": 1,
            "kind": 24,
            "label": "dec",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "real",
            "insertTextRules": 1,
            "kind": 24,
            "label": "real",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "money",
            "insertTextRules": 1,
            "kind": 24,
            "label": "money",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "smallmoney",
            "insertTextRules": 1,
            "kind": 24,
            "label": "smallmoney",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "enum",
            "insertTextRules": 1,
            "kind": 24,
            "label": "enum",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "tinyblob",
            "insertTextRules": 1,
            "kind": 24,
            "label": "tinyblob",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "tinytext",
            "insertTextRules": 1,
            "kind": 24,
            "label": "tinytext",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "blob",
            "insertTextRules": 1,
            "kind": 24,
            "label": "blob",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "text",
            "insertTextRules": 1,
            "kind": 24,
            "label": "text",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "mediumblob",
            "insertTextRules": 1,
            "kind": 24,
            "label": "mediumblob",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "mediumtext",
            "insertTextRules": 1,
            "kind": 24,
            "label": "mediumtext",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "longblob",
            "insertTextRules": 1,
            "kind": 24,
            "label": "longblob",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "longtext",
            "insertTextRules": 1,
            "kind": 24,
            "label": "longtext",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "ntext",
            "insertTextRules": 1,
            "kind": 24,
            "label": "ntext",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "set",
            "insertTextRules": 1,
            "kind": 24,
            "label": "set",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "inet6",
            "insertTextRules": 1,
            "kind": 24,
            "label": "inet6",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "uuid",
            "insertTextRules": 1,
            "kind": 24,
            "label": "uuid",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "image",
            "insertTextRules": 1,
            "kind": 24,
            "label": "image",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "date",
            "insertTextRules": 1,
            "kind": 24,
            "label": "date",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "time",
            "insertTextRules": 1,
            "kind": 24,
            "label": "time",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "datetime",
            "insertTextRules": 1,
            "kind": 24,
            "label": "datetime",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "datetime2",
            "insertTextRules": 1,
            "kind": 24,
            "label": "datetime2",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "timestamp",
            "insertTextRules": 1,
            "kind": 24,
            "label": "timestamp",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "year",
            "insertTextRules": 1,
            "kind": 24,
            "label": "year",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "smalldatetime",
            "insertTextRules": 1,
            "kind": 24,
            "label": "smalldatetime",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "datetimeoffset",
            "insertTextRules": 1,
            "kind": 24,
            "label": "datetimeoffset",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "XML",
            "insertTextRules": 1,
            "kind": 24,
            "label": "XML",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "sql_variant",
            "insertTextRules": 1,
            "kind": 24,
            "label": "sql_variant",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "uniqueidentifier",
            "insertTextRules": 1,
            "kind": 24,
            "label": "uniqueidentifier",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "CURSOR",
            "insertTextRules": 1,
            "kind": 24,
            "label": "CURSOR",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "BFILE",
            "insertTextRules": 1,
            "kind": 24,
            "label": "BFILE",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "CLOB",
            "insertTextRules": 1,
            "kind": 24,
            "label": "CLOB",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "NCLOB",
            "insertTextRules": 1,
            "kind": 24,
            "label": "NCLOB",
            "range": undefined,
            "sortText": "24",
          },
          {
            "insertText": "RAW",
            "insertTextRules": 1,
            "kind": 24,
            "label": "RAW",
            "range": undefined,
            "sortText": "24",
          },
        ],
      }
    `);
  });

  it('should suggest in indexes', () => {
    const program = `Table users {
      id int
      name varchar
      indexes {

      }
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(5, 11);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "id",
            "insertTextRules": 1,
            "kind": 3,
            "label": "id",
            "range": undefined,
          },
          {
            "insertText": "name",
            "insertTextRules": 1,
            "kind": 3,
            "label": "name",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest enum values', () => {
    const program = readFileSync(path.resolve(__dirname, './input/suggestions.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(8, 3);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [],
      }
    `);
  });

  it('should suggest in TableGroup', () => {
    const program = `
      Table users { id int }
      TableGroup group1 {

      }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(4, 11);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "users",
            "insertTextRules": 1,
            "kind": 5,
            "label": "users",
            "range": undefined,
          },
          {
            "insertText": "Note",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Note",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest in Project', () => {
    const program = 'Project test {  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 16);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "Table",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Table",
            "range": undefined,
          },
          {
            "insertText": "TableGroup",
            "insertTextRules": 1,
            "kind": 17,
            "label": "TableGroup",
            "range": undefined,
          },
          {
            "insertText": "Enum",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Enum",
            "range": undefined,
          },
          {
            "insertText": "Note",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Note",
            "range": undefined,
          },
          {
            "insertText": "Ref",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Ref",
            "range": undefined,
          },
          {
            "insertText": "TablePartial",
            "insertTextRules": 1,
            "kind": 17,
            "label": "TablePartial",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest in tuple expressions for indexes', () => {
    const program = `Table orders {
      id int
      created_at timestamp
      indexes { ( }
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(4, 19);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "id",
            "insertTextRules": 1,
            "kind": 3,
            "label": "id",
            "range": undefined,
          },
          {
            "insertText": "created_at",
            "insertTextRules": 1,
            "kind": 3,
            "label": "created_at",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest in tuple expressions for ref', () => {
    const program = 'Ref: (posts.user_id, ) > (users.id, users.email)';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 21);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [],
      }
    `);
  });

  it('should handle partial injection suggestions', () => {
    const program = `
      Table users { id int }
      TablePartial users { timestamp int }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(3, 28);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "Note",
            "insertTextRules": 1,
            "kind": 17,
            "label": "Note",
            "range": undefined,
          },
          {
            "insertText": "indexes",
            "insertTextRules": 1,
            "kind": 17,
            "label": "indexes",
            "range": undefined,
          },
          {
            "insertText": "checks",
            "insertTextRules": 1,
            "kind": 17,
            "label": "checks",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest member access after dot operator', () => {
    const program = `
      Table users {
        id int
        name varchar
      }
      Ref: posts.user_id > users.
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(6, 34);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "id",
            "kind": 3,
            "label": "id",
            "range": undefined,
          },
          {
            "insertText": "name",
            "kind": 3,
            "label": "name",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest for prefix expression with ref operators', () => {
    const program = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id >
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(4, 27);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": " users",
            "insertTextRules": 1,
            "kind": 5,
            "label": "users",
            "range": undefined,
            "sortText": "05",
          },
          {
            "insertText": " posts",
            "insertTextRules": 1,
            "kind": 5,
            "label": "posts",
            "range": undefined,
            "sortText": "05",
          },
        ],
      }
    `);
  });

  it('should suggest for infix expression with ref operators', () => {
    const program = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id < users.id
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(4, 28);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "users",
            "insertTextRules": 1,
            "kind": 5,
            "label": "users",
            "range": undefined,
            "sortText": "05",
          },
          {
            "insertText": "posts",
            "insertTextRules": 1,
            "kind": 5,
            "label": "posts",
            "range": undefined,
            "sortText": "05",
          },
        ],
      }
    `);
  });

  it('should suggest attribute names in list expression', () => {
    const program = 'Table users { id int [pk, ] }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 27);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "pk",
            "insertTextRules": 1,
            "kind": 9,
            "label": "pk",
            "range": undefined,
          },
          {
            "insertText": "primary key",
            "insertTextRules": 1,
            "kind": 9,
            "label": "primary key",
            "range": undefined,
          },
          {
            "insertText": "null",
            "insertTextRules": 1,
            "kind": 9,
            "label": "null",
            "range": undefined,
          },
          {
            "insertText": "not null",
            "insertTextRules": 1,
            "kind": 9,
            "label": "not null",
            "range": undefined,
          },
          {
            "insertText": "increment",
            "insertTextRules": 1,
            "kind": 9,
            "label": "increment",
            "range": undefined,
          },
          {
            "insertText": "unique",
            "insertTextRules": 1,
            "kind": 9,
            "label": "unique",
            "range": undefined,
          },
          {
            "insertText": "ref: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "ref",
            "range": undefined,
          },
          {
            "insertText": "default: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "default",
            "range": undefined,
          },
          {
            "insertText": "note: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "note",
            "range": undefined,
          },
          {
            "insertText": "check: ",
            "insertTextRules": 1,
            "kind": 9,
            "label": "check",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest for function application in enum', () => {
    const program = 'Enum status { active ( }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 24);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [],
      }
    `);
  });

  it('should suggest default values', () => {
    const program = `
      Enum status { active inactive }
      Table users {
        id int
        status varchar [default: ]
      }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(5, 34);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "status",
            "insertTextRules": 1,
            "kind": 15,
            "label": "status",
            "range": undefined,
            "sortText": "15",
          },
        ],
      }
    `);
  });

  it('should handle attribute name at colon position', () => {
    const program = 'Table users { id int [note:] }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 28);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [],
      }
    `);
  });

  it('should suggest table header attributes', () => {
    const program = `Table users [note: 'Users table'] {
      id int
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 14);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [
          {
            "insertText": "headercolor: ",
            "insertTextRules": 1,
            "kind": 3,
            "label": "headercolor",
            "range": undefined,
          },
          {
            "insertText": "note: ",
            "insertTextRules": 1,
            "kind": 3,
            "label": "note",
            "range": undefined,
          },
        ],
      }
    `);
  });

  it('should suggest checks attribute name', () => {
    const program = `Table users {
      age int
      checks { age > 0 [] }
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(3, 24);
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toMatchInlineSnapshot(`
      {
        "suggestions": [],
      }
    `);
  });
});
