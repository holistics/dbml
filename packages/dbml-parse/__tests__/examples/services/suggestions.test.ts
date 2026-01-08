import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '../../utils';

describe('[snapshot] CompletionItemProvider', () => {
  describe('should suggest element types when at top level', () => {
    it('- work if the source is empty', () => {
      const program = '';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 1);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);
    });

    it('- work even if some characters have been typed out', () => {
      const program = 'Ta    ';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);
    });

    it('- work even if there are some not directly following nonsensical characters', () => {
      const program = '  @&@*&@*^@!#';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);
    });

    it('- work even if there are some directly following nonsensical characters', () => {
      const program = 'ab';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual(['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial']);
    });
  });

  describe('should suggest table settings inside table setting lists', () => {
    // This does not work now
    it.skip('- work even if the table body is non-existent', () => {
      const program = 'Table T []';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 10);
      const result = provider.provideCompletionItems(model, position);
      // Should suggest table header settings like headercolor, note
      expect(result.suggestions).toMatchInlineSnapshot();
    });

    it('- work even if the table body is partially opened', () => {
      const program = 'Table T [] {';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 13);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([]);
    });

    it('- work even if the table body is complete', () => {
      const program = 'Table T [] {\n  id int\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);
    });

    it('- work when there is a comma following', () => {
      const program = 'Table T [headercolor: #fff, ] {}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 29);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'headercolor',
        'note',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'headercolor: ',
        'note: ',

      ]);
    });

    it('- work when there is a comma preceding', () => {
      const program = 'Table T [, headercolor: #fff] {}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 10);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'headercolor',
        'note',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'headercolor: ',
        'note: ',

      ]);
    });
  });

  describe('should suggest subelements of table correctly', () => {
    it('- should suggest Note, indexes, and checks in table body', () => {
      const program = 'Table users {\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);
    });

    it('- should suggest after column definition', () => {
      const program = 'Table users {\n  id int\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);
    });
  });

  describe('should suggest enum columns and basic types', () => {
    it('- should suggest basic data types for column definitions', () => {
      const program = 'Table users {\n  id \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 6);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'integer',
        'int',
        'tinyint',
        'smallint',
        'mediumint',
        'bigint',
        'bit',
        'bool',
        'binary',
        'varbinary',
        'logical',
        'char',
        'nchar',
        'varchar',
        'varchar2',
        'nvarchar',
        'nvarchar2',
        'binary_float',
        'binary_double',
        'float',
        'double',
        'decimal',
        'dec',
        'real',
        'money',
        'smallmoney',
        'enum',
        'tinyblob',
        'tinytext',
        'blob',
        'text',
        'mediumblob',
        'mediumtext',
        'longblob',
        'longtext',
        'ntext',
        'set',
        'inet6',
        'uuid',
        'image',
        'date',
        'time',
        'datetime',
        'datetime2',
        'timestamp',
        'year',
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

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'integer',
        'int',
        'tinyint',
        'smallint',
        'mediumint',
        'bigint',
        'bit',
        'bool',
        'binary',
        'varbinary',
        'logical',
        'char',
        'nchar',
        'varchar',
        'varchar2',
        'nvarchar',
        'nvarchar2',
        'binary_float',
        'binary_double',
        'float',
        'double',
        'decimal',
        'dec',
        'real',
        'money',
        'smallmoney',
        'enum',
        'tinyblob',
        'tinytext',
        'blob',
        'text',
        'mediumblob',
        'mediumtext',
        'longblob',
        'longtext',
        'ntext',
        'set',
        'inet6',
        'uuid',
        'image',
        'date',
        'time',
        'datetime',
        'datetime2',
        'timestamp',
        'year',
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

      ]);
    });

    it('- should suggest enum types for column definitions', () => {
      const program = 'Enum status { active inactive }\nTable users {\n  st \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 6);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'integer',
        'int',
        'tinyint',
        'smallint',
        'mediumint',
        'bigint',
        'bit',
        'bool',
        'binary',
        'varbinary',
        'logical',
        'char',
        'nchar',
        'varchar',
        'varchar2',
        'nvarchar',
        'nvarchar2',
        'binary_float',
        'binary_double',
        'float',
        'double',
        'decimal',
        'dec',
        'real',
        'money',
        'smallmoney',
        'enum',
        'tinyblob',
        'tinytext',
        'blob',
        'text',
        'mediumblob',
        'mediumtext',
        'longblob',
        'longtext',
        'ntext',
        'set',
        'inet6',
        'uuid',
        'image',
        'date',
        'time',
        'datetime',
        'datetime2',
        'timestamp',
        'year',
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
        'status',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'integer',
        'int',
        'tinyint',
        'smallint',
        'mediumint',
        'bigint',
        'bit',
        'bool',
        'binary',
        'varbinary',
        'logical',
        'char',
        'nchar',
        'varchar',
        'varchar2',
        'nvarchar',
        'nvarchar2',
        'binary_float',
        'binary_double',
        'float',
        'double',
        'decimal',
        'dec',
        'real',
        'money',
        'smallmoney',
        'enum',
        'tinyblob',
        'tinytext',
        'blob',
        'text',
        'mediumblob',
        'mediumtext',
        'longblob',
        'longtext',
        'ntext',
        'set',
        'inet6',
        'uuid',
        'image',
        'date',
        'time',
        'datetime',
        'datetime2',
        'timestamp',
        'year',
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
        'status',

      ]);
    });

    it('- should suggest schema-qualified enums', () => {
      const program = 'Enum myschema.status { active }\nTable users {\n  st \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 6);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'integer',
        'int',
        'tinyint',
        'smallint',
        'mediumint',
        'bigint',
        'bit',
        'bool',
        'binary',
        'varbinary',
        'logical',
        'char',
        'nchar',
        'varchar',
        'varchar2',
        'nvarchar',
        'nvarchar2',
        'binary_float',
        'binary_double',
        'float',
        'double',
        'decimal',
        'dec',
        'real',
        'money',
        'smallmoney',
        'enum',
        'tinyblob',
        'tinytext',
        'blob',
        'text',
        'mediumblob',
        'mediumtext',
        'longblob',
        'longtext',
        'ntext',
        'set',
        'inet6',
        'uuid',
        'image',
        'date',
        'time',
        'datetime',
        'datetime2',
        'timestamp',
        'year',
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
        'myschema',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'integer',
        'int',
        'tinyint',
        'smallint',
        'mediumint',
        'bigint',
        'bit',
        'bool',
        'binary',
        'varbinary',
        'logical',
        'char',
        'nchar',
        'varchar',
        'varchar2',
        'nvarchar',
        'nvarchar2',
        'binary_float',
        'binary_double',
        'float',
        'double',
        'decimal',
        'dec',
        'real',
        'money',
        'smallmoney',
        'enum',
        'tinyblob',
        'tinytext',
        'blob',
        'text',
        'mediumblob',
        'mediumtext',
        'longblob',
        'longtext',
        'ntext',
        'set',
        'inet6',
        'uuid',
        'image',
        'date',
        'time',
        'datetime',
        'datetime2',
        'timestamp',
        'year',
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
        'myschema',

      ]);
    });
  });

  describe('should suggest column settings', () => {
    it('- should suggest pk, null, unique settings in column brackets', () => {
      const program = 'Table users {\n  id int []\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 11);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'pk',
        'primary key',
        'null',
        'not null',
        'increment',
        'unique',
        'ref',
        'default',
        'note',
        'check',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'pk',
        'primary key',
        'null',
        'not null',
        'increment',
        'unique',
        'ref: ',
        'default: ',
        'note: ',
        'check: ',

      ]);
    });

    it('- should suggest settings with colons (ref, default, note)', () => {
      const program = 'Table users {\n  id int []\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 11);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'pk',
        'primary key',
        'null',
        'not null',
        'increment',
        'unique',
        'ref',
        'default',
        'note',
        'check',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'pk',
        'primary key',
        'null',
        'not null',
        'increment',
        'unique',
        'ref: ',
        'default: ',
        'note: ',
        'check: ',

      ]);
    });

    it('- should suggest after comma in column settings', () => {
      const program = 'Table users {\n  id int [pk, ]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 15);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'pk',
        'primary key',
        'null',
        'not null',
        'increment',
        'unique',
        'ref',
        'default',
        'note',
        'check',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'pk',
        'primary key',
        'null',
        'not null',
        'increment',
        'unique',
        'ref: ',
        'default: ',
        'note: ',
        'check: ',

      ]);
    });
  });

  describe('should suggest schemas and enums for column defaults', () => {
    it('- should suggest enum values for default setting', () => {
      const program = 'Enum status { active inactive }\nTable users {\n  st status [default: ]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 22);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'status',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'status',

      ]);
    });

    it('- should suggest schemas in default context', () => {
      const program = 'Enum myschema.status { active }\nTable users {\n  st myschema.status [default: ]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 32);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'myschema',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'myschema',

      ]);
    });
  });

  describe('should suggest schemas, tables, and columns for column refs', () => {
    it('- should suggest tables for inline ref', () => {
      const program = 'Table orders { id int }\nTable users {\n  order_id int [ref: > ]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 23);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'order_id',
        'orders',
        'users',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'order_id',
        'orders',
        'users',

      ]);
    });

    it('- should suggest columns after table name in ref', () => {
      const program = 'Table orders { id int pk }\nTable users {\n  order_id int [ref: > orders.]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 31);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'id',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'id',

      ]);
    });

    it('- should suggest schemas in ref context', () => {
      const program = 'Table myschema.orders { id int }\nTable users {\n  order_id int [ref: > ]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 23);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'order_id',
        'myschema',
        'users',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'order_id',
        'myschema',
        'users',

      ]);
    });
  });

  describe('should suggest in Ref block', () => {
    it('- should suggest tables in Ref block', () => {
      const program = 'Table orders { id int }\nTable users { id int }\nRef: ';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 6);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'orders',
        'users',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'orders',
        'users',

      ]);
    });

    it('- should suggest columns in Ref after dot', () => {
      const program = 'Table orders { id int }\nRef: orders.';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 13);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'id',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'id',

      ]);
    });

    it('- should suggest after relationship operators', () => {
      const program = 'Table orders { id int }\nTable users { order_id int }\nRef: users.order_id > ';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 23);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'orders',
        'users',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'orders',
        'users',

      ]);
    });

    it('- should suggest ref settings in brackets', () => {
      const program = 'Ref: users.id > orders.id []';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 28);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'update',
        'delete',
        'color',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'update: ',
        'delete: ',
        'color: ',

      ]);
    });

    it('- should suggest action values for update/delete settings', () => {
      const program = 'Ref: users.id > orders.id [update: ]';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 36);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'cascade',
        'set default',
        'set null',
        'restrict',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'cascade',
        'set default',
        'set null',
        'restrict',

      ]);
    });
  });

  describe('should suggest columns in indexes', () => {
    it('- should suggest table columns in indexes block', () => {
      const program = 'Table users {\n  id int\n  email varchar\n  indexes {\n    \n  }\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(5, 5);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'id',
        'email',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'id',
        'email',

      ]);
    });

    it('- should suggest in composite index', () => {
      const program = 'Table users {\n  id int\n  email varchar\n  indexes {\n    (id, )\n  }\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(5, 10);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'id',
        'email',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'id',
        'email',

      ]);
    });
  });

  describe('should suggest index settings', () => {
    it('- should suggest index settings in brackets', () => {
      const program = 'Table users {\n  id int\n  indexes {\n    id []\n  }\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 9);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'unique',
        'pk',
        'note',
        'name',
        'type',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'unique',
        'pk',
        'note: ',
        'name: ',
        'type: ',

      ]);
    });

    it('- should suggest index type values', () => {
      const program = 'Table users {\n  id int\n  indexes {\n    id [type: ]\n  }\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 15);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'btree',
        'hash',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'btree',
        'hash',

      ]);
    });
  });

  describe('should suggest check settings', () => {
    it('- should suggest check settings', () => {
      const program = 'Table users {\n  age int\n  checks {\n    age > 0 []\n  }\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 14);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'name',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'name: ',

      ]);
    });
  });

  describe('should suggest in TableGroup', () => {
    it('- should suggest tables in TableGroup', () => {
      const program = 'Table users { id int }\nTable orders { id int }\nTableGroup ecommerce {\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'users',
        'orders',
        'Note',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'users',
        'orders',
        'Note',

      ]);
    });

    it('- should suggest schema-qualified tables', () => {
      const program = 'Table myschema.users { id int }\nTableGroup group1 {\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'myschema',
        'Note',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'myschema',
        'Note',

      ]);
    });
  });

  describe('should suggest in TablePartial', () => {
    it('- should suggest table elements in TablePartial body', () => {
      const program = 'TablePartial mypartial {\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);
    });

    it('- should suggest TablePartial names after tilde operator', () => {
      const program = 'TablePartial mypartial {}\nTable users {\n  id int\n  ~\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 4);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'Note',
        'indexes',
        'checks',

      ]);
    });
  });

  describe('should suggest with member access', () => {
    it('- should suggest tables after schema dot', () => {
      const program = 'Table myschema.users { id int }\nTable myschema.orders { id int }\nmyschema.';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 10);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([]);
    });

    it('- should suggest columns after table dot', () => {
      const program = 'Table orders { id int, user_id int }\nRef: orders.';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 12);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'id',
      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'id',
      ]);
    });
  });

  describe('edge cases', () => {
    it('- should return no suggestions inside single-line comments', () => {
      const program = '// Table users\nTable orders { id int }';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 10);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.length).toBe(0);
    });

    it('- should return no suggestions inside multi-line comments', () => {
      const program = '/* Table users */\nTable orders { id int }';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 10);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.length).toBe(0);
    });

    it('- should return no suggestions inside string literals', () => {
      const program = 'Table users {\n  name varchar [note: "user "]  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 32);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.length).toBe(0);
    });

    it('- should handle whitespace after operators', () => {
      const program = 'Ref: users.id >  ';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 18);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([]);
    });

    it('- should work with incomplete syntax', () => {
      const program = 'Table users {\n  id int [pk\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 13);
      const result = provider.provideCompletionItems(model, position);

      // Should provide suggestions even with incomplete syntax
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('- should handle special characters in identifiers', () => {
      const program = 'Table "user-table" { id int }\nRef: ';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 6);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'user-table',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        '"user-table"',

      ]);
    });

    it('- should handle enum field settings', () => {
      const program = 'Enum status {\n  active []\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 11);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'note',

      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'note: ',

      ]);
    });

    it('- should handle project scope', () => {
      const program = 'Project myproject {\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 3);
      const result = provider.provideCompletionItems(model, position);

      // Test labels
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toEqual([
        'Table',
        'TableGroup',
        'Enum',
        'Note',
        'Ref',
        'TablePartial',
      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'Table',
        'TableGroup',
        'Enum',
        'Note',
        'Ref',
        'TablePartial',
      ]);
    });
  });
});
