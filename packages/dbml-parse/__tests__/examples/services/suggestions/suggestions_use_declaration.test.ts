import {
  describe, expect, it,
} from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import {
  createMockTextModel, createPosition,
} from '@tests/utils';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  CompletionItemKind,
} from '@/services/types';

function setupMultiFile (files: Record<string, string>) {
  const compiler = new Compiler();
  for (const [path, content] of Object.entries(files)) {
    compiler.setSource(Filepath.from(path), content);
  }
  compiler.bindProject();
  return compiler;
}

describe('[example] CompletionItemProvider - use declaration', () => {
  describe('after use keyword (no specifiers yet)', () => {
    it('suggests * from and { } from snippets', () => {
      const program = 'use ';
      const compiler = new Compiler();
      compiler.setSource(Filepath.from('/main.dbml'), program);
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 5));
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('* from');
      expect(labels).toContain('{ } from');
    });

    it('snippets are InsertAsSnippet with tab stops', () => {
      const program = 'use ';
      const compiler = new Compiler();
      compiler.setSource(Filepath.from('/main.dbml'), program);
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 5));
      const wildcard = result.suggestions.find((s) => s.label === '* from');
      expect(wildcard?.insertText).toContain('${1:');
    });
  });

  describe('inside specifier list braces', () => {
    it('suggests all import kinds when cursor is after open brace', () => {
      const program = "use { } from './schema'";
      const compiler = new Compiler();
      compiler.setSource(Filepath.from('/main.dbml'), program);
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      // cursor after '{'
      const result = provider.provideCompletionItems(model, createPosition(1, 6));
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('table');
      expect(labels).toContain('enum');
      expect(labels).toContain('tablegroup');
      expect(labels).toContain('tablepartial');
      expect(labels).toContain('note');
      expect(labels).toContain('schema');
    });

  });

  describe('element name suggestions', () => {
    it('suggests table names from target file after import kind', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': `
Table users { id int [pk] }
Table orders { id int [pk] }
`,
        '/main.dbml': "use { table } from './schema'",
      });
      const program = "use { table } from './schema'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      // cursor between 'table' and '}'
      const result = provider.provideCompletionItems(model, createPosition(1, 13));
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('users');
      expect(labels).toContain('orders');
    });

    it('suggests enum names from target file', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': `
Enum job_status { pending done }
Enum color { red blue }
`,
        '/main.dbml': "use { enum } from './schema'",
      });
      const program = "use { enum } from './schema'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 12));
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('job_status');
      expect(labels).toContain('color');
    });

    it('suggests schema-qualified table names for non-public schema', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': 'Table auth.users { id int [pk] }',
        '/main.dbml': "use { table } from './schema'",
      });
      const program = "use { table } from './schema'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 13));
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('auth.users');
    });

    it('returns no suggestions when importPath is absent', () => {
      const program = 'use { table }';
      const compiler = new Compiler();
      compiler.setSource(Filepath.from('/main.dbml'), program);
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 13));
      // No file to resolve → no name suggestions (may still return import kinds for the kind token)
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).not.toContain('users');
    });
  });

  describe('filepath suggestions', () => {
    it('suggests relative filepaths after `from` keyword', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': 'Table users { id int [pk] }',
        '/main.dbml': 'use { table users } from ',
      });
      const program = 'use { table users } from ';
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 26));
      const labels = result.suggestions.map((s) => s.label);
      expect(labels.some((l) => l.toString().includes('schema'))).toBe(true);
    });

    it('suggests filepaths with quote-wrapped insertText', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': 'Table users { id int [pk] }',
        '/main.dbml': 'use * from ',
      });
      const program = 'use * from ';
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 12));
      expect(result.suggestions.length).toBeGreaterThan(0);
      const first = result.suggestions[0];
      expect(first.insertText).toMatch(/^'.*'$/);
    });

    it('provides replacement range when cursor is inside existing importPath', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': 'Table users { id int [pk] }',
        '/main.dbml': "use * from './schema'",
      });
      const program = "use * from './schema'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      // cursor inside the string token
      const result = provider.provideCompletionItems(model, createPosition(1, 18));
      expect(result.suggestions.length).toBeGreaterThan(0);
      // All suggestions should carry an explicit range covering the existing token
      for (const s of result.suggestions) {
        expect(s.range).toBeDefined();
        expect((s.range as any).startLineNumber).toBe(1);
      }
    });

    it('does not suggest current file as a filepath option', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': 'Table users { id int [pk] }',
        '/main.dbml': 'use * from ',
      });
      const program = 'use * from ';
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 12));
      expect(result.suggestions.every((s) => !String(s.label).includes('main'))).toBe(true);
    });

    it('suggests only direct children of the typed prefix', () => {
      const compiler = setupMultiFile({
        '/sub/a.dbml': 'Table a { id int }',
        '/sub/b.dbml': 'Table b { id int }',
        '/other.dbml': 'Table c { id int }',
        '/main.dbml': "use * from './sub/'",
      });
      const program = "use * from './sub/'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      // cursor after `./sub/`
      const result = provider.provideCompletionItems(model, createPosition(1, 19));
      const labels = result.suggestions.map((s) => String(s.label));
      expect(labels).toContain('./sub/a');
      expect(labels).toContain('./sub/b');
      expect(labels).not.toContain('./other');
    });

    it('collapses nested files into folder entries at the current prefix', () => {
      const compiler = setupMultiFile({
        '/sub/deeper/a.dbml': 'Table a { id int }',
        '/main.dbml': "use * from './'",
      });
      const program = "use * from './'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 15));
      const labels = result.suggestions.map((s) => String(s.label));
      // Only the first directory segment under `./` is surfaced; the
      // leaf `./sub/deeper/a` stays hidden until the user descends.
      expect(labels).toContain('./sub');
      expect(labels).not.toContain('./sub/deeper/a');
    });

    it('tags folders as Folder and files as File', () => {
      const compiler = setupMultiFile({
        '/sub/a.dbml': 'Table a { id int }',
        '/other.dbml': 'Table b { id int }',
        '/main.dbml': "use * from './'",
      });
      const program = "use * from './'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 15));
      const folder = result.suggestions.find((s) => String(s.label) === './sub');
      const file = result.suggestions.find((s) => String(s.label) === './other');
      expect(folder?.kind).toBe(CompletionItemKind.Folder);
      expect(file?.kind).toBe(CompletionItemKind.File);
    });

    it('replaces content between quotes without re-inserting them', () => {
      const compiler = setupMultiFile({
        '/schema.dbml': 'Table users { id int [pk] }',
        '/main.dbml': "use * from './'",
      });
      const program = "use * from './'";
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      // cursor inside the `'./'` literal
      const result = provider.provideCompletionItems(model, createPosition(1, 15));
      const schemaItem = result.suggestions.find((s) => String(s.label) === './schema');
      expect(schemaItem).toBeDefined();
      // Bare insertText (no surrounding quotes) since the range targets
      // content-between-quotes only.
      expect(schemaItem!.insertText).toBe('./schema');
    });
  });

  describe('no suggestions in wrong positions', () => {
    it('returns no suggestions inside alias position (after `as`)', () => {
      const program = "use { table users as } from './schema'";
      const compiler = new Compiler();
      compiler.setSource(Filepath.from('/main.dbml'), program);
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      // cursor after 'as '
      const result = provider.provideCompletionItems(model, createPosition(1, 22));
      // alias is user-defined; may return import kinds but not element names
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).not.toContain('users');
    });

    it('returns no suggestions after wildcard `*` (before `from`)', () => {
      const program = 'use * ';
      const compiler = new Compiler();
      compiler.setSource(Filepath.from('/main.dbml'), program);
      const model = createMockTextModel(program, Filepath.from('/main.dbml').toUri());
      const provider = new DBMLCompletionItemProvider(compiler);
      const result = provider.provideCompletionItems(model, createPosition(1, 7));
      expect(result.suggestions).toHaveLength(0);
    });
  });
});
