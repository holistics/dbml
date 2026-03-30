import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { Filepath, MemoryProjectLayout } from '@/compiler/projectLayout';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createPosition, createMockTextModel } from '../../utils';

function createCompiler (files: Record<string, string>): Compiler {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[Filepath.from(path).absolute] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries));
}

describe('[example] cross-file services', () => {
  describe('DefinitionProvider', () => {
    test('should navigate to imported table definition in another file', () => {
      const mainContent = "use { table users } from './common.dbml'\nTable orders {\n  id int\n  user_id int\n}\nRef: orders.user_id > users.id";
      const commonContent = 'Table users {\n  id int [pk]\n  name varchar\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/common.dbml': commonContent,
      });

      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position on "users" in "Ref: orders.user_id > users.id" (line 6)
      const position = createPosition(6, 24);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].uri.path).toBe('/common.dbml');
    });

    test('should navigate to local definition within same file', () => {
      const mainContent = 'Table users {\n  id int [pk]\n}\nTable orders {\n  user_id int\n}\nRef: orders.user_id > users.id';

      const compiler = createCompiler({ '/main.dbml': mainContent });
      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(7, 24);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].uri.path).toBe('/main.dbml');
    });

    test('should navigate to imported enum definition', () => {
      const mainContent = "use { enum status } from './enums.dbml'\nTable users {\n  id int\n  status status\n}";
      const enumsContent = 'Enum status {\n  active\n  inactive\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/enums.dbml': enumsContent,
      });

      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(4, 12);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].uri.path).toBe('/enums.dbml');
    });

    test('should return empty for non-reference positions', () => {
      const mainContent = "use { table users } from './common.dbml'\nTable orders {\n  id int\n}";

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/common.dbml': 'Table users { id int }',
      });

      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(3, 6);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (Array.isArray(definitions)) {
        expect(definitions).toHaveLength(0);
      }
    });

    test('should navigate to imported column definition', () => {
      const mainContent = "use { table users } from './common.dbml'\nTable orders {\n  user_id int\n}\nRef: orders.user_id > users.id";
      const commonContent = 'Table users {\n  id int [pk]\n  name varchar\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/common.dbml': commonContent,
      });

      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position on "id" in "users.id" (line 5, after the dot)
      const position = createPosition(5, 31);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].uri.path).toBe('/common.dbml');
    });

    test('should handle missing dependency gracefully', () => {
      const mainContent = "use { table users } from './missing.dbml'\nTable orders {\n  id int\n}";

      const compiler = createCompiler({ '/main.dbml': mainContent });
      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(3, 4);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
    });

    test('should navigate to tablepartial definition in another file', () => {
      const mainContent = "use { tablepartial timestamps } from './partials.dbml'\nTable users {\n  id int\n  ~timestamps\n}";
      const partialsContent = 'TablePartial timestamps {\n  created_at timestamp\n  updated_at timestamp\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/partials.dbml': partialsContent,
      });

      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position on "timestamps" in "~timestamps" (line 4)
      const position = createPosition(4, 5);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].uri.path).toBe('/partials.dbml');
    });

    test('should work with whole-file import', () => {
      const mainContent = "use * from './common.dbml'\nTable orders {\n  user_id int\n}\nRef: orders.user_id > users.id";
      const commonContent = 'Table users {\n  id int [pk]\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/common.dbml': commonContent,
      });

      const provider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position on "users" in Ref
      const position = createPosition(5, 24);
      const definitions = provider.provideDefinition(model, position);

      expect(Array.isArray(definitions)).toBe(true);
      if (!Array.isArray(definitions)) return;
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].uri.path).toBe('/common.dbml');
    });
  });

  describe('ReferencesProvider', () => {
    test('should find references for table declaration', () => {
      const mainContent = 'Table users {\n  id int [pk]\n}\nTable orders {\n  user_id int\n}\nRef: orders.user_id > users.id';

      const compiler = createCompiler({ '/main.dbml': mainContent });
      const provider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position on "users" table declaration
      const position = createPosition(1, 7);
      const references = provider.provideReferences(model, position);

      expect(references.length).toBeGreaterThan(0);
    });

    test('should return empty for positions without symbols', () => {
      const mainContent = 'Table users {\n  id int\n}';

      const compiler = createCompiler({ '/main.dbml': mainContent });
      const provider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position on "int" keyword
      const position = createPosition(2, 6);
      const references = provider.provideReferences(model, position);

      expect(references).toHaveLength(0);
    });

    test('should handle file with parse errors', () => {
      const mainContent = 'Table users {\n  id int [pk\n}';

      const compiler = createCompiler({ '/main.dbml': mainContent });
      const provider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(1, 7);
      const references = provider.provideReferences(model, position);

      // Should not crash
      expect(Array.isArray(references)).toBe(true);
    });
  });

  describe('CompletionItemProvider', () => {
    test('should suggest imported table names in ref context', () => {
      const mainContent = "use { table users } from './common.dbml'\nTable orders {\n  id int\n  user_id int [ref: > ]\n}";
      const commonContent = 'Table users {\n  id int [pk]\n  name varchar\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/common.dbml': commonContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(4, 23);
      const result = provider.provideCompletionItems(model, position);

      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('users');
    });

    test('should suggest cross-file symbols with auto-import in ref', () => {
      const mainContent = 'Table orders {\n  id int\n  user_id int\n}\nRef: orders.user_id > ';
      const commonContent = 'Table users {\n  id int [pk]\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/common.dbml': commonContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position after "> " in Ref
      const position = createPosition(5, 24);
      const result = provider.provideCompletionItems(model, position);

      const autoImport = result.suggestions.find(
        (s) => s.label === 'users' && s.detail?.includes('auto-import'),
      );

      expect(autoImport).toBeDefined();
      expect(autoImport!.additionalTextEdits).toBeDefined();
      expect(autoImport!.additionalTextEdits!.length).toBe(1);
      expect(autoImport!.additionalTextEdits![0].text).toContain('use');
      expect(autoImport!.additionalTextEdits![0].text).toContain('table users');
      expect(autoImport!.additionalTextEdits![0].text).toContain('common.dbml');
    });

    test('should not auto-import already imported symbols', () => {
      const mainContent = "use { table users } from './common.dbml'\nTable orders {\n  id int\n  user_id int\n}\nRef: orders.user_id > ";
      const commonContent = 'Table users {\n  id int [pk]\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/common.dbml': commonContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(6, 24);
      const result = provider.provideCompletionItems(model, position);

      const autoImports = result.suggestions.filter(
        (s) => s.label === 'users' && s.detail?.includes('auto-import'),
      );
      expect(autoImports).toHaveLength(0);

      const regularUsers = result.suggestions.filter((s) => s.label === 'users');
      expect(regularUsers.length).toBeGreaterThan(0);
    });

    test('should not auto-import symbols from current file', () => {
      const mainContent = 'Table users {\n  id int\n}\nTable orders {\n  id int\n  user_id int\n}\nRef: orders.user_id > ';

      const compiler = createCompiler({ '/main.dbml': mainContent });
      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(8, 24);
      const result = provider.provideCompletionItems(model, position);

      const autoImports = result.suggestions.filter((s) => s.detail?.includes('auto-import'));
      expect(autoImports).toHaveLength(0);
    });

    test('should auto-import enums in column type context', () => {
      const mainContent = 'Table users {\n  id int\n  status \n}';
      const enumContent = 'Enum user_status {\n  active\n  inactive\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/enums.dbml': enumContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(3, 10);
      const result = provider.provideCompletionItems(model, position);

      const autoImport = result.suggestions.find(
        (s) => s.label === 'user_status' && s.detail?.includes('auto-import'),
      );
      expect(autoImport).toBeDefined();
      expect(autoImport!.additionalTextEdits![0].text).toContain('enum user_status');
    });

    test('should insert use statement after existing use declarations', () => {
      const mainContent = "use { table orders } from './orders.dbml'\nTable main_table {\n  id int\n  user_id int\n}\nRef: main_table.user_id > ";
      const ordersContent = 'Table orders { id int }';
      const usersContent = 'Table users {\n  id int [pk]\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/orders.dbml': ordersContent,
        '/users.dbml': usersContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(6, 29);
      const result = provider.provideCompletionItems(model, position);

      const autoImport = result.suggestions.find(
        (s) => s.label === 'users' && s.detail?.includes('auto-import'),
      );

      expect(autoImport).toBeDefined();
      const edit = autoImport!.additionalTextEdits![0];
      // Should insert after the existing use statement (line 1)
      expect(edit.range.startLineNumber).toBe(1);
    });

    test('should auto-import tablepartials in table body', () => {
      const mainContent = 'Table users {\n  id int\n  ~\n}';
      const partialsContent = 'TablePartial timestamps {\n  created_at timestamp\n  updated_at timestamp\n}';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/partials.dbml': partialsContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      // Position after "~" (tilde operator)
      const position = createPosition(3, 4);
      const result = provider.provideCompletionItems(model, position);

      const autoImport = result.suggestions.find(
        (s) => s.label === 'timestamps' && s.detail?.includes('auto-import'),
      );
      expect(autoImport).toBeDefined();
      expect(autoImport!.additionalTextEdits![0].text).toContain('tablepartial timestamps');
    });

    test('should work with filepath from model uri in subdirectory', () => {
      const subContent = "use { table shared } from '../shared.dbml'\nTable local { id int }";
      const sharedContent = 'Table shared {\n  id int\n}';

      const compiler = createCompiler({
        '/sub/main.dbml': subContent,
        '/shared.dbml': sharedContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(subContent, Filepath.from('/sub/main.dbml'));

      const position = createPosition(2, 14);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions).toBeDefined();
    });

    test('should not crash on empty project', () => {
      const mainContent = '';

      const compiler = createCompiler({ '/main.dbml': mainContent });
      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(1, 1);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions).toBeDefined();
    });

    test('should not crash when dependency has errors', () => {
      const mainContent = "use { table users } from './bad.dbml'\nTable orders {\n  id int\n  user_id int\n}\nRef: orders.user_id > ";
      const badContent = 'Table users { id int [pk';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/bad.dbml': badContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(6, 24);
      const result = provider.provideCompletionItems(model, position);

      expect(result.suggestions).toBeDefined();
    });

    test('should auto-import from multiple files', () => {
      const mainContent = 'Table main_t {\n  id int\n  user_id int\n}\nRef: main_t.user_id > ';
      const usersContent = 'Table users { id int [pk] }';
      const productsContent = 'Table products { id int [pk] }';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/users.dbml': usersContent,
        '/products.dbml': productsContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(5, 24);
      const result = provider.provideCompletionItems(model, position);

      const autoImportUsers = result.suggestions.find(
        (s) => s.label === 'users' && s.detail?.includes('auto-import'),
      );
      const autoImportProducts = result.suggestions.find(
        (s) => s.label === 'products' && s.detail?.includes('auto-import'),
      );
      expect(autoImportUsers).toBeDefined();
      expect(autoImportProducts).toBeDefined();
      expect(autoImportUsers!.additionalTextEdits![0].text).toContain('users.dbml');
      expect(autoImportProducts!.additionalTextEdits![0].text).toContain('products.dbml');
    });

    test('should sort auto-import suggestions after local ones', () => {
      const mainContent = 'Table local_table {\n  id int\n  fk int\n}\nRef: local_table.fk > ';
      const externalContent = 'Table external_table { id int [pk] }';

      const compiler = createCompiler({
        '/main.dbml': mainContent,
        '/ext.dbml': externalContent,
      });

      const provider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(mainContent);

      const position = createPosition(5, 24);
      const result = provider.provideCompletionItems(model, position);

      const localIdx = result.suggestions.findIndex((s) => s.label === 'local_table');
      const autoIdx = result.suggestions.findIndex(
        (s) => s.label === 'external_table' && s.detail?.includes('auto-import'),
      );

      expect(localIdx).toBeGreaterThanOrEqual(0);
      expect(autoIdx).toBeGreaterThanOrEqual(0);
      expect(localIdx).toBeLessThan(autoIdx);
    });
  });
});
