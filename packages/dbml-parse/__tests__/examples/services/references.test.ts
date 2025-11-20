import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLReferencesProvider from '@/services/references/provider';
import { createPosition, createMockTextModel, extractTextFromRange } from '../../mocks';

describe('ReferencesProvider', () => {
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
});
