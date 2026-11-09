import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/core/types/errors';
import { SymbolKind } from '@/core/types/symbol';
import type { Database } from '@/core/types/schemaJson';

const ARCH = `---
diagram_type: arch
---
`;
const MAIN = Filepath.from('/main.dbml');

function createCompiler (files: Record<string, string>): Compiler {
  const layout = new MemoryProjectLayout();
  for (const [path, source] of Object.entries(files)) layout.setSource(Filepath.from(path), source);
  return new Compiler(layout);
}

function compile (source: string, files: Record<string, string> = {}) {
  const compiler = createCompiler({ ...files, '/main.dbml': ARCH + source });
  const interpreted = compiler.interpretFile(MAIN);
  return {
    errors: compiler.bindFile(MAIN).getErrors().map((e) => e.code),
    db: interpreted.getValue() as Database | undefined,
  };
}

const getLinks = (db?: Database) => db?.links?.map((l) => [l.from, l.op, l.to]);

describe('[example] a note in an architecture file is a sticky note', () => {
  test('it is a sticky note in the output, and can be a group member and a link end', () => {
    const { errors, db } = compile(`Server api
Note memo { 'hello' }
Group g { api memo }
Link: api > memo`);
    expect(errors).toEqual([]);
    expect(db?.notes.map((n) => [n.name, n.content])).toEqual([['memo', 'hello']]);
    expect(db?.groups?.[0].children).toEqual([{ handle: 'api', role: 'Server' }, { handle: 'memo', role: 'Note' }]);
    expect(getLinks(db)).toEqual([['api', '>', 'memo']]);
  });

  test('it carries an inline link, and its color stays a sticky note color', () => {
    const { errors, db } = compile(`Server a
Note memo [color: #ff0000, link: - a] { 'x' }`);
    expect(errors).toEqual([]);
    expect(getLinks(db)).toEqual([['memo', '-', 'a']]);
    expect(db?.notes[0]).toMatchObject({ name: 'memo', color: '#ff0000', metadata: {} });
  });

  test('an empty or a malformed inline link on a note is reported', () => {
    expect(compile(`Server a
Note memo [link] { 'x' }`).errors).toEqual([CompileErrorCode.ARCH_EMPTY_LINK]);
    expect(compile(`Server a
Note memo [link: a] { 'x' }`).errors).toEqual([CompileErrorCode.ARCH_BAD_LINK]);
  });

  test('a note needs a body', () => {
    expect(compile('Note memo').errors).toEqual([CompileErrorCode.INVALID_NOTE]);
  });

  test('a note and a node may share a name, two notes may not', () => {
    expect(compile(`Server memo
Note memo { 'x' }`).errors).toEqual([]);
    expect(compile(`Note memo { 'x' }
Server memo`).errors).toEqual([]);
    expect(compile(`Note memo { 'x' }
Note memo { 'y' }`).errors).toEqual([CompileErrorCode.DUPLICATE_NAME]);
  });

  test('Metadata targets a note, with or without the Note role', () => {
    const { errors, db } = compile(`Note memo { 'x' }
Metadata memo {
  owner: 'me'
  color: #ff0000
}`);
    expect(errors).toEqual([]);
    expect(db?.notes[0].metadata?.owner?.value).toBe('me');
    expect(db?.notes[0].color).toBe('#ff0000');
    expect(compile(`Note memo { 'x' }
Metadata Note memo {
  owner: 'me'
}`).db?.notes[0].metadata?.owner?.value).toBe('me');
  });

  test('an imported note can be a group member and a link end, under the name it has here', () => {
    const files = { '/notes.dbml': `${ARCH}Note memo { 'shared' }` };
    const plain = compile(`use { Note memo } from './notes'
Server api
Group g { api memo }
Link: api > memo`, files);
    expect(plain.errors).toEqual([]);
    expect(plain.db?.groups?.[0].children).toEqual([{ handle: 'api', role: 'Server' }, { handle: 'memo', role: 'Note' }]);
    expect(getLinks(plain.db)).toEqual([['api', '>', 'memo']]);

    const renamed = compile(`use { Note memo as m } from './notes'
Server api
Group g { api m }
Link: api > m`, files);
    expect(renamed.errors).toEqual([]);
    expect(renamed.db?.notes.map((n) => n.name)).toEqual(['m']);
    expect(renamed.db?.groups?.[0].children).toEqual([{ handle: 'api', role: 'Server' }, { handle: 'm', role: 'Note' }]);
    expect(getLinks(renamed.db)).toEqual([['api', '>', 'm']]);
  });

  test('a color on an inline link written on a note moves it out to a Link', () => {
    const compiler = createCompiler({ '/main.dbml': `${ARCH}Server a
Note memo [link: - a] { 'x' }` });
    expect(compiler.updateElementSetting(MAIN, { kind: 'Link', from: 'memo', to: 'a' } as never, 'color', '#ff0000'))
      .toBe(`${ARCH}Server a
Note memo { 'x' }

Link: Note memo - Server a [color: #ff0000]
`);
  });

  test('a rename may take a note\'s name, since the roles differ', () => {
    const compiler = createCompiler({ '/main.dbml': `${ARCH}Server api
Note memo { 'x' }` });
    expect(compiler.renameElement(MAIN, 'api', 'memo').get(MAIN.absolute)).toBe(`${ARCH}Server memo
Note memo { 'x' }`);
  });

  test('renaming a note updates the groups and links that name it', () => {
    const compiler = createCompiler({ '/main.dbml': `${ARCH}Server api
Note memo { 'x' }
Group g { api memo }
Link: api > memo` });
    expect(compiler.renameElement(MAIN, 'memo', 'remark').get(MAIN.absolute))
      .toBe(`${ARCH}Server api
Note remark { 'x' }
Group g { api
  Note remark
}
Link: api > Note remark`);
  });

  test('a note in a DBML file is still an ordinary sticky note', () => {
    const compiler = createCompiler({ '/main.dbml': `Table users {
  id int
}
Note memo { 'x' }` });
    expect(compiler.bindFile(MAIN).getErrors()).toEqual([]);
    const db = compiler.interpretFile(MAIN).getValue() as Database;
    expect(db.notes.map((n) => n.name)).toEqual(['memo']);
    expect(db.groups).toBeUndefined();
    expect(compiler.updateElementSetting(MAIN, { kind: SymbolKind.StickyNote, name: 'memo' } as never, 'color', '#00ff00'))
      .toContain('Note memo [color: #00ff00]');
  });
});
