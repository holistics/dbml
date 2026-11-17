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

const ARCH = '---\ndiagram_type: arch\n---\n';

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
  const tables = 'Table users {\n  id int\n}\nTable posts {\n  user_id int\n}';

  it('adds a ref at the end, quoting names only when needed', () => {
    const result = apply(tables, (c) => c.createRefEdit(DEFAULT_ENTRY, { tableName: 'posts', fieldNames: ['user_id'] }, '>', { tableName: 'users', fieldNames: ['id'] }));
    expect(result).toBe(`${tables}\n\nRef: posts.user_id > users.id\n`);
    expect(errorsOf(result)).toEqual([]);
  });

  it('writes a schema other than public, and quotes a name with a space', () => {
    const edits = createCompiler('').createRefEdit(DEFAULT_ENTRY, { schemaName: 'billing', tableName: 'user accounts', fieldNames: ['id'] }, '-', { schemaName: 'public', tableName: 'users', fieldNames: ['id'] });
    expect(edits[0]!.newText).toBe('\n\nRef: billing."user accounts".id - users.id\n');
  });
});

describe('sticky note edits', () => {
  it('adds a sticky note with its color', () => {
    const result = apply('Table t {\n  id int\n}', (c) => c.createStickyNoteEdit(DEFAULT_ENTRY, 'note_1', 'Read me', '#ffcc00'));
    expect(result).toBe("Table t {\n  id int\n}\n\nNote note_1 [color: #ffcc00] {\n  'Read me'\n}\n");
    expect(errorsOf(result)).toEqual([]);
  });

  it('replaces the text of a sticky note', () => {
    const source = "Note n {\n  'old'\n}\n";
    const result = apply(source, (c) => c.setStickyNoteTextEdit(DEFAULT_ENTRY, 'n', "it's new"));
    expect(result).toBe("Note n {\n  '''it\\'s new'''\n}\n");
    expect(errorsOf(result)).toEqual([]);
  });

  it('replaces the text of a sticky note in an architecture file', () => {
    const source = `${ARCH}Server api\nNote n {\n  'old'\n}\n`;
    expect(apply(source, (c) => c.setStickyNoteTextEdit(DEFAULT_ENTRY, 'n', 'new'))).toBe(`${ARCH}Server api\nNote n {\n  'new'\n}\n`);
  });

  it('removes a sticky note with its whole lines', () => {
    const source = "Table t {\n  id int\n}\nNote n {\n  'bye'\n}\nTable u {\n  id int\n}";
    const result = apply(source, (c) => c.removeStickyNoteEdit(DEFAULT_ENTRY, 'n'));
    expect(result).toBe('Table t {\n  id int\n}\nTable u {\n  id int\n}');
    expect(errorsOf(result)).toEqual([]);
  });

  it('gives no edits for a sticky note that does not exist', () => {
    const compiler = createCompiler('Table t {\n  id int\n}');
    expect(compiler.setStickyNoteTextEdit(DEFAULT_ENTRY, 'missing', 'x')).toEqual([]);
    expect(compiler.removeStickyNoteEdit(DEFAULT_ENTRY, 'missing')).toEqual([]);
  });
});

describe('setNoteEdit', () => {
  it('keeps a body Note line in the body', () => {
    const source = "Table users {\n  id int\n  Note: 'old'\n}";
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Table, table: 'users' }, 'new'));
    expect(result).toBe("Table users {\n  id int\n  Note: 'new'\n}");
    expect(errorsOf(result)).toEqual([]);
  });

  it('keeps a note setting as a setting', () => {
    const source = "Table users {\n  id int [note: 'old']\n}";
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Column, table: 'users', column: 'id' }, 'new'));
    expect(result).toBe("Table users {\n  id int [note: 'new']\n}");
  });

  it('adds a note setting when there is no note', () => {
    const source = 'Table users {\n  id int\n}\nTableGroup g {\n  users\n}';
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.TableGroup, name: 'g' }, 'Core tables'));
    expect(result).toBe("Table users {\n  id int\n}\nTableGroup g [note: 'Core tables'] {\n  users\n}");
    expect(errorsOf(result)).toEqual([]);
  });

  it('removes the note on null', () => {
    const source = "Table users [note: 'old'] {\n  id int\n}";
    expect(apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Table, table: 'users' }, null))).toBe('Table users {\n  id int\n}');
  });

  it('sets the note of an architecture node', () => {
    const source = `${ARCH}Server api {\n  Note: 'old'\n}`;
    const result = apply(source, (c) => c.setNoteEdit(DEFAULT_ENTRY, { kind: SymbolKind.Element, name: 'api', role: 'Server' }, 'new'));
    expect(result).toBe(`${ARCH}Server api {\n  Note: 'new'\n}`);
    expect(errorsOf(result)).toEqual([]);
  });
});

describe('renameTableEdit', () => {
  it('gives the edits renameTable applies', () => {
    const source = 'Table users {\n  id int\n}\nTable posts {\n  user_id int [ref: > users.id]\n}';
    const compiler = createCompiler(source);
    const edits = compiler.renameTableEdit(DEFAULT_ENTRY, 'users', 'members');
    expect(applyTextEdits(source, edits)).toBe(createCompiler(source).renameTable(DEFAULT_ENTRY, 'users', 'members').get(DEFAULT_ENTRY.absolute));
    expect(applyTextEdits(source, edits)).toContain('Table members');
  });

  it('gives no edits for a table that does not exist', () => {
    expect(createCompiler('Table users {\n  id int\n}').renameTableEdit(DEFAULT_ENTRY, 'missing', 'x')).toEqual([]);
  });
});
