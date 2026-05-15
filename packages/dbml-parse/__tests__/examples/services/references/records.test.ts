import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLReferencesProvider from '@/services/references/provider';
import { createPosition, createMockTextModel, extractTextFromRange } from '../../../utils';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

describe('[example] ReferencesProvider - Records', () => {
  describe('should find all table references from records', () => {
    it('- should find table references in records declarations', () => {
      const program = `Table users {
  id int
  name varchar
}

records users(id, name) {
  1, "Alice"
}

records users(id, name) {
  2, "Bob"
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration
      const position = createPosition(1, 7);
      const references = referencesProvider.provideReferences(model, position);

      expect(references.length).toBe(2);
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toBe('users');
      });
    });

    it('- should find schema-qualified table references', () => {
      const program = `Table auth.users {
  id int
  email varchar
}

records auth.users(id, email) {
  1, "alice@example.com"
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "users" table declaration
      const position = createPosition(1, 12);
      const references = referencesProvider.provideReferences(model, position);

      expect(references.length).toBe(1);
      const sourceText = extractTextFromRange(program, references[0].range);
      expect(sourceText).toBe('users');
    });

    it('- should find schema-qualified table references in records call expression', () => {
      const program = `Table public.orders {
  id int
  total decimal
}

records public.orders(id, total) {
  1, 99.99
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "orders" in "Table public.orders" declaration
      const position = createPosition(1, 18);
      const references = referencesProvider.provideReferences(model, position);

      // Should find the reference in "records public.orders(...)"
      expect(references.length).toBe(1);
      const sourceText = extractTextFromRange(program, references[0].range);
      expect(sourceText).toBe('orders');
    });
  });

  describe('should find all column references from records', () => {
    it('- should find column references in records column list', () => {
      const program = `Table users {
  id int
  name varchar
}

records users(id, name) {
  1, "Alice"
}

records users(id, name) {
  2, "Bob"
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "id" column declaration
      const position = createPosition(2, 4);
      const references = referencesProvider.provideReferences(model, position);

      expect(references.length).toBe(2);
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toBe('id');
      });
    });

    it('- should find multiple references for same column', () => {
      const program = `Table users {
  id int
  name varchar
}

records users(id, name) {
  1, "Alice"
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "name" column declaration
      const position = createPosition(3, 4);
      const references = referencesProvider.provideReferences(model, position);

      expect(references.length).toBe(1);
      const sourceText = extractTextFromRange(program, references[0].range);
      expect(sourceText).toBe('name');
    });
  });

  describe('should find all enum references from records', () => {
    it('- should find enum references in records data', () => {
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
  2, status.inactive
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "status" enum declaration
      const position = createPosition(1, 6);
      const references = referencesProvider.provideReferences(model, position);

      // Enum should be referenced in: column type + 2 data rows
      expect(references.length).toBe(3);
    });

    it('- should find schema-qualified enum references', () => {
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
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "role" enum declaration
      const position = createPosition(1, 11);
      const references = referencesProvider.provideReferences(model, position);

      // Enum should be referenced in: column type + 1 data row
      expect(references.length).toBe(2);
    });
  });

  describe('should find all enum field references from records', () => {
    it('- should find enum field references in records data', () => {
      const program = `Enum status {
  pending
  active
  completed
}

Table tasks {
  id int
  status status
}

records tasks(id, status) {
  1, status.pending
  2, status.active
  3, status.completed
  4, status.pending
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "pending" enum field declaration
      const position = createPosition(2, 4);
      const references = referencesProvider.provideReferences(model, position);

      // "pending" is referenced twice in records
      expect(references.length).toBe(2);
      references.forEach((ref) => {
        const sourceText = extractTextFromRange(program, ref.range);
        expect(sourceText).toBe('pending');
      });
    });

    it('- should find single enum field reference', () => {
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
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "active" enum field declaration
      const position = createPosition(2, 4);
      const references = referencesProvider.provideReferences(model, position);

      expect(references.length).toBe(1);
      const sourceText = extractTextFromRange(program, references[0].range);
      expect(sourceText).toBe('active');
    });

    it('- should find schema-qualified enum field references', () => {
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
  2, auth.role.user
}`;
      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(program);

      // Position on "admin" enum field declaration
      const position = createPosition(2, 4);
      const references = referencesProvider.provideReferences(model, position);

      expect(references.length).toBe(1);
      const sourceText = extractTextFromRange(program, references[0].range);
      expect(sourceText).toBe('admin');
    });
  });
});
