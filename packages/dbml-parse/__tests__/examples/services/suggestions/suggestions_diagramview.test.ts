import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '@tests/utils';

describe('[DiagramView] CompletionItemProvider', () => {
  describe('top-level suggestions should include DiagramView', () => {
    it('suggests DiagramView at top level', () => {
      const program = '';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(1, 1);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('DiagramView');
    });
  });

  describe('inside DiagramView body', () => {
    it('suggests sub-block keywords (Tables, TableGroups, Notes, Schemas) and wildcard', () => {
      const program = 'DiagramView my_view {\n  \n}';
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(2, 3);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('Tables');
      expect(labels).toContain('TableGroups');
      expect(labels).toContain('Notes');
      expect(labels).toContain('Schemas');
      expect(labels).toContain('*');
    });
  });

  describe('inside DiagramView Tables sub-block', () => {
    it('suggests table names and wildcard', () => {
      const program = [
        'Table users {',
        '  id int',
        '}',
        'Table posts {',
        '  id int',
        '}',
        'DiagramView my_view {',
        '  Tables {',
        '    ',
        '  }',
        '}',
      ].join('\n');
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 5);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('users');
      expect(labels).toContain('posts');
      expect(labels).toContain('*');
    });
  });

  describe('inside DiagramView TableGroups sub-block', () => {
    it('suggests table group names and wildcard', () => {
      const program = [
        'Table users {',
        '  id int',
        '}',
        'TableGroup auth_tables {',
        '  users',
        '}',
        'DiagramView my_view {',
        '  TableGroups {',
        '    ',
        '  }',
        '}',
      ].join('\n');
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 5);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('auth_tables');
      expect(labels).toContain('*');
    });
  });

  describe('inside DiagramView Schemas sub-block', () => {
    it('suggests schema names and wildcard', () => {
      const program = [
        'Table public.users {',
        '  id int',
        '}',
        'DiagramView my_view {',
        '  Schemas {',
        '    ',
        '  }',
        '}',
      ].join('\n');
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(6, 5);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('*');
      expect(labels).toContain('public');
    });
  });

  describe('inside DiagramView Notes sub-block', () => {
    it('suggests wildcard', () => {
      const program = [
        'DiagramView my_view {',
        '  Notes {',
        '    ',
        '  }',
        '}',
      ].join('\n');
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(3, 5);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('*');
    });
  });
});
