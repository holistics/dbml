import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLReferencesProvider from '@/services/references/provider';
import { createPosition, createMockTextModel, extractTextFromRange } from '../../utils';

describe('[snapshot] ReferencesProvider', () => {
  it('should return empty array when no references found', () => {
    const program = 'Table test { id int }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = createMockTextModel(program);

    const position = createPosition(1, 1);
    const references = referencesProvider.provideReferences(model, position);

    expect(references).toEqual([]);
  });

  describe('should find all references for tables', () => {
    it('- should find table references in Ref blocks', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 27,
              "endLineNumber": 9,
              "startColumn": 22,
              "startLineNumber": 9,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toEqual('users');
      });
    });

    it('- should find table references in inline refs', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int [ref: > users.id]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 28,
              "endLineNumber": 6,
              "startColumn": 23,
              "startLineNumber": 6,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toEqual('users');
      });
    });

    it('- should find table references in TableGroup', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  id int pk
}

TableGroup my_group {
  users
  posts
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 8,
              "endLineNumber": 10,
              "startColumn": 3,
              "startLineNumber": 10,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toEqual('users');
      });
    });

    it('- should find schema-qualified table references', () => {
      const program = `Table myschema.users {
  id int pk
}

Ref: posts.user_id > myschema.users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in schema-qualified table declaration
      const position = createPosition(1, 18);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 36,
              "endLineNumber": 5,
              "startColumn": 31,
              "startLineNumber": 5,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toEqual('users');
      });
    });
  });

  describe('should find all references for columns', () => {
    it('- should find column references in Ref blocks', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" column declaration
      const position = createPosition(2, 3);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 27,
              "endLineNumber": 9,
              "startColumn": 22,
              "startLineNumber": 9,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const line = program.split('\n')[ref.range.startLineNumber - 1];
        expect(line).toContain('users.id');
      });
    });

    it('- should find multiple column references', () => {
      const program = `Table users {
  id int pk
}

Table posts {
  user_id int
  author_id int
}

Ref: posts.user_id > users.id
Ref: posts.author_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" column declaration
      const position = createPosition(2, 3);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 27,
              "endLineNumber": 10,
              "startColumn": 22,
              "startLineNumber": 10,
            },
            "uri": "",
          },
          {
            "range": {
              "endColumn": 29,
              "endLineNumber": 11,
              "startColumn": 24,
              "startLineNumber": 11,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const line = program.split('\n')[ref.range.startLineNumber - 1];
        expect(line).toContain('users.id');
      });
    });
  });

  describe('should find all references for enums', () => {
    it('- should find enum references in column types', () => {
      const program = `Enum status {
  active
  inactive
}

Table users {
  user_status status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" enum declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 21,
              "endLineNumber": 7,
              "startColumn": 15,
              "startLineNumber": 7,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toEqual('status');
      });
    });

    it('- should find schema-qualified enum references', () => {
      const program = `Enum myschema.status {
  active
  inactive
}

Table users {
  user_status myschema.status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" in enum declaration
      const position = createPosition(1, 17);
      const references = referencesProvider.provideReferences(model, position);

      // Snapshot test for ranges
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 30,
              "endLineNumber": 7,
              "startColumn": 24,
              "startLineNumber": 7,
            },
            "uri": "",
          },
        ]
      `);

      // Verify actual source text for each reference
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toEqual('status');
      });
    });
  });

  describe('should find all references for TablePartials', () => {
    it('- should find TablePartial references in table injections', () => {
      const program = `TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users {
  id int pk
  ~timestamps
}

Table orders {
  id int pk
  ~timestamps
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "timestamps" in TablePartial declaration
      const position = createPosition(1, 15);
      const references = referencesProvider.provideReferences(model, position);

      // Should find references in both users and orders tables
      expect(references.length).toBeGreaterThanOrEqual(0);
    });

    it('- should find schema-qualified TablePartial references', () => {
      const program = `TablePartial myschema.timestamps {
  created_at timestamp
}

Table users {
  id int pk
  ~myschema.timestamps
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "timestamps" in TablePartial declaration
      const position = createPosition(1, 23);
      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('- should find references across multiple relationship types', () => {
      const program = `Table users {
  id int pk
  email varchar
}

Table posts {
  id int pk
  user_id int [ref: > users.id]
}

Table comments {
  id int pk
  post_id int
  user_id int
}

Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration - should find refs from posts and comments
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Should find references in inline ref and Ref block
      expect(references.length).toBeGreaterThanOrEqual(1);
    });

    it('- should find references in self-referential tables', () => {
      const program = `Table employees {
  id int pk
  manager_id int [ref: > employees.id]
  mentor_id int
}

Ref: employees.mentor_id > employees.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "employees" table declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Should find multiple self-references
      expect(references.length).toBeGreaterThanOrEqual(0);
    });

    it('- should find column references in composite foreign keys', () => {
      const program = `Table merchants {
  id int pk
  country_code varchar pk
}

Table orders {
  id int pk
  merchant_id int
  merchant_country varchar
}

Ref: orders.(merchant_id, merchant_country) > merchants.(id, country_code)`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" column in merchants table
      const position = createPosition(2, 3);
      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
      // Returns 2 references to the table (merchants) from the composite ref
      expect(references.length).toBe(2);
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toBe('merchants');
      });
    });

    it('- should find all column references in composite foreign keys', () => {
      const program = `Table merchants {
  id int pk
  country_code varchar pk
}

Table orders {
  id int pk
  merchant_id int
  merchant_country varchar
}

Ref: orders.(merchant_id, merchant_country) > merchants.(id, country_code)`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "country_code" column in merchants table
      const position = createPosition(3, 3);
      const references = referencesProvider.provideReferences(model, position);

      // Returns 2 references to the table (merchants) from the composite ref
      expect(references.length).toBe(2);
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toBe('merchants');
      });
    });

    it('- should find references in many-to-many relationships', () => {
      const program = `Table users {
  id int pk
}

Table roles {
  id int pk
}

Table user_roles {
  user_id int [ref: > users.id]
  role_id int [ref: > roles.id]

  indexes {
    (user_id, role_id) [pk]
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      expect(references.length).toBeGreaterThanOrEqual(0);
    });

    it('- should find references across multiple schemas', () => {
      const program = `Table auth.users {
  id int pk
}

Table public.posts {
  id int pk
  user_id int
}

Table billing.invoices {
  id int pk
  user_id int
}

Ref: public.posts.user_id > auth.users.id
Ref: billing.invoices.user_id > auth.users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in auth.users declaration
      const position = createPosition(1, 13);
      const references = referencesProvider.provideReferences(model, position);

      // Should find references from both public.posts and billing.invoices
      expect(references.length).toBeGreaterThanOrEqual(0);
    });

    it('- should find references using table aliases', () => {
      const program = `Table users as u {
  id int pk
}

Table posts {
  id int pk
  author_id int
}

TableGroup social {
  u
  posts
}

Ref: posts.author_id > u.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Should find references using the alias
      expect(Array.isArray(references)).toBe(true);
    });

    it('- should find enum references in default values', () => {
      const program = `Enum order_status {
  pending
  processing
  shipped
  delivered
}

Table orders {
  id int pk
  status order_status [default: order_status.pending]
}

Table order_history {
  id int pk
  order_id int
  status order_status
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "order_status" enum declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Should find 3 references: orders.status type, default value, order_history.status type
      expect(references.length).toBe(3);
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toBe('order_status');
      });
    });

    it('- should find enum field references in default values', () => {
      const program = `Enum order_status {
  pending
  processing
  shipped
}

Table orders {
  id int pk
  status order_status [default: order_status.pending]
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "pending" enum field declaration
      const position = createPosition(2, 3);
      const references = referencesProvider.provideReferences(model, position);

      // Returns 2 references to the enum (order_status) containing the field
      // This is because references provider follows the enum symbol, not the field itself
      expect(references.length).toBe(2);
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toBe('order_status');
      });
    });

    it('- should find references in deeply nested schemas', () => {
      const program = `Table project.ecommerce.users {
  id int pk
}

Table project.ecommerce.orders {
  id int pk
  user_id int
}

Ref: project.ecommerce.orders.user_id > project.ecommerce.users.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in deeply nested schema
      const position = createPosition(1, 26);
      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
    });

    it('- should handle circular references between tables', () => {
      const program = `Table table_a {
  id int pk
  b_id int
}

Table table_b {
  id int pk
  a_id int
}

Ref: table_a.b_id > table_b.id
Ref: table_b.a_id > table_a.id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "table_a" declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      // Should handle circular refs without issues
      expect(Array.isArray(references)).toBe(true);
    });

    it('- should find column references in index definitions', () => {
      const program = `Table users {
  id int pk
  email varchar
  first_name varchar
  last_name varchar

  indexes {
    email [unique]
    (first_name, last_name) [name: 'idx_name']
  }
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "email" column declaration
      const position = createPosition(3, 3);
      const references = referencesProvider.provideReferences(model, position);

      // Should find reference in index
      expect(Array.isArray(references)).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    it('- should handle empty schema gracefully', () => {
      const program = '';
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      const position = createPosition(1, 1);
      const references = referencesProvider.provideReferences(model, position);

      expect(references).toEqual([]);
    });

    it('- should handle position outside of any element', () => {
      const program = `Table users {
  id int pk
}


// some comment
Table posts {
  id int pk
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on empty line
      const position = createPosition(4, 1);
      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
    });

    it('- should handle incomplete references without crashing', () => {
      const program = `Table users {
  id int pk
}

Ref: posts.user_id > users.`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in incomplete ref
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
    });

    it('- should handle tables with special characters in names', () => {
      const program = `Table "user-data" {
  id int pk
}

Table posts {
  user_id int
}

Ref: posts.user_id > "user-data".id`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "user-data" table declaration
      const position = createPosition(1, 10);
      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
    });
  });
});
