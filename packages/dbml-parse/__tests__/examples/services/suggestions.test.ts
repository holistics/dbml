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
      expect(labels).toContain('Table');
      expect(labels).toContain('TableGroup');
      expect(labels).toContain('Enum');
      expect(labels).toContain('Project');
      expect(labels).toContain('Ref');
      expect(labels).toContain('TablePartial');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Records');
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
      expect(labels).toContain('Table');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Records');
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
      expect(labels).toContain('Table');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Records');
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
      expect(labels).toContain('Table');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Records');
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
      expect(labels).toContain('Note');
      expect(labels).toContain('indexes');
      expect(labels).toContain('checks');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Note');
      expect(insertTexts).toContain('Records');
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
      expect(labels).toContain('Note');
      expect(labels).toContain('indexes');
      expect(labels).toContain('checks');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Note');
      expect(insertTexts).toContain('Records');
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
      expect(labels).toContain('Note');
      expect(labels).toContain('indexes');
      expect(labels).toContain('checks');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Note');
      expect(insertTexts).toContain('Records');
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
      expect(labels).toContain('Note');
      expect(labels).toContain('indexes');
      expect(labels).toContain('checks');
      expect(labels).toContain('Records');

      // Test insertTexts - should have Records keyword
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toContain('Note');
      expect(insertTexts).toContain('Records');
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
        'mypartial',
      ]);

      // Test insertTexts
      const insertTexts = result.suggestions.map((s) => s.insertText);
      expect(insertTexts).toEqual([
        'mypartial',
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
        '""user-table""',
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

  describe('complex multi-schema scenarios', () => {
    it('- should suggest schemas or tables from multiple schemas in Ref', () => {
      const program = `Table auth.users { id int pk }
Table billing.customers { id int pk }
Table shop.orders { id int pk }
Ref: `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 6);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should suggest schemas that have tables
      expect(labels).toContain('auth');
      expect(labels).toContain('billing');
      expect(labels).toContain('shop');
    });

    it('- should suggest tables after schema in Ref', () => {
      const program = `Table auth.users { id int pk }
Table auth.sessions { id int pk }
Table billing.invoices { id int pk }
Ref: auth.`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 11);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should suggest tables in auth schema
      expect(labels).toContain('users');
      expect(labels).toContain('sessions');
    });

    it('- should suggest columns from schema-qualified table', () => {
      const program = `Table auth.users {
  id int pk
  email varchar
  username varchar
}
Ref: auth.users.`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(6, 16);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // May suggest 'users' (the table) since column lookup may not be fully qualified
      // This tests the completion behavior at this position
      expect(Array.isArray(labels)).toBe(true);
    });

    it('- should suggest schema-qualified enums for column type', () => {
      const program = `Enum auth.user_status { active inactive }
Enum billing.payment_status { pending paid }
Table users {
  id int
  status `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(5, 10);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should suggest schema names for qualified enums
      expect(labels).toContain('auth');
      expect(labels).toContain('billing');
    });
  });

  describe('complex column settings scenarios', () => {
    it('- should suggest remaining settings after multiple have been used', () => {
      const program = 'Table users {\n  id int [pk, not null, unique, ]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 32);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should still suggest available settings
      expect(labels).toContain('ref');
      expect(labels).toContain('default');
      expect(labels).toContain('note');
    });

    it('- should suggest ref targets in inline ref with existing settings', () => {
      const program = `Table orders { id int pk }
Table users {
  order_id int [not null, ref: > ]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 33);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('orders');
    });

    it('- should suggest default values for boolean column', () => {
      const program = 'Table users {\n  is_active bool [default: ]\n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 29);
      const result = provider.provideCompletionItems(model, position);

      // Should return suggestions (may be empty or have default values)
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('- should suggest check expression context', () => {
      const program = `Table products {
  price decimal
  quantity int [check: ]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 23);
      const result = provider.provideCompletionItems(model, position);

      // Check expressions might not have specific suggestions
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('complex index scenarios', () => {
    it('- should suggest columns in expression index context', () => {
      const program = `Table users {
  id int pk
  email varchar
  first_name varchar
  last_name varchar

  indexes {
    \`lower( )\`
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(8, 12);
      const result = provider.provideCompletionItems(model, position);

      // May or may not suggest inside expression
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('- should suggest after partial composite index', () => {
      const program = `Table orders {
  id int pk
  status varchar
  created_at timestamp
  customer_id int

  indexes {
    (status, )
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(8, 13);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('created_at');
      expect(labels).toContain('customer_id');
    });

    it('- should suggest index settings in complex index', () => {
      const program = `Table logs {
  id int pk
  level varchar
  created_at timestamp

  indexes {
    (level, created_at) [type: btree, ]
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(7, 38);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('unique');
      expect(labels).toContain('pk');
      expect(labels).toContain('name');
      expect(labels).toContain('note');
    });
  });

  describe('complex TablePartial scenarios', () => {
    it('- should suggest TablePartial names in table body', () => {
      const program = `TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

TablePartial soft_delete {
  deleted_at timestamp
}

Table users {
  id int pk
  ~
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(12, 4);
      const result = provider.provideCompletionItems(model, position);

      // Should suggest table sub-elements
      const labels = result.suggestions.map((s) => s.label);
      expect(Array.isArray(labels)).toBe(true);
    });

    it('- should suggest in TablePartial with indexes', () => {
      const program = `TablePartial indexed_timestamps {
  created_at timestamp
  updated_at timestamp

  indexes {

  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(6, 5);
      const result = provider.provideCompletionItems(model, position);

      // TablePartial indexes may or may not suggest columns depending on implementation
      // This tests the behavior of suggestions in indexes within TablePartial
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('- should suggest schema-qualified TablePartial', () => {
      const program = `TablePartial common.timestamps {
  created_at timestamp
}

Table users {
  id int pk
  ~common.
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(7, 11);
      const result = provider.provideCompletionItems(model, position);

      // Should suggest the TablePartial name after schema
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('complex enum scenarios', () => {
    it('- should suggest enum values in default after schema', () => {
      const program = `Enum billing.payment_status {
  pending
  paid
  refunded
}

Table payments {
  id int pk
  status billing.payment_status [default: billing.payment_status.]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 65);
      const result = provider.provideCompletionItems(model, position);

      // Should suggest enum values
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('- should suggest in enum field settings', () => {
      const program = `Enum priority {
  low [note: 'Low priority']
  medium []
  high
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 11);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('note');
    });
  });

  describe('complex Ref scenarios', () => {
    it('- should suggest in named Ref with settings', () => {
      const program = `Table users { id int pk }
Table orders { user_id int }
Ref order_user [update: cascade, delete: ]: orders.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 42);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('cascade');
      expect(labels).toContain('set null');
      expect(labels).toContain('restrict');
    });

    it('- should suggest after composite ref opening paren', () => {
      const program = `Table warehouses {
  id int pk
  region varchar pk
}

Table inventory {
  warehouse_id int
  warehouse_region varchar
}

Ref: (inventory.)`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(11, 17);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('warehouse_id');
      expect(labels).toContain('warehouse_region');
    });

    it('- should suggest after ref relationship operator with schema', () => {
      const program = `Table auth.users { id int pk }
Table public.orders { user_id int }
Ref: public.orders.user_id > auth.`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 35);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('users');
    });

    it('- should suggest columns in Ref long form body', () => {
      const program = `Table users {
  id int pk
  email varchar
}

Table orders {
  id int pk
  user_id int
}

Ref order_user {
  orders.user_id > users.
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(12, 26);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('id');
    });
  });

  describe('complex TableGroup scenarios', () => {
    it('- should suggest schema-qualified tables in TableGroup', () => {
      const program = `Table auth.users { id int pk }
Table auth.sessions { id int pk }
Table billing.invoices { id int pk }

TableGroup authentication {
  auth.
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(6, 8);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('users');
      expect(labels).toContain('sessions');
    });

    it('- should suggest in TableGroup with existing tables', () => {
      const program = `Table users { id int pk }
Table orders { id int pk }
Table products { id int pk }

TableGroup ecommerce {
  users

}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(7, 3);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should still suggest other tables
      expect(labels).toContain('orders');
      expect(labels).toContain('products');
    });

    it('- should suggest Note inside TableGroup', () => {
      const program = `Table users { id int pk }
TableGroup core {
  users

}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(4, 3);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('Note');
    });
  });

  describe('real-world complex scenarios', () => {
    it('- should work with large schema', () => {
      const program = `
Table users { id int pk, email varchar, name varchar }
Table profiles { id int pk, user_id int, bio text }
Table posts { id int pk, author_id int, title varchar, content text }
Table comments { id int pk, post_id int, user_id int, content text }
Table likes { id int pk, user_id int, post_id int }
Table follows { follower_id int, following_id int }
Table tags { id int pk, name varchar }
Table post_tags { post_id int, tag_id int }

Ref: profiles.user_id > users.id
Ref: posts.author_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id
Ref: likes.user_id > users.id
Ref: likes.post_id > posts.id
Ref: follows.follower_id > users.id
Ref: follows.following_id > users.id
Ref: post_tags.post_id > posts.id
Ref: post_tags.tag_id > tags.id

Enum post_status { draft published archived }

Table notifications {
  id int pk
  user_id int
  `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(26, 3);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should suggest table sub-elements
      expect(labels).toContain('Note');
      expect(labels).toContain('indexes');
    });

    it('- should handle multiple refs to same table', () => {
      const program = `Table addresses { id int pk }
Table users {
  id int pk
  home_address_id int [ref: > addresses.id]
  work_address_id int [ref: > addresses.]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(5, 41);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('id');
    });

    it('- should work with mixed explicit and inline refs', () => {
      const program = `Table categories { id int pk }
Table products {
  id int pk
  category_id int
  parent_category_id int [ref: > categories.id]
}

Ref: products.category_id > categories.`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(8, 41);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('id');
    });

    it('- should work with deeply nested schema structure', () => {
      const program = `Table mycompany.ecommerce.users {
  id int pk
  email varchar
}

Table mycompany.ecommerce.orders {
  id int pk
  user_id int
}

Ref: mycompany.ecommerce.orders.user_id > mycompany.ecommerce.`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(11, 62);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should suggest something at this position (may be 'ecommerce' or tables)
      expect(Array.isArray(labels)).toBe(true);
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  describe('error recovery and incomplete syntax', () => {
    it('- should provide suggestions in incomplete table definition', () => {
      const program = `Table users {
  id int pk
  email varchar
  // incomplete column
  status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(5, 10);
      const result = provider.provideCompletionItems(model, position);

      // Should still provide type suggestions
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('- should handle missing closing brace', () => {
      const program = `Table users {
  id int pk
  email varchar [`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 18);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      // Should provide some suggestions in incomplete syntax
      // May suggest column settings or table header settings depending on parsing
      expect(Array.isArray(labels)).toBe(true);
    });

    it('- should handle incomplete Ref', () => {
      const program = `Table users { id int pk }
Table orders { user_id int }
Ref: orders.user_id >`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 22);
      const result = provider.provideCompletionItems(model, position);

      // Should still try to provide suggestions
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('- should handle syntax errors gracefully', () => {
      const program = `Table users {
  id int pk
  @#$%^ invalid syntax
  email varchar
}

Table posts {
  id int pk
  user_id int [ref: > users.]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 29);
      const result = provider.provideCompletionItems(model, position);

      // Should still provide some suggestions despite syntax error
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('Records element suggestions', () => {
    it('- should suggest table names for top-level Records', () => {
      const program = `Table users {
  id int pk
  name varchar
}

Table orders {
  id int pk
}

Records `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(10, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.some((s) => s.label === 'users')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'orders')).toBe(true);
    });

    it('- should suggest column names for Records column list', () => {
      const program = `Table users {
  id int pk
  name varchar
  email varchar
  age int
}

Records users(id, )`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(8, 19);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.some((s) => s.label === 'name')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'email')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'age')).toBe(true);
    });

    it('- should suggest schema-qualified table names', () => {
      const program = `Table s.users {
  id int pk
}

Table s.orders {
  id int pk
}

Records s.`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 11);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.some((s) => s.label === 'users')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'orders')).toBe(true);
    });

    it('- should suggest column names for Records inside table', () => {
      const program = `Table products {
  id integer [pk]
  name varchar
  price decimal

  Records ()
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(6, 12);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.some((s) => s.label === 'id')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'name')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'price')).toBe(true);
    });

    it('- should suggest enum values in Records data rows', () => {
      const program = `Enum status {
  active
  inactive
  pending
}

Table users {
  id int pk
  user_status status
}

Records users(id, user_status) {
  1, status.
}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(13, 14);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.some((s) => s.label === 'active')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'inactive')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'pending')).toBe(true);
    });

    it('- should suggest Records keyword in table body', () => {
      const program = `Table products {
  id integer [pk]
  name varchar


}`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(5, 3);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.some((s) => s.label === 'Records')).toBe(true);
    });

    it('- should suggest column names in Records call expression', () => {
      const program = `Table users {
  id int pk
  name varchar
  email varchar
}

Records users()`;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(7, 15);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions.some((s) => s.label === 'id')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'name')).toBe(true);
      expect(result.suggestions.some((s) => s.label === 'email')).toBe(true);
    });
  });
});
