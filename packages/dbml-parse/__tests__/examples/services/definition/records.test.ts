import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import { createMockTextModel, createPosition, extractTextFromRange } from '../../../utils';

describe('[example - records] DefinitionProvider - Records', () => {
  describe('should find table definition from records', () => {
    it('- should find table definition from records table name', () => {
      const program = `Table users {
  id int
  name varchar
}

records users(id, name) {
  1, "Alice"
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in "records users(id, name)"
      const position = createPosition(6, 10);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

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

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table users {
          id int
          name varchar
        }"
      `);
    });

    it('- should find table definition from schema-qualified records', () => {
      const program = `Table auth.users {
  id int
  email varchar
}

records auth.users(id, email) {
  1, "alice@example.com"
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in "records auth.users"
      const position = createPosition(6, 15);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

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

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table auth.users {
          id int
          email varchar
        }"
      `);
    });

    it('- should find table definition from schema-qualified table name in records call expression', () => {
      const program = `Table auth.users {
  id int
  email varchar
}

Table users {
  id int
  name varchar
}

records auth.users(id, email) {
  1, "alice@example.com"
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" in the call expression "auth.users(id, email)"
      const position = createPosition(11, 15);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

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

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Table auth.users {
          id int
          email varchar
        }"
      `);
    });
  });

  describe('should find column definition from records', () => {
    it('- should find column definition from records column list', () => {
      const program = `Table users {
  id int
  name varchar
}

records users(id, name) {
  1, "Alice"
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" in "records users(id, name)"
      const position = createPosition(6, 16);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 9,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toBe('id int');
    });

    it('- should find column definition from second column in list', () => {
      const program = `Table users {
  id int
  name varchar
}

records users(id, name) {
  1, "Alice"
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "name" in "records users(id, name)"
      const position = createPosition(6, 20);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 15,
              "endLineNumber": 3,
              "startColumn": 3,
              "startLineNumber": 3,
            },
            "uri": "",
          },
        ]
      `);

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toBe('name varchar');
    });
  });

  describe('should find enum definition from records data', () => {
    it('- should find enum definition from records enum reference', () => {
      const program = `Enum status {
  active
  inactive
}

Table users {
  id int
  status status
}

records users(id, status) {
  1, status.active
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" in "status.active"
      const position = createPosition(12, 7);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

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

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toMatchInlineSnapshot(`
        "Enum status {
          active
          inactive
        }"
      `);
    });

    it('- should find enum field definition from records data', () => {
      const program = `Enum status {
  active
  inactive
}

Table users {
  id int
  status status
}

records users(id, status) {
  1, status.active
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "active" in "status.active"
      const position = createPosition(12, 14);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 9,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toBe('active');
    });

    it('- should find schema-qualified enum field definition', () => {
      const program = `Enum auth.role {
  admin
  user
}

Table auth.users {
  id int
  role auth.role
}

records auth.users(id, role) {
  1, auth.role.admin
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "admin" in "auth.role.admin"
      const position = createPosition(12, 20);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBeTruthy();
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBe(1);

      expect(definitions).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "endColumn": 8,
              "endLineNumber": 2,
              "startColumn": 3,
              "startLineNumber": 2,
            },
            "uri": "",
          },
        ]
      `);

      const sourceText = extractTextFromRange(program, definitions[0].range);
      expect(sourceText).toBe('admin');
    });
  });
});
