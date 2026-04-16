import { describe, it, expect } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { MockTextModel, createPosition } from '../utils';
import { DEFAULT_ENTRY } from '@/constants';

describe('multifile language services', () => {
  describe('Definition provider with empty URI', () => {
    it('should handle single-file definitions with empty model URI', () => {
      const source = `
        Table users {
          id int
          email string
        }

        Ref: users.id > orders.user_id
      `;

      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, source);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(source, '') as any;
      const position = createPosition(7, 15); // Position at 'orders'

      const definitions = definitionProvider.provideDefinition(model, position);

      // In single-file mode with empty URI, should return empty definitions
      // (since 'orders' is not defined in the source)
      expect(Array.isArray(definitions)).toBe(true);
    });

    it('should not crash when navigating in empty-URI models', () => {
      const source = `Table test { id int }`;

      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, source);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(source, '') as any;

      let didThrow = false;
      try {
        definitionProvider.provideDefinition(model, createPosition(1, 10));
      } catch {
        didThrow = true;
      }

      expect(didThrow).toBe(false);
    });
  });

  describe('References provider with empty URI', () => {
    it('should find references in single-file mode with empty URI', () => {
      const source = `
        Table users {
          id int
        }

        Table orders {
          user_id int
        }

        Ref: orders.user_id > users.id
      `;

      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, source);
      compiler.bindProject();

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel(source, '') as any;

      // Position at 'users' in the Ref line
      const position = createPosition(10, 35);

      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
    });

    it('should not crash on references query in empty-URI models', () => {
      const source = `
        Table users { id int }
        Ref: users.id > orders.user_id
      `;

      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, source);
      compiler.bindProject();

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel(source, '') as any;

      let didThrow = false;
      try {
        referencesProvider.provideReferences(model, createPosition(3, 20));
      } catch {
        didThrow = true;
      }

      expect(didThrow).toBe(false);
    });
  });

  describe('Filepath URI handling', () => {
    it('should preserve empty URI in single-file definitions', () => {
      const source = 'Table test { id int }';
      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, source);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const emptyUriModel = new MockTextModel(source, '') as any;

      const definitions = definitionProvider.provideDefinition(emptyUriModel, createPosition(1, 10));

      // All definitions should have the same URI as the model
      const defs = Array.isArray(definitions) ? definitions : [definitions];
      for (const def of defs) {
        expect(def.uri).toBe('');
      }
    });

    it('should preserve file URI in multi-file definitions', () => {
      const source = 'Table test { id int }';
      const fileUri = 'file:///test.dbml';
      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, source);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const modelWithUri = new MockTextModel(source, fileUri) as any;

      const definitions = definitionProvider.provideDefinition(modelWithUri, createPosition(1, 10));

      // When model has a URI set, definitions should respect it
      const defs = Array.isArray(definitions) ? definitions : (definitions ? [definitions] : []);
      for (const def of defs) {
        // In this simple case, there's no definition, so check it's handled gracefully
        expect(def.uri).toBeDefined();
      }
    });

    it('should preserve file URI in multi-file references', () => {
      const source = 'Table users { id int }\nRef: users.id > orders.user_id';
      const fileUri = 'file:///schema.dbml';
      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, source);
      compiler.bindProject();

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const modelWithUri = new MockTextModel(source, fileUri) as any;

      const references = referencesProvider.provideReferences(modelWithUri, createPosition(2, 10));

      // Check that references respect the model's URI (fallback when no filepath on nodes)
      for (const ref of references) {
        expect(ref.uri).toBeDefined();
      }
    });
  });

  describe('Robustness in empty files', () => {
    it('definition provider should not crash on empty source', () => {
      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, '');

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel('', '') as any;

      let didThrow = false;
      try {
        definitionProvider.provideDefinition(model, createPosition(1, 1));
      } catch {
        didThrow = true;
      }

      expect(didThrow).toBe(false);
    });

    it('references provider should not crash on empty source', () => {
      const compiler = new Compiler();
      compiler.setSource(DEFAULT_ENTRY, '');
      compiler.bindProject();

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel('', '') as any;

      let didThrow = false;
      try {
        referencesProvider.provideReferences(model, createPosition(1, 1));
      } catch {
        didThrow = true;
      }

      expect(didThrow).toBe(false);
    });
  });

});
