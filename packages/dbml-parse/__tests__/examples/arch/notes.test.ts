import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/core/types/errors';
import { SymbolKind } from '@/core/types/symbol';
import type { Database } from '@/core/types/schemaJson';

const ARCH = '---\ndiagram_type: arch\n---\n';
const MAIN = Filepath.from('/main.dbml');

function compilerFor (files: Record<string, string>): Compiler {
  const layout = new MemoryProjectLayout();
  for (const [path, source] of Object.entries(files)) layout.setSource(Filepath.from(path), source);
  return new Compiler(layout);
}

function compile (source: string, files: Record<string, string> = {}) {
  const compiler = compilerFor({ ...files, '/main.dbml': ARCH + source });
  const interpreted = compiler.interpretFile(MAIN);
  return {
    errors: compiler.bindFile(MAIN).getErrors().map((e) => e.code),
    db: interpreted.getValue() as Database | undefined,
  };
}

const linksOf = (db?: Database) => db?.links?.map((l) => [l.from, l.op, l.to]);

describe('[example] a note in an architecture file is a sticky note', () => {
  test('it is a sticky note in the output, and can be a group member and a link end', () => {
    const { errors, db } = compile("Server api\nNote memo { 'hello' }\nGroup g { api memo }\nLink: api > memo");
    expect(errors).toEqual([]);
    expect(db?.notes.map((n) => [n.name, n.content])).toEqual([['memo', 'hello']]);
    expect(db?.groups?.[0].children).toEqual(['api', 'memo']);
    expect(linksOf(db)).toEqual([['api', '>', 'memo']]);
  });

  test('it carries an inline link, and its color stays a sticky note color', () => {
    const { errors, db } = compile("Server a\nNote memo [color: #ff0000, link: - a] { 'x' }");
    expect(errors).toEqual([]);
    expect(linksOf(db)).toEqual([['memo', '-', 'a']]);
    expect(db?.notes[0]).toMatchObject({ name: 'memo', color: '#ff0000', metadata: {} });
  });

  test('an empty or a malformed inline link on a note is reported', () => {
    expect(compile("Server a\nNote memo [link] { 'x' }").errors).toEqual([CompileErrorCode.EMPTY_LINK]);
    expect(compile("Server a\nNote memo [link: a] { 'x' }").errors).toEqual([CompileErrorCode.BAD_LINK]);
  });

  test('a note with no body has empty content', () => {
    const { errors, db } = compile('Note memo');
    expect(errors).toEqual([]);
    expect(db?.notes.map((n) => [n.name, n.content])).toEqual([['memo', '']]);
  });

  test('a note and a node cannot share a name, whichever comes first', () => {
    expect(compile("Server memo\nNote memo { 'x' }").errors).toEqual([CompileErrorCode.DUPLICATE_NAME]);
    expect(compile("Note memo { 'x' }\nServer memo").errors).toEqual([CompileErrorCode.DUPLICATE_NAME]);
  });

  test('Metadata does not target a note', () => {
    expect(compile("Note memo { 'x' }\nMetadata memo { owner: 'me' }").errors).toEqual([CompileErrorCode.UNKNOWN_METADATA_TARGET]);
  });

  test('an imported note can be a group member and a link end, under the name it has here', () => {
    const files = { '/notes.dbml': `${ARCH}Note memo { 'shared' }` };
    const plain = compile("use { Note memo } from './notes'\nServer api\nGroup g { api memo }\nLink: api > memo", files);
    expect(plain.errors).toEqual([]);
    expect(plain.db?.groups?.[0].children).toEqual(['api', 'memo']);
    expect(linksOf(plain.db)).toEqual([['api', '>', 'memo']]);

    const renamed = compile("use { Note memo as m } from './notes'\nServer api\nGroup g { api m }\nLink: api > m", files);
    expect(renamed.errors).toEqual([]);
    expect(renamed.db?.notes.map((n) => n.name)).toEqual(['m']);
    expect(renamed.db?.groups?.[0].children).toEqual(['api', 'm']);
    expect(linksOf(renamed.db)).toEqual([['api', '>', 'm']]);
  });

  test('a color on an inline link written on a note moves it out to a Link', () => {
    const compiler = compilerFor({ '/main.dbml': `${ARCH}Server a\nNote memo [link: - a] { 'x' }` });
    expect(compiler.updateElementSetting(MAIN, { kind: 'Link', from: 'memo', to: 'a' } as never, 'color', '#ff0000'))
      .toBe(`${ARCH}Server a\nNote memo { 'x' }\n\nLink: memo - a [color: #ff0000]\n`);
  });

  test('a rename that would take a note\'s name is refused', () => {
    const compiler = compilerFor({ '/main.dbml': `${ARCH}Server api\nNote memo { 'x' }` });
    expect(compiler.renameElement(MAIN, 'api', 'memo').size).toBe(0);
  });

  test('renaming a note updates the groups and links that name it', () => {
    const compiler = compilerFor({ '/main.dbml': `${ARCH}Server api\nNote memo { 'x' }\nGroup g { api memo }\nLink: api > memo` });
    expect(compiler.renameElement(MAIN, 'memo', 'remark').get(MAIN.absolute))
      .toBe(`${ARCH}Server api\nNote remark { 'x' }\nGroup g { api remark }\nLink: api > remark`);
  });

  test('a note in a DBML file is still an ordinary sticky note', () => {
    const compiler = compilerFor({ '/main.dbml': "Table users {\n  id int\n}\nNote memo { 'x' }" });
    expect(compiler.bindFile(MAIN).getErrors()).toEqual([]);
    const db = compiler.interpretFile(MAIN).getValue() as Database;
    expect(db.notes.map((n) => n.name)).toEqual(['memo']);
    expect(db.groups).toBeUndefined();
    expect(compiler.updateElementSetting(MAIN, { kind: SymbolKind.StickyNote, name: 'memo' } as never, 'color', '#00ff00'))
      .toContain('Note memo [color: #00ff00]');
  });
});
