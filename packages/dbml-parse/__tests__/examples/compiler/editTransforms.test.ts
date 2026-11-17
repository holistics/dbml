import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import { SymbolKind } from '@/core/types/symbol';
import { applyTextEdits, type TextEdit } from '@/compiler/queries/transform/applyTextEdits';
import { formatNoteString } from '@/compiler/queries/transform/utils';

function createCompiler (source: string): Compiler {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, source);
  return new Compiler(layout);
}

function apply (source: string, edit: (compiler: Compiler) => TextEdit[]): string {
  return applyTextEdits(source, edit(createCompiler(source)));
}

function errorsOf (source: string): string[] {
  return createCompiler(source).interpretFile(DEFAULT_ENTRY).getErrors().map((e) => e.diagnostic);
}

const ARCH = `---
diagram_type: arch
---
`;

describe('formatNoteString', () => {
  it('uses single quotes for plain text', () => {
    expect(formatNoteString('Takes all writes')).toBe("'Takes all writes'");
  });

  it('uses triple quotes for a quote or a line break, and escapes backslashes', () => {
    expect(formatNoteString("it's")).toBe("'''it\\'s'''");
    expect(formatNoteString('one\r\ntwo')).toBe("'''one\ntwo'''");
    expect(formatNoteString('a\\b')).toBe("'a\\\\b'");
  });
});

describe('createRefEdit', () => {
  const tables = `Table users {
  id int
}
Table posts {
  user_id int
}`;

  it('adds a ref at the end, quoting names only when needed', () => {
    const result = apply(tables, (c) => c.createRefEdit(DEFAULT_ENTRY, { tableName: 'posts', fieldNames: ['user_id'] }, '>', { tableName: 'users', fieldNames: ['id'] }));
    expect(result).toBe(`${tables}

Ref: posts.user_id > users.id
`);
    expect(errorsOf(result)).toEqual([]);
  });

  it('writes a schema other than public, and quotes a name with a space', () => {
    const edits = createCompiler('').createRefEdit(DEFAULT_ENTRY, { schemaName: 'billing', tableName: 'user accounts', fieldNames: ['id'] }, '-', { schemaName: 'public', tableName: 'users', fieldNames: ['id'] });
    expect(edits[0]!.newText).toBe('\n\nRef: billing."user accounts".id - users.id\n');
  });
});

describe('sticky note edits', () => {
  it('adds a sticky note with its color', () => {
    const result = apply(`Table t {
  id int
}`, (c) => c.createStickyNoteEdit(DEFAULT_ENTRY, 'note_1', 'Read me', '#ffcc00'));
    expect(result).toBe(`Table t {
  id int
}

Note note_1 [color: #ffcc00] {
  'Read me'
}
`);
    expect(errorsOf(result)).toEqual([]);
  });

  it('replaces the text of a sticky note', () => {
    const source = `Note n {
  'old'
}
`;
    const result = apply(source, (c) => c.setStickyNoteTextEdit(DEFAULT_ENTRY, 'n', "it's new"));
    expect(result).toBe(`Note n {
  '''it\\'s new'''
}
`);
    expect(errorsOf(result)).toEqual([]);
  });

  it('replaces the text of a sticky note in an architecture file', () => {
    const source = `${ARCH}Server api
Note n {
  'old'
}
`;
    expect(apply(source, (c) => c.setStickyNoteTextEdit(DEFAULT_ENTRY, 'n', 'new'))).toBe(`${ARCH}Server api
Note n {
  'new'
}
`);
  });

  it('removes a sticky note with its whole lines', () => {
    const source = `Table t {
  id int
}
Note n {
  'bye'
}
Table u {
  id int
}`;
    const result = apply(source, (c) => c.removeStickyNoteEdit(DEFAULT_ENTRY, 'n'));
    expect(result).toBe(`Table t {
  id int
}
Table u {
  id int
}`);
    expect(errorsOf(result)).toEqual([]);
  });

  it('gives no edits for a sticky note that does not exist', () => {
    const compiler = createCompiler(`Table t {
  id int
}`);
    expect(compiler.setStickyNoteTextEdit(DEFAULT_ENTRY, 'missing', 'x')).toEqual([]);
    expect(compiler.removeStickyNoteEdit(DEFAULT_ENTRY, 'missing')).toEqual([]);
  });
});

describe('setNoteEdit', () => {
  it('keeps a body Note line in the body', () => {
    const source = `Table users {
  id int
  Note: 'old'
}`;
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Table, table: 'users' }, 'new'));
    expect(result).toBe(`Table users {
  id int
  Note: 'new'
}`);
    expect(errorsOf(result)).toEqual([]);
  });

  it('keeps a note setting as a setting', () => {
    const source = `Table users {
  id int [note: 'old']
}`;
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Column, table: 'users', column: 'id' }, 'new'));
    expect(result).toBe(`Table users {
  id int [note: 'new']
}`);
  });

  it('adds a note setting when there is no note', () => {
    const source = `Table users {
  id int
}
TableGroup g {
  users
}`;
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.TableGroup, name: 'g' }, 'Core tables'));
    expect(result).toBe(`Table users {
  id int
}
TableGroup g [note: 'Core tables'] {
  users
}`);
    expect(errorsOf(result)).toEqual([]);
  });

  it('removes the note on null', () => {
    const source = `Table users [note: 'old'] {
  id int
}`;
    expect(apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Table, table: 'users' }, null))).toBe(`Table users {
  id int
}`);
  });

  it('sets the note of an architecture node', () => {
    const source = `${ARCH}Server api {
  Note: 'old'
}`;
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Element, name: 'api', role: 'Server' }, 'new'));
    expect(result).toBe(`${ARCH}Server api {
  Note: 'new'
}`);
    expect(errorsOf(result)).toEqual([]);
  });
});

describe('renameTableEdit', () => {
  it('gives the edits renameTable applies', () => {
    const source = `Table users {
  id int
}
Table posts {
  user_id int [ref: > users.id]
}`;
    const compiler = createCompiler(source);
    const edits = compiler.renameTableEdit(DEFAULT_ENTRY, 'users', 'members');
    expect(applyTextEdits(source, edits)).toBe(createCompiler(source).renameTable(DEFAULT_ENTRY, 'users', 'members').get(DEFAULT_ENTRY.absolute));
    expect(applyTextEdits(source, edits)).toContain('Table members');
  });

  it('gives no edits for a table that does not exist', () => {
    expect(createCompiler(`Table users {
  id int
}`).renameTableEdit(DEFAULT_ENTRY, 'missing', 'x')).toEqual([]);
  });
});
