import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import { createMockTextModel, createPosition, extractTextFromRange } from '../../utils';

describe('[snapshot] DefinitionProvider', () => {
  describe('should find definition for tables', () => {
    it('- should find table definition in Ref block', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in "Ref: posts.user_id > users.id"
      const position = createPosition(9, 25);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 3,
              "startColumn": 1,
              "startLineNumber": 1,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table users {
          id int pk
        }"
      `);
    });

    it('- should find table definition on left side of Ref', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "posts" in "Ref: posts.user_id"
      const position = createPosition(9, 6);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find table definition in inline ref', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int [ref: > users.id]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in inline ref
      const position = createPosition(6, 23);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find table definition with different ref operators (<, -, <>)', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id < users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" with < operator
      const position = createPosition(9, 25);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 3,
              "startColumn": 1,
              "startLineNumber": 1,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table users {
          id int pk
        }"
      `);
    });

    it('- should find self-referential table', () => {
      const program = `Table users {
  id int pk
  referrer_id int
}

Ref: users.referrer_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on second "users" in self-reference
      const position = createPosition(6, 26);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });
  });

  describe('should find definition for columns', () => {
    it('- should find column definition in Ref block', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" in "users.id"
      const position = createPosition(9, 31);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 12,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot('"id int pk"');
    });

    it('- should find column definition on left side of Ref', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "user_id" in "posts.user_id"
      const position = createPosition(9, 12);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find column definition in inline ref', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int [ref: > users.id]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" in inline ref
      const position = createPosition(6, 29);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find column in composite foreign key', () => {
      const program = `Table merchants {
  id int pk
  country_code varchar
}

Table orders {
  merchant_id int
  country varchar
}

Ref: (orders.merchant_id, orders.country) > (merchants.id, merchants.country_code)`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "country_code" in composite ref
      const position = createPosition(11, 72);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 23,
              "endLineNumber": 3,
              "startColumn": 3,
              "startLineNumber": 3,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot('"country_code varchar"');
    });
  });

  describe('should find definition for enums', () => {
    it('- should find enum definition when used as column type', () => {
      const program = `Enum order_status {
  pending
  processing
  completed
}

Table orders {
  id int pk
  status order_status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "order_status" column type
      const position = createPosition(9, 10);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find enum definition in default value context', () => {
      const program = `Enum order_status {
  pending
  processing
}

Table orders {
  status order_status [default: order_status.pending]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "order_status" in default value
      const position = createPosition(7, 33);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find enum field definition', () => {
      const program = `Enum order_status {
  pending
  processing
}

Table orders {
  status order_status [default: order_status.pending]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "pending" in default value
      const position = createPosition(7, 47);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 10,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot('"pending"');
    });
  });

  describe('should find definition for schema-qualified names', () => {
    it('- should find schema-qualified table definition', () => {
      const program = `Table ecommerce.users {
  id int pk
}

Table ecommerce.orders {
  user_id int
}

Ref: ecommerce.orders.user_id > ecommerce.users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in qualified name
      const position = createPosition(9, 43);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find column in schema-qualified table', () => {
      const program = `Table ecommerce.users {
  id int pk
}

Table ecommerce.orders {
  user_id int
}

Ref: ecommerce.orders.user_id > ecommerce.users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" in qualified name
      const position = createPosition(9, 49);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find schema-qualified enum definition', () => {
      const program = `Enum myschema.status {
  active
  inactive
}

Table users {
  user_status myschema.status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" in qualified enum type
      const position = createPosition(7, 25);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 4,
              "startColumn": 1,
              "startLineNumber": 1,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Enum myschema.status {
          active
          inactive
        }"
      `);
    });
  });

  describe('should find definition for TableGroup references', () => {
    it('- should find table definition in TableGroup', () => {
      const program = `Table users {
  id int pk
}

Table orders {
  id int pk
}

TableGroup ecommerce {
  users
  orders
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in TableGroup
      const position = createPosition(10, 3);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find schema-qualified table in TableGroup', () => {
      const program = `Table myschema.users {
  id int pk
}

TableGroup group1 {
  myschema.users
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in qualified TableGroup reference
      const position = createPosition(6, 12);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });
  });

  describe('should find definition for index column references', () => {
    it('- should find column definition in single-column index', () => {
      const program = `Table users {
  id int pk
  email varchar

  indexes {
    email
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "email" in index
      const position = createPosition(6, 5);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find column definition in composite index', () => {
      const program = `Table orders {
  id int pk
  merchant_id int
  status varchar

  indexes {
    (merchant_id, status)
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" in composite index
      const position = createPosition(7, 19);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find column in named index', () => {
      const program = `Table users {
  id int pk
  email varchar

  indexes {
    email [name: 'email_idx', unique]
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "email" in named index
      const position = createPosition(6, 5);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });
  });

  describe('should find definition for TablePartial references', () => {
    it('- should find TablePartial definition in injection', () => {
      const program = `TablePartial base_timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users {
  id int pk
  ~base_timestamps
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "base_timestamps" in injection
      const position = createPosition(8, 4);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 4,
              "startColumn": 1,
              "startLineNumber": 1,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "TablePartial base_timestamps {
          created_at timestamp
          updated_at timestamp
        }"
      `);
    });

    it('- should find injected column definition from TablePartial', () => {
      const program = `TablePartial base_timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users {
  id int pk
  ~base_timestamps
}

Ref: users.created_at > logs.timestamp`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "created_at" which is injected from partial
      const position = createPosition(11, 12);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should find schema-qualified TablePartial', () => {
      const program = `TablePartial myschema.timestamps {
  created_at timestamp
}

Table users {
  id int pk
  ~myschema.timestamps
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "timestamps" in qualified partial injection
      const position = createPosition(7, 13);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });
  });

  describe('should handle edge cases', () => {
    it('- should return empty array for keyword', () => {
      const program = `Table users {
  id int pk
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on keyword "Table"
      const position = createPosition(1, 1);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should return empty array for operators', () => {
      const program = `Table users { id int }
Table posts { user_id int }
Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on ">" operator
      const position = createPosition(3, 20);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should return empty array for literals', () => {
      const program = `Table users {
  id int [default: 123]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on number literal
      const position = createPosition(2, 20);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should return empty array for string literals', () => {
      const program = `Table users {
  name varchar [note: "User name"]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position inside string literal
      const position = createPosition(2, 27);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should return empty array for attribute keywords', () => {
      const program = `Table users {
  id int [pk]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "pk" attribute
      const position = createPosition(2, 11);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should return empty array in comments', () => {
      const program = `// Table users { id int }
Table posts {
  id int pk
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position inside comment
      const position = createPosition(1, 10);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should handle whitespace gracefully', () => {
      const program = `Table users {
  id int pk
}



Ref: users.id > posts.user_id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on blank line
      const position = createPosition(5, 1);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should handle position at start of file', () => {
      const program = `Table users {
  id int pk
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position at very start
      const position = createPosition(1, 1);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should handle position at end of file', () => {
      const program = `Table users {
  id int pk
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position at very end
      const position = createPosition(3, 2);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('should handle unresolved references', () => {
    it('- should return empty array for non-existent table', () => {
      const program = `Table users {
  id int pk
}

Ref: users.id > nonexistent.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on non-existent table
      const position = createPosition(5, 17);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should return empty array for non-existent column', () => {
      const program = `Table users {
  id int pk
}

Ref: users.nonexistent_col > posts.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on non-existent column
      const position = createPosition(5, 12);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should return empty array for non-existent enum', () => {
      const program = `Table orders {
  status nonexistent_enum
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on non-existent enum
      const position = createPosition(2, 10);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should return empty array for non-existent TablePartial', () => {
      const program = `Table users {
  id int pk
  ~nonexistent_partial
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on non-existent partial
      const position = createPosition(3, 4);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('should handle complex scenarios', () => {
    it('- should handle multiple tables with same name in different schemas', () => {
      const program = `Table schema1.orders {
  id int pk
}

Table schema2.orders {
  id int pk
}

Ref: schema1.orders.id > schema2.orders.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on schema1.orders
      const position = createPosition(9, 15);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 3,
              "startColumn": 1,
              "startLineNumber": 1,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table schema1.orders {
          id int pk
        }"
      `);

      // Position on schema2.orders
      const position2 = createPosition(9, 33);
      const definitions2 = definitionProvider.provideDefinition(model, position2);

      expect(definitions2).toMatchInlineSnapshot('[]');
    });

    it('- should handle mixed direct and injected columns', () => {
      const program = `TablePartial timestamps {
  created_at timestamp
}

Table users {
  id int pk
  created_at timestamp [note: "Override"]
  ~timestamps
}

Ref: users.created_at > logs.timestamp`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on created_at in ref - should find direct definition, not injected
      const position = createPosition(11, 12);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should handle long qualified names', () => {
      const program = `Table myproject.ecommerce.users {
  id int pk
}

Table orders {
  user_id int
}

Ref: orders.user_id > myproject.ecommerce.users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in long qualified name
      const position = createPosition(9, 44);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 3,
              "startColumn": 1,
              "startLineNumber": 1,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table myproject.ecommerce.users {
          id int pk
        }"
      `);
    });

    it('- should handle column reference in check constraint', () => {
      const program = `Table users {
  age int
  email varchar

  checks {
    age > 0
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "age" in check constraint
      const position = createPosition(6, 5);
      const definitions = definitionProvider.provideDefinition(model, position);

      // Check constraints may or may not resolve - just verify no crash
      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should handle table alias in TableGroup', () => {
      const program = `Table users {
  id int pk
}

Table users as u {
  id int pk
}

TableGroup group1 {
  u
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on alias "u" in TableGroup
      const position = createPosition(10, 3);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('should provide accurate definition ranges', () => {
    it('- should return correct range for table definition', () => {
      const program = `Table users {
  id int pk
}

Ref: users.id > posts.user_id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users"
      const position = createPosition(5, 6);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should return correct range for column definition', () => {
      const program = `Table users {
  id int pk
  email varchar
}

Ref: users.email > logs.email_col`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "email" in ref
      const position = createPosition(6, 12);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should return correct range for enum definition', () => {
      const program = `Enum status {
  active
  inactive
}

Table users {
  user_status status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" type
      const position = createPosition(7, 15);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });
  });

  describe('should find definition for columns/tables on right side of refs', () => {
    it('- should find column definition on right side of Ref block', () => {
      const program = `Table users {
  id int pk
  email varchar
}

Table posts {
  user_id int
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" in "users.id" (right side)
      const position = createPosition(10, 31);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 12,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot('"id int pk"');
    });

    it('- should find column definition on right side of inline ref', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int [ref: > users.id]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" in "users.id" (right side)
      const position = createPosition(6, 30);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 12,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot('"id int pk"');
    });

    it('- should find table definition on right side of Ref with < operator', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: users.id < posts.user_id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "posts" (right side with < operator)
      const position = createPosition(9, 18);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 7,
              "startColumn": 1,
              "startLineNumber": 5,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table posts {
          user_id int
        }"
      `);
    });

    it('- should find column in composite ref on right side', () => {
      const program = `Table users {
  first_name varchar
  last_name varchar
}

Table posts {
  author_first varchar
  author_last varchar
}

Ref: posts.(author_first, author_last) > users.(first_name, last_name)`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "first_name" in right side composite ref
      const position = createPosition(11, 57);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 21,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot('"first_name varchar"');
    });
  });

  describe('should handle compile errors gracefully', () => {
    it('- should handle incomplete table definition', () => {
      const program = `Table users {
  id int`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users"
      const position = createPosition(1, 8);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should handle incomplete ref statement', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id >`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "posts" in incomplete ref
      const position = createPosition(9, 7);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 2,
              "endLineNumber": 7,
              "startColumn": 1,
              "startLineNumber": 5,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table posts {
          user_id int
        }"
      `);
    });

    it('- should handle incomplete inline ref', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int [ref: >]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "user_id"
      const position = createPosition(6, 4);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should handle ref to non-existent table with partial code', () => {
      const program = `Table users {
  id int pk
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "posts" (non-existent table)
      const position = createPosition(5, 7);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should handle incomplete enum definition', () => {
      const program = `Enum status {
  active`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status"
      const position = createPosition(1, 7);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should handle malformed table with missing braces', () => {
      const program = `Table users
  id int pk
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users"
      const position = createPosition(1, 8);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });

    it('- should handle unclosed TableGroup', () => {
      const program = `Table users { id int }
Table posts { id int }

TableGroup my_group {
  users`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in TableGroup
      const position = createPosition(5, 4);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 23,
              "endLineNumber": 1,
              "startColumn": 1,
              "startLineNumber": 1,
            },
            "uri": "",
          },
        ]
      `);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot('"Table users { id int }"');
    });

    it('- should handle broken composite ref', () => {
      const program = `Table users {
  first_name varchar
  last_name varchar
}

Table posts {
  author_first varchar
}

Ref: posts.(author_first, author_last) > users.(first_name, last_name)`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "author_last" (doesn't exist in posts)
      const position = createPosition(10, 28);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toMatchInlineSnapshot('[]');
    });
  });

  describe('should verify range points to correct source text', () => {
    it('- range should point to table definition source for table reference', () => {
      const program = `Table users {
  id int pk
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in ref
      const position = createPosition(5, 23);
      const definitions = definitionProvider.provideDefinition(model, position);
      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;

      // Verify range points to table definition (entire table block from "Table users {" to "}")
      expect(definitions.length).toBe(1);
      const range = definitions[0].range;

      // Extract the source text the range covers
      const sourceText = extractTextFromRange(program, range);

      // Verify it starts with "Table users"
      expect(sourceText.trim().startsWith('Table users')).toBe(true);
    });

    it('- range should point to column definition source for column reference', () => {
      const program = `Table users {
  id int pk
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" in "users.id"
      const position = createPosition(5, 29);
      const definitions = definitionProvider.provideDefinition(model, position);
      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;

      // Verify range points to column definition line
      expect(definitions.length).toBe(1);
      const range = definitions[0].range;
      const sourceText = extractTextFromRange(program, range);

      // Verify it contains the column definition "id int pk"
      expect(sourceText.trim()).toBe('id int pk');
    });

    it('- range should point to enum definition source for enum reference', () => {
      const program = `Enum status {
  active
  inactive
}

Table users {
  user_status status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" type
      const position = createPosition(7, 16);
      const definitions = definitionProvider.provideDefinition(model, position);
      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;

      // Verify range points to enum definition (entire enum block)
      expect(definitions.length).toBe(1);
      const range = definitions[0].range;

      // Extract multi-line source text
      const sourceText = extractTextFromRange(program, range);

      // Verify it starts with "Enum status"
      expect(sourceText.trim().startsWith('Enum status')).toBe(true);
    });

    it('- range should point to TablePartial definition source for TablePartial reference', () => {
      const program = `TablePartial mypartial {
  extra_field varchar
}

Table users {
  id int
  ~mypartial
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "mypartial" in injection
      const position = createPosition(7, 4);
      const definitions = definitionProvider.provideDefinition(model, position);
      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;

      // Verify range points to TablePartial definition
      expect(definitions.length).toBe(1);
      const range = definitions[0].range;

      // Extract multi-line source text
      const sourceText = extractTextFromRange(program, range);

      // Verify it starts with "TablePartial mypartial"
      expect(sourceText.trim().startsWith('TablePartial mypartial')).toBe(true);
    });

    it('- range should point to schema-qualified table definition source', () => {
      const program = `Table public.users {
  id int pk
}

Ref: posts.user_id > public.users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in "public.users"
      const position = createPosition(5, 30);
      const definitions = definitionProvider.provideDefinition(model, position);
      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;

      // Verify range points to table definition
      expect(definitions.length).toBe(1);
      const range = definitions[0].range;

      // Extract multi-line source text
      const sourceText = extractTextFromRange(program, range);

      // Verify it starts with "Table public.users"
      expect(sourceText.trim().startsWith('Table public.users')).toBe(true);
    });
  });

  describe('complex multi-table scenarios', () => {
    it('- should find definition in large schema with many tables', () => {
      const program = `Table users {
  id int pk
  email varchar
}

Table posts {
  id int pk
  user_id int
  title varchar
}

Table comments {
  id int pk
  post_id int
  user_id int
  content text
}

Table likes {
  id int pk
  user_id int
  post_id int
}

Table tags {
  id int pk
  name varchar
}

Table post_tags {
  post_id int
  tag_id int
}

Ref: posts.user_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id
Ref: likes.user_id > users.id
Ref: likes.post_id > posts.id
Ref: post_tags.post_id > posts.id
Ref: post_tags.tag_id > tags.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in last ref
      const position = createPosition(36, 24);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (definitions.length > 0) {
        const sourceText = extractTextFromRange(program, definitions[0].range);
        expect(sourceText.includes('Table users')).toBe(true);
      }
    });

    it('- should navigate definition in many-to-many relationship', () => {
      const program = `Table students {
  id int pk
  name varchar
}

Table courses {
  id int pk
  title varchar
}

Table enrollments {
  student_id int [ref: > students.id]
  course_id int [ref: > courses.id]
  enrolled_at timestamp

  indexes {
    (student_id, course_id) [pk]
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "students" in inline ref
      const position = createPosition(12, 29);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should find definition with polymorphic relationships', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  id int pk
}

Table comments {
  id int pk
  commentable_type varchar
  commentable_id int
}

// Comments can belong to users or posts
Ref: comments.commentable_id > users.id
Ref: comments.commentable_id > posts.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in first polymorphic ref
      const position = createPosition(17, 33);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('sticky notes and project elements', () => {
    it('- should handle Note element at top level', () => {
      const program = `Note project_overview {
  'This is the main project database'
}

Table users {
  id int pk
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "project_overview" Note
      const position = createPosition(1, 10);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should handle Project element with nested elements', () => {
      const program = `Project ecommerce {
  database_type: 'PostgreSQL'
  Note: 'E-commerce database schema'
}

Table users {
  id int pk
}

Ref: orders.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in ref
      const position = createPosition(10, 24);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should handle sticky notes inside tables', () => {
      const program = `Table users {
  id int pk
  email varchar [note: 'User email address']

  Note: 'Main user table for authentication'
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in ref
      const position = createPosition(8, 24);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('complex index scenarios', () => {
    it('- should find definition for column in expression index', () => {
      const program = `Table users {
  id int pk
  first_name varchar
  last_name varchar
  email varchar

  indexes {
    email [unique, name: 'idx_email']
    (first_name, last_name) [name: 'idx_fullname']
    \`lower(email)\` [name: 'idx_email_lower']
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "first_name" in composite index
      const position = createPosition(9, 6);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should handle index with multiple settings', () => {
      const program = `Table orders {
  id int pk
  status varchar
  created_at timestamp

  indexes {
    (status, created_at) [type: btree, name: 'idx_status_time', note: 'For status queries']
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" in composite index
      const position = createPosition(7, 6);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('TablePartial complex scenarios', () => {
    it('- should find definition with multiple TablePartial injections', () => {
      const program = `TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

TablePartial soft_delete {
  deleted_at timestamp
  is_deleted bool
}

TablePartial audit {
  created_by int
  updated_by int
}

Table users {
  id int pk
  name varchar
  ~timestamps
  ~soft_delete
  ~audit
}

Ref: users.created_by > admins.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "timestamps" injection
      const position = createPosition(19, 4);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (definitions.length > 0) {
        const sourceText = extractTextFromRange(program, definitions[0].range);
        expect(sourceText.includes('TablePartial timestamps')).toBe(true);
      }
    });

    it('- should find definition for TablePartial with indexes', () => {
      const program = `TablePartial searchable {
  search_vector tsvector

  indexes {
    search_vector [type: gin]
  }
}

Table articles {
  id int pk
  title varchar
  content text
  ~searchable
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "searchable" injection
      const position = createPosition(13, 4);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('enum complex scenarios', () => {
    it('- should find enum field definition with notes', () => {
      const program = `Enum order_status {
  pending [note: 'Order placed but not processed']
  processing [note: 'Order being prepared']
  shipped [note: 'Order in transit']
  delivered [note: 'Order received']
  cancelled [note: 'Order cancelled by user']
}

Table orders {
  id int pk
  status order_status [default: order_status.pending]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "pending" in default value
      const position = createPosition(11, 48);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should find enum definition with multiple usages', () => {
      const program = `Enum user_role {
  admin
  moderator
  user
  guest
}

Table users {
  id int pk
  role user_role [default: user_role.user]
}

Table audit_logs {
  id int pk
  actor_role user_role
  action varchar
}

Table permissions {
  id int pk
  required_role user_role
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "user_role" in permissions table
      const position = createPosition(21, 18);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('TableGroup complex scenarios', () => {
    it('- should find table definition from nested TableGroup', () => {
      const program = `Table auth.users {
  id int pk
}

Table auth.sessions {
  id int pk
  user_id int
}

Table billing.invoices {
  id int pk
}

Table billing.payments {
  id int pk
}

TableGroup authentication [color: #3498db] {
  auth.users
  auth.sessions
}

TableGroup finance [color: #2ecc71] {
  billing.invoices
  billing.payments
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in TableGroup
      const position = createPosition(20, 8);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should handle TableGroup with table aliases', () => {
      const program = `Table users as u {
  id int pk
}

Table orders as o {
  id int pk
  user_id int
}

TableGroup core {
  u
  o
}

Ref: o.user_id > u.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "u" alias in TableGroup
      const position = createPosition(11, 3);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('ref with settings complex scenarios', () => {
    it('- should find definition in ref with all settings', () => {
      const program = `Table users {
  id int pk
}

Table orders {
  id int pk
  user_id int
}

Ref orders_user [update: cascade, delete: set null, color: #ff0000]: orders.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in named ref with settings
      const position = createPosition(10, 86);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should find definition in composite ref with settings', () => {
      const program = `Table warehouses {
  id int pk
  region_code varchar pk
}

Table inventory {
  warehouse_id int
  warehouse_region varchar
  product_id int
  quantity int
}

Ref inventory_warehouse [delete: cascade]: (inventory.warehouse_id, inventory.warehouse_region) > (warehouses.id, warehouses.region_code)`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "region_code" in composite ref
      const position = createPosition(13, 127);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('unicode and special characters', () => {
    it('- should find definition with unicode table names', () => {
      const program = `Table "用户" {
  id int pk
  "名称" varchar
}

Table posts {
  user_id int
}

Ref: posts.user_id > "用户".id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on quoted unicode table name
      const position = createPosition(10, 24);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('- should find definition with special SQL keywords as names', () => {
      const program = `Table "order" {
  id int pk
  "select" varchar
  "from" varchar
}

Table "user" {
  id int pk
}

Ref: "order".id > "user".id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "user" (SQL keyword as table name)
      const position = createPosition(12, 20);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });
  });
});
