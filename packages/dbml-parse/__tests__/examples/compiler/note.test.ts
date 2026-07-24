import {
  describe, expect, it,
} from 'vitest';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { ElementKind } from '@/core/types/keywords';
import { updateNoteEdit, removeNoteEdit, addNoteEdit } from '@/core/utils/note';
import { applyTextEdits } from '@/compiler/queries/transform/applyTextEdits';

function parse (dbml: string) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbml);
  const compiler = new Compiler(layout);
  const ast = compiler.parseFile(DEFAULT_ENTRY).getValue()!.ast;
  return { compiler, ast, dbml };
}

function findElement (dbml: string, kind: ElementKind, index = 0): { declaration: ElementDeclarationNode; source: string } {
  const { ast } = parse(dbml);
  const declarations = ast.declarations
    .filter((d): d is ElementDeclarationNode => d instanceof ElementDeclarationNode && d.isKind(kind));
  return { declaration: declarations[index], source: dbml };
}

function applyEdit (source: string, edit: { start: number; end: number; newText: string }) {
  return applyTextEdits(source, [edit]);
}


describe('updateNoteEdit - table', () => {
  it('updates a body Note sub-element', () => {
    const dbml = `Table t {\n  id int\n  Note: 'old'\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Table);
    const edit = updateNoteEdit(declaration, 'new');
    expect(edit).toBeDefined();
    expect(applyEdit(source, edit!)).toContain("'new'");
    expect(applyEdit(source, edit!)).not.toContain("'old'");
  });

  it('updates a block Note sub-element', () => {
    const dbml = `Table t {\n  id int\n  Note {\n    'old'\n  }\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Table);
    const edit = updateNoteEdit(declaration, 'new');
    expect(edit).toBeDefined();
    expect(applyEdit(source, edit!)).toContain("'new'");
  });

  it('updates a setting attribute note', () => {
    const dbml = `Table t [note: 'old'] {\n  id int\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Table);
    const edit = updateNoteEdit(declaration, 'new');
    expect(edit).toBeDefined();
    expect(applyEdit(source, edit!)).toContain("'new'");
  });

  it('returns undefined if no note exists', () => {
    const dbml = `Table t {\n  id int\n}`;
    const { declaration } = findElement(dbml, ElementKind.Table);
    expect(updateNoteEdit(declaration, 'new')).toBeUndefined();
  });
});

describe('removeNoteEdit - table', () => {
  it('removes a body Note sub-element', () => {
    const dbml = `Table t {\n  id int\n  Note: 'old'\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Table);
    const edit = removeNoteEdit(declaration);
    expect(edit).toBeDefined();
    expect(applyEdit(source, edit!)).not.toContain('Note');
    expect(applyEdit(source, edit!)).not.toContain('old');
  });

  it('removes a setting attribute note (sole setting)', () => {
    const dbml = `Table t [note: 'old'] {\n  id int\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Table);
    const edit = removeNoteEdit(declaration);
    expect(edit).toBeDefined();
    const result = applyEdit(source, edit!);
    expect(result).not.toContain('note');
    expect(result).not.toContain('[');
  });

  it('returns undefined if no note exists', () => {
    const dbml = `Table t {\n  id int\n}`;
    const { declaration } = findElement(dbml, ElementKind.Table);
    expect(removeNoteEdit(declaration)).toBeUndefined();
  });
});

describe('addNoteEdit - table', () => {
  it('adds a body note to a block-form table', () => {
    const dbml = `Table t {\n  id int\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Table);
    const edit = addNoteEdit(declaration, 'hello');
    expect(edit).toBeDefined();
    const result = applyEdit(source, edit!);
    expect(result).toContain("note: 'hello'");
  });

  it('returns undefined if note already exists', () => {
    const dbml = `Table t {\n  id int\n  Note: 'existing'\n}`;
    const { declaration } = findElement(dbml, ElementKind.Table);
    expect(addNoteEdit(declaration, 'new')).toBeUndefined();
  });
});


describe('updateNoteEdit - dep', () => {
  it('updates a body sub-declaration note', () => {
    const dbml = `Table a { id int }\nTable b { id int }\nDep {\n  a -> b\n  note: 'old'\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Dep);
    const edit = updateNoteEdit(declaration, 'new');
    expect(edit).toBeDefined();
    expect(applyEdit(source, edit!)).toContain("'new'");
    expect(applyEdit(source, edit!)).not.toContain("'old'");
  });

  it('updates a header setting note', () => {
    const dbml = `Table a { id int }\nTable b { id int }\nDep [note: 'old'] {\n  a -> b\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Dep);
    const edit = updateNoteEdit(declaration, 'new');
    expect(edit).toBeDefined();
    expect(applyEdit(source, edit!)).toContain("'new'");
  });
});

describe('removeNoteEdit - dep', () => {
  it('removes a body sub-declaration note', () => {
    const dbml = `Table a { id int }\nTable b { id int }\nDep {\n  a -> b\n  note: 'old'\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Dep);
    const edit = removeNoteEdit(declaration);
    expect(edit).toBeDefined();
    const result = applyEdit(source, edit!);
    expect(result).not.toContain("note: 'old'");
    expect(result).toContain('a -> b');
  });
});

describe('addNoteEdit - dep', () => {
  it('adds a body note to a block-form dep', () => {
    const dbml = `Table a { id int }\nTable b { id int }\nDep {\n  a -> b\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Dep);
    const edit = addNoteEdit(declaration, 'hello');
    expect(edit).toBeDefined();
    const result = applyEdit(source, edit!);
    expect(result).toContain("note: 'hello'");
  });

  it('adds a setting note to a short-form dep', () => {
    const dbml = `Table a { id int }\nTable b { id int }\nDep: a -> b`;
    const { declaration, source } = findElement(dbml, ElementKind.Dep);
    const edit = addNoteEdit(declaration, 'hello');
    expect(edit).toBeDefined();
    const result = applyEdit(source, edit!);
    expect(result).toContain("[note: 'hello']");
  });

  it('appends to existing settings on a short-form dep', () => {
    const dbml = `Table a { id int }\nTable b { id int }\nDep: a -> b [color: #fff]`;
    const { declaration, source } = findElement(dbml, ElementKind.Dep);
    const edit = addNoteEdit(declaration, 'hello');
    expect(edit).toBeDefined();
    const result = applyEdit(source, edit!);
    expect(result).toContain("color: #fff, note: 'hello'");
  });

  it('returns undefined if note already exists', () => {
    const dbml = `Table a { id int }\nTable b { id int }\nDep {\n  a -> b\n  note: 'existing'\n}`;
    const { declaration } = findElement(dbml, ElementKind.Dep);
    expect(addNoteEdit(declaration, 'new')).toBeUndefined();
  });
});


describe('multiline notes', () => {
  it('uses triple quotes for multiline values', () => {
    const dbml = `Table t {\n  id int\n}`;
    const { declaration, source } = findElement(dbml, ElementKind.Table);
    const edit = addNoteEdit(declaration, 'line1\nline2');
    expect(edit).toBeDefined();
    const result = applyEdit(source, edit!);
    expect(result).toContain("'''\nline1\nline2\n'''");
  });
});
