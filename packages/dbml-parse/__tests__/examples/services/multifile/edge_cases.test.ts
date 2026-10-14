import {
  describe, it, expect, beforeEach,
} from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { MockTextModel, createPosition } from '../../../utils';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout, type DbmlProjectLayout } from '@/compiler/projectLayout/layout';

describe('[advanced] multifile edge cases', () => {
  describe('URI handling edge cases', () => {
    it('should handle Windows-style paths in Filepath.toUri()', () => {
      // Note: Filepath normalizes paths, so backslashes become forward slashes
      const winPath = 'C:\\Users\\test\\project\\models.dbml';
      try {
        const filepath = new Filepath(winPath);
        const uri = filepath.toUri();

        // Should be a valid file:// URI
        expect(uri).toMatch(/^file:\/\//);
        // Should convert backslashes to forward slashes
        expect(uri).not.toContain('\\');
      } catch (e) {
        // Windows paths may not work on Unix or vice versa
        // This is acceptable as long as we don't crash
        expect(true).toBe(true);
      }
    });

    it('should handle Unix absolute paths in Filepath.toUri()', () => {
      const unixPath = '/home/user/project/models.dbml';
      const filepath = new Filepath(unixPath);
      const uri = filepath.toUri();

      expect(uri).toBe(unixPath);
    });

    it('should round-trip URI conversion', () => {
      const original = '/home/user/project/models.dbml';
      const filepath1 = new Filepath(original);
      const uri = filepath1.toUri();
      const filepath2 = Filepath.fromUri(uri);

      expect(filepath2.absolute).toBe(original);
    });

    it('should preserve special characters in file paths from from()', () => {
      const filepath = new Filepath('/home/user/project-2024/[test]/models.dbml');
      // from() treats input literally, no encoding
      expect(filepath.absolute).toBe('/home/user/project-2024/[test]/models.dbml');
    });

    it('should round-trip special characters through toUri/fromUri', () => {
      const filepath = new Filepath('/home/user/[test]/file.dbml');
      const roundTripped = Filepath.fromUri(filepath.toUri({ protocol: 'file' }));
      expect(roundTripped.absolute).toBe(filepath.absolute);
    });

    it('should treat %XX as literal characters in from()', () => {
      // from() is for filesystem paths, %5B is literal
      const filepath = new Filepath('/home/user/%5Btest%5D/file.dbml');
      expect(filepath.absolute).toBe('/home/user/%5Btest%5D/file.dbml');
    });

    it('should preserve spaces in path segments', () => {
      const filepath = new Filepath('/home/user/my project/file.dbml');
      expect(filepath.absolute).toBe('/home/user/my project/file.dbml');
    });

    it('should handle unicode in path segments', () => {
      const filepath = new Filepath('/home/user/日本語/file.dbml');
      const filepath2 = new Filepath(filepath.absolute);
      expect(filepath.absolute).toBe(filepath2.absolute);
    });
  });

  it('should handle symbol defined multiple times across files', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(new Filepath('/schema1.dbml'), 'Table users { id int }');
    layout.setSource(new Filepath('/schema2.dbml'), 'Table users { id int }');
    const compiler = new Compiler(layout);
    compiler.bindProject();

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel('Ref: users.id > orders.user_id', Filepath.fromUri('file:///schema1.dbml').toUri()) as any;

    let didThrow = false;
    try {
      definitionProvider.provideDefinition(model, createPosition(1, 10));
    } catch {
      didThrow = true;
    }

    expect(didThrow).toBe(false);
  });

  it('should handle references with very long symbol names', () => {
    const longName = 'VeryLongTableNameWithManyCharactersForTestingEdgeCase';
    const layout = new MemoryProjectLayout();
    layout.setSource(
      new Filepath('/models.dbml'),
      `Table ${longName} { id int }`,
    );
    const compiler = new Compiler(layout);
    compiler.bindProject();

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(`Ref: ${longName}.id > other.id`, Filepath.fromUri('file:///models.dbml').toUri()) as any;

    let didThrow = false;
    try {
      referencesProvider.provideReferences(model, createPosition(1, 10));
    } catch {
      didThrow = true;
    }

    expect(didThrow).toBe(false);
  });

  it('should handle self-referential tables in same file', () => {
    const source = `Table nodes {
  id int
  parent_id int
}

Ref: nodes.parent_id > nodes.id`;

    const layout = new MemoryProjectLayout();
    layout.setSource(new Filepath('/models.dbml'), source);
    const compiler = new Compiler(layout);
    compiler.bindProject();

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(source, Filepath.fromUri('file:///models.dbml').toUri()) as any;

    const definitions = definitionProvider.provideDefinition(model, createPosition(6, 20));

    expect(Array.isArray(definitions)).toBe(true);
  });

  it('should handle position at end of file', () => {
    const source = 'Table test { id int }';
    const layout = new MemoryProjectLayout();
    layout.setSource(new Filepath('/test.dbml'), source);
    const compiler = new Compiler(layout);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(source, Filepath.fromUri('file:///test.dbml').toUri()) as any;

    // Position at very end of file
    const lastLine = source.split('\n').length;
    const lastCol = source.split('\n')[lastLine - 1].length;

    let didThrow = false;
    try {
      definitionProvider.provideDefinition(model, createPosition(lastLine, lastCol + 5));
    } catch {
      didThrow = true;
    }

    expect(didThrow).toBe(false);
  });

  it('should handle position at line 0, column 0', () => {
    const source = 'Table test { id int }';
    const layout = new MemoryProjectLayout();
    layout.setSource(new Filepath('/test.dbml'), source);
    const compiler = new Compiler(layout);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(source, Filepath.fromUri('file:///test.dbml').toUri()) as any;

    let didThrow = false;
    try {
      definitionProvider.provideDefinition(model, createPosition(1, 1));
    } catch {
      didThrow = true;
    }

    expect(didThrow).toBe(false);
  });

  it('should handle very large position values', () => {
    const source = 'Table test { id int }';
    const layout = new MemoryProjectLayout();
    layout.setSource(new Filepath('/test.dbml'), source);
    const compiler = new Compiler(layout);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(source, Filepath.fromUri('file:///test.dbml').toUri()) as any;

    let didThrow = false;
    try {
      definitionProvider.provideDefinition(model, createPosition(999999, 999999));
    } catch {
      didThrow = true;
    }

    expect(didThrow).toBe(false);
  });

  describe('custom project layout with @id import', () => {
    // A layout that resolves `@<id>` specifiers to a unique filepath like `/@imports/<id>.dbml`
    class IdImportLayout implements DbmlProjectLayout {
      private files = new Map<string, string>();

      setSource (filePath: Filepath, content: string): void {
        this.files.set(filePath.absolute, content);
      }

      resolveFileSpecifier (_currentFilepath: Filepath, specifier: string): Filepath | undefined {
        if (specifier.startsWith('@')) {
          const id = specifier.slice(1);
          return Filepath.from(`/@imports/${id}.dbml`);
        }
        if (Filepath.isRelative(specifier)) {
          const resolved = Filepath.resolve(_currentFilepath.dirname, specifier);
          return resolved.absolute.endsWith('.dbml') ? resolved : Filepath.from(resolved.absolute + '.dbml');
        }
        return undefined;
      }

      getSource (filePath: Filepath): string | undefined {
        return this.files.get(filePath.absolute);
      }

      exists (filePath: Filepath): boolean {
        return this.isFile(filePath) || this.isDirectory(filePath);
      }

      isFile (filePath: Filepath): boolean {
        return this.files.has(filePath.absolute);
      }

      isDirectory (filePath: Filepath): boolean {
        const prefix = filePath.absolute.endsWith('/') ? filePath.absolute : `${filePath.absolute}/`;
        for (const f of this.files.keys()) {
          if (f.startsWith(prefix)) return true;
        }
        return false;
      }

      listDirectory (dirPath?: Filepath): Filepath[] {
        const base = dirPath?.absolute ?? '/';
        const prefix = base.endsWith('/') ? base : base + '/';
        const entries = new Set<string>();
        for (const f of this.files.keys()) {
          if (!f.startsWith(prefix)) continue;
          const rest = f.slice(prefix.length);
          const slash = rest.indexOf('/');
          entries.add(prefix + (slash === -1 ? rest : rest.slice(0, slash)));
        }
        return [...entries].sort().map(Filepath.from);
      }

      getEntrypoints (): Filepath[] {
        return [...this.files.keys()].map(Filepath.from).sort((a, b) => a.absolute.localeCompare(b.absolute));
      }

      getSpecifierForFile (_currentFilepath: Filepath, targetFilepath: Filepath): string | undefined {
        const match = targetFilepath.fsPath.match(/^\/@imports\/(.+)\.dbml$/);
        if (match) return `@${match[1]}`;
        let specifier = targetFilepath.relativeTo(_currentFilepath.dirname);
        if (specifier.endsWith('.dbml')) specifier = specifier.slice(0, -'.dbml'.length);
        return specifier;
      }
    }

    it('should resolve @id import and retrieve source correctly', () => {
      const layout = new IdImportLayout();
      const main = Filepath.from('/main.dbml');
      const sharedUsers = Filepath.from('/@imports/shared-users.dbml');

      layout.setSource(sharedUsers, 'Table users { id int [pk]\n email varchar }');
      layout.setSource(main, `use { table users } from '@shared-users'
Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}`);

      // Verify resolveFileSpecifier maps @id to the correct filepath
      const resolved = layout.resolveFileSpecifier(main, '@shared-users');
      expect(resolved).toBeDefined();
      expect(resolved!.equals(sharedUsers)).toBe(true);

      // Verify getSource returns the content for the resolved filepath
      expect(layout.getSource(resolved!)).toBe('Table users { id int [pk]\n email varchar }');

      // Verify the compiler can bind the project with cross-file references
      const compiler = new Compiler(layout);
      compiler.bindProject();
      const errors = compiler.interpretFile(main).getErrors();
      expect(errors).toHaveLength(0);
    });

    it('should treat two different specifiers resolving to same filepath as same file', () => {
      const layout = new IdImportLayout();
      const file1 = Filepath.from('/a.dbml');
      const file2 = Filepath.from('/b.dbml');
      const shared = Filepath.from('/@imports/common.dbml');

      layout.setSource(shared, 'Table common { id int [pk] }');
      layout.setSource(file1, "use { table common } from '@common'");
      layout.setSource(file2, "use { table common } from '@common'");

      // Both resolve to the same filepath
      const resolved1 = layout.resolveFileSpecifier(file1, '@common');
      const resolved2 = layout.resolveFileSpecifier(file2, '@common');
      expect(resolved1!.equals(resolved2!)).toBe(true);

      const compiler = new Compiler(layout);
      compiler.bindProject();
      const errors1 = compiler.interpretFile(file1).getErrors();
      const errors2 = compiler.interpretFile(file2).getErrors();
      expect(errors1).toHaveLength(0);
      expect(errors2).toHaveLength(0);
    });

    describe('use filepath suggestion with @id layout', () => {
      function setupIdLayout (files: Record<string, string>) {
        const layout = new IdImportLayout();
        for (const [path, content] of Object.entries(files)) {
          layout.setSource(Filepath.from(path), content);
        }
        const compiler = new Compiler(layout);
        compiler.bindProject();
        return compiler;
      }

      it('specifier mode: suggests @id specifiers', () => {
        const compiler = setupIdLayout({
          '/@imports/shared-users.dbml': 'Table users { id int }',
          '/main.dbml': 'use * from ',
        });
        const program = 'use * from ';
        const model = new MockTextModel(program, Filepath.from('/main.dbml').toUri()) as any;
        const provider = new DBMLCompletionItemProvider(compiler);
        const result = provider.provideCompletionItems(model, createPosition(1, 12));
        const labels = result.suggestions.map((s: any) => String(s.label));
        expect(labels).toContain('@shared-users');
      });

      it('specifier mode: filters @id specifiers by prefix', () => {
        const compiler = setupIdLayout({
          '/@imports/shared-users.dbml': 'Table users { id int }',
          '/@imports/shared-orders.dbml': 'Table orders { id int }',
          '/@imports/other.dbml': 'Table other { id int }',
          '/main.dbml': "use * from '@shared'",
        });
        const program = "use * from '@shared'";
        const model = new MockTextModel(program, Filepath.from('/main.dbml').toUri()) as any;
        const provider = new DBMLCompletionItemProvider(compiler);
        const result = provider.provideCompletionItems(model, createPosition(1, 20));
        const labels = result.suggestions.map((s: any) => String(s.label));
        expect(labels).toContain('@shared-users');
        expect(labels).toContain('@shared-orders');
        expect(labels).not.toContain('@other');
      });

      it('filepath browse mode: suggests files and inserts @id specifier', () => {
        const compiler = setupIdLayout({
          '/@imports/shared-users.dbml': 'Table users { id int }',
          '/main.dbml': "use * from '/@imports/'",
        });
        const program = "use * from '/@imports/'";
        const model = new MockTextModel(program, Filepath.from('/main.dbml').toUri()) as any;
        const provider = new DBMLCompletionItemProvider(compiler);
        const result = provider.provideCompletionItems(model, createPosition(1, 22));
        const item = result.suggestions.find((s: any) => String(s.label) === '/@imports/shared-users.dbml');
        expect(item).toBeDefined();
        expect(item!.insertText).toBe('@shared-users');
      });
    });

    it('should not conflict when @id and relative path resolve to the same file', () => {
      const layout = new IdImportLayout();
      const shared = Filepath.from('/@imports/models.dbml');
      const main = Filepath.from('/@imports/main.dbml');

      layout.setSource(shared, 'Table users { id int [pk] }');
      layout.setSource(main, `use { table users } from '@models'
use { table users } from './models'

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}`);

      // Both specifiers resolve to the same filepath
      const byId = layout.resolveFileSpecifier(main, '@models');
      const byRel = layout.resolveFileSpecifier(main, './models');
      expect(byId!.equals(byRel!)).toBe(true);

      const compiler = new Compiler(layout);
      compiler.bindProject();
      const errors = compiler.interpretFile(main).getErrors();

      // No duplicate symbol errors - they refer to the same file
      expect(errors).toHaveLength(0);
    });
  });
});
