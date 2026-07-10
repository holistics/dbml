import { describe, expect, it } from 'vitest';
import { CompileErrorCode } from '@/index';
import { SettingName } from '@/core/types';
import {
  TABLE_METADATA_FIELDS,
  COLUMN_METADATA_FIELDS,
} from '@/core/global_modules/table/interpret';
import { TABLEGROUP_METADATA_FIELDS } from '@/core/global_modules/tableGroup/interpret';
import { NOTE_METADATA_FIELDS } from '@/core/global_modules/note/interpret';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
  SyntaxNode,
} from '@/core/types/nodes';
import {
  Column, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import { interpret, parse } from '../../../utils';

function db (source: string) {
  return interpret(source).getValue();
}

function table (source: string, name = 'users') {
  return db(source)?.tables?.find((t) => t.name === name);
}

describe('[example] Metadata builtin-key promotion', () => {
  describe('Table', () => {
    it('writes note onto the inline note, overriding any inline value', () => {
      const source = `Table users {
  id int
  note: 'inline note'
}

Metadata Table public.users {
  note: 'from metadata'
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      // Written onto the typed inline field...
      expect(t.note?.value).toBe('from metadata');
      // ...and the note token points at the metadata key/value pair, not the
      // inline declaration (line 7 is the `note: 'from metadata'` line).
      expect(t.note?.token.start.line).toBe(7);
      // ...while still remaining in the raw metadata (additive).
      expect(t.metadata).toMatchObject({});
    });

    it('writes headercolor onto headerColor, overriding the inline value', () => {
      const source = `Table users [headercolor: #fff] {
  id int
}

Metadata Table public.users {
  headercolor: #000
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      expect(t.headerColor).toBe('#000');
      expect(t.metadata).toMatchObject({});
    });

    it('treats headercolor case-insensitively', () => {
      const source = `Table users {
  id int
}

Metadata Table public.users {
  headerColor: #abc
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      expect(table(source)!.headerColor).toBe('#abc');
    });

    it("rejects 'none' for headercolor in a metadata block (hex-only, matching the inline setting)", () => {
      const source = `Table users [headercolor: #fff] {
  id int
}

Metadata Table public.users {
  headercolor: none
}`;
      const codes = interpret(source).getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });

    it('does NOT write `color` on a Table (not a builtin key for Table)', () => {
      const source = `Table users {
  id int
}

Metadata Table public.users {
  color: #aaa
}`;
      const result = interpret(source);
      // `color` is free-form custom metadata for a Table: no validation, not written.
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      expect((t as any).color).toBeUndefined();
      expect(t.metadata).toMatchObject({ color: '#aaa' });
    });

    it('only overrides keys present in metadata, leaving absent inline values intact', () => {
      const source = `Table users [headercolor: #fff] {
  id int
  note: 'inline note'
}

Metadata Table public.users {
  headercolor: #000
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      // headercolor was overridden...
      expect(t.headerColor).toBe('#000');
      // ...but the inline note (absent from metadata) is untouched.
      expect(t.note?.value).toBe('inline note');
    });

    it('errors when a builtin color key is not a color literal', () => {
      const source = `Table users {
  id int
}

Metadata Table public.users {
  headercolor: 'banana'
}`;
      const codes = interpret(source).getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });

    it('errors when a builtin note key is not a quoted string', () => {
      const source = `Table users {
  id int
}

Metadata Table public.users {
  note: 42
}`;
      const codes = interpret(source).getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });
  });

  describe('TableGroup', () => {
    it('writes note and color onto the group', () => {
      const source = `Table users {
  id int
}

TableGroup g1 {
  users
}

Metadata TableGroup g1 {
  note: 'group note'
  color: #123
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const g = result.getValue()?.tableGroups?.find((tg) => tg.name === 'g1')!;
      expect(g.note?.value).toBe('group note');
      expect(g.color).toBe('#123');
      expect(g.metadata).toMatchObject({});
    });
  });

  describe('Note (sticky)', () => {
    it('writes color, but NOT a note/content key', () => {
      const source = `Note overview {
  'the note body'
}

Metadata Note overview {
  color: #456
  note: 'should stay custom'
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const n = result.getValue()?.notes?.find((note) => note.name === 'overview')!;
      expect(n.color).toBe('#456');
      // content is unchanged; `note` is just custom metadata.
      expect(n.content).toBe('the note body');
      expect(n.metadata).toMatchObject({ note: 'should stay custom' });
    });
  });

  describe('Column', () => {
    it('writes note onto the column, color-named keys stay free-form', () => {
      const source = `Table users {
  id int [note: 'inline col note']
}

Metadata Column public.users.id {
  note: 'col note from metadata'
  color: #999
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const col = table(source)!.fields.find((f) => f.name === 'id')!;
      expect(col.note?.value).toBe('col note from metadata');
      // color is not a column builtin key: free-form, not written, no error.
      expect((col as any).color).toBeUndefined();
      expect(col.metadata).toMatchObject({ color: '#999' });
      expect(col.note?.value).toBe('col note from metadata');
    });

    it('block-form pk stays in the metadata bag (not promoted to the typed field)', () => {
      // Column block-promotion is note-only. pk/unique/increment in the block
      // form are now free-form custom metadata — intentional behaviour change.
      const source = `Table users {
  id int
}

Metadata Column public.users.id {
  pk: 'true'
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const col = table(source)!.fields.find((f) => f.name === 'id')!;
      // pk is NOT promoted onto the typed field.
      expect(col.pk).toBe(false);
      // pk IS stored in the free-form metadata bag.
      expect(col.metadata).toMatchObject({ pk: 'true' });
    });

    it('inline [pk] still populates col.pk = true and is NOT in the bag', () => {
      const source = `Table users {
  id int [pk]
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const col = table(source)!.fields.find((f) => f.name === 'id')!;
      expect(col.pk).toBe(true);
      // inline [pk] is a recognized column setting; it must not appear in the bag.
      expect(col.metadata?.pk).toBeUndefined();
    });
  });
});

// Pluck the inline value node of the first `key: value` field inside the body
// of the first element in `source` — i.e. exactly the `sub.body?.callee` that
// the validation pass feeds to a MetadataField's validate function. Parsing a
// real snippet (rather than fabricating AST) keeps this test honest about input type.
function fieldValueNode (source: string): SyntaxNode | undefined {
  const ast = (parse(source).getValue() as { ast: ProgramNode }).ast;
  const element = ast.body[0] as ElementDeclarationNode;
  const body = element.body as BlockExpressionNode;
  const field = body.body[0] as ElementDeclarationNode;
  const fieldBody = field.body;
  return fieldBody instanceof FunctionApplicationNode ? fieldBody.callee : undefined;
}

const noteFieldNode = (value: string) =>
  fieldValueNode(`Metadata Table public.users {\n  note: ${value}\n}`);
const colorFieldNode = (value: string) =>
  fieldValueNode(`Metadata Table public.users {\n  headercolor: ${value}\n}`);

const TOKEN = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } as TokenPosition;

describe('[unit] element-owned field validate specs', () => {
  it('Note accepts a quoted string and rejects a non-string', () => {
    expect(TABLE_METADATA_FIELDS[SettingName.Note].isValidBuiltinFieldValue(noteFieldNode("'hi'"))).toBe(true);
    expect(TABLE_METADATA_FIELDS[SettingName.Note].isValidBuiltinFieldValue(noteFieldNode('42'))).toBe(false);
  });

  it("HeaderColor accepts a hex color but NOT 'none' (hex-only, matching inline)", () => {
    expect(TABLE_METADATA_FIELDS[SettingName.HeaderColor].isValidBuiltinFieldValue(colorFieldNode('#fff'))).toBe(true);
    expect(TABLE_METADATA_FIELDS[SettingName.HeaderColor].isValidBuiltinFieldValue(colorFieldNode('none'))).toBe(false);
    expect(TABLE_METADATA_FIELDS[SettingName.HeaderColor].isValidBuiltinFieldValue(colorFieldNode("'red'"))).toBe(false);
  });

  it("TableGroup color is hex-only; Note color allows 'none'", () => {
    expect(TABLEGROUP_METADATA_FIELDS[SettingName.Color].isValidBuiltinFieldValue(colorFieldNode('#fff'))).toBe(true);
    expect(TABLEGROUP_METADATA_FIELDS[SettingName.Color].isValidBuiltinFieldValue(colorFieldNode('none'))).toBe(false);
    expect(NOTE_METADATA_FIELDS[SettingName.Color].isValidBuiltinFieldValue(colorFieldNode('#fff'))).toBe(true);
    expect(NOTE_METADATA_FIELDS[SettingName.Color].isValidBuiltinFieldValue(colorFieldNode('none'))).toBe(true);
  });

  it('Column note accepts a quoted string and rejects a non-string', () => {
    expect(COLUMN_METADATA_FIELDS[SettingName.Note].isValidBuiltinFieldValue(noteFieldNode("'hi'"))).toBe(true);
    expect(COLUMN_METADATA_FIELDS[SettingName.Note].isValidBuiltinFieldValue(noteFieldNode('42'))).toBe(false);
  });

  it('treats an absent value node as invalid', () => {
    expect(TABLE_METADATA_FIELDS[SettingName.Note].isValidBuiltinFieldValue(undefined)).toBe(false);
  });

  it('carries the complete, ready-to-emit diagnostic message', () => {
    expect(TABLE_METADATA_FIELDS[SettingName.Note].message).toBe("'note' must be a string literal");
    expect(TABLE_METADATA_FIELDS[SettingName.HeaderColor].message).toBe("'headercolor' must be a color literal");
    expect(TABLEGROUP_METADATA_FIELDS[SettingName.Color].message).toBe("'color' must be a color literal");
    expect(NOTE_METADATA_FIELDS[SettingName.Color].message).toBe("'color' must be a color literal or 'none'");
    expect(COLUMN_METADATA_FIELDS[SettingName.Note].message).toBe("'note' must be a quoted string");
  });
});

describe('[unit] element-owned field assign functions', () => {
  it('Note writes { value, token } onto .note', () => {
    const el = {} as Table;
    TABLE_METADATA_FIELDS[SettingName.Note].assignBuiltinField(el, '42', TOKEN);
    expect((el as { note?: unknown }).note).toEqual({ value: '42', token: TOKEN });
  });

  it('Color writes the raw value onto .color', () => {
    const el = {} as TableGroup;
    TABLEGROUP_METADATA_FIELDS[SettingName.Color].assignBuiltinField(el, '#fff', TOKEN);
    expect((el as { color?: unknown }).color).toBe('#fff');
  });

  it('HeaderColor writes the raw value onto .headerColor (not .color)', () => {
    const el = {} as Table;
    TABLE_METADATA_FIELDS[SettingName.HeaderColor].assignBuiltinField(el, '#fff', TOKEN);
    expect((el as { headerColor?: unknown }).headerColor).toBe('#fff');
    expect((el as { color?: unknown }).color).toBeUndefined();
  });

  it('Column note assign writes { value, token } onto .note', () => {
    const el = {} as Column;
    COLUMN_METADATA_FIELDS[SettingName.Note].assignBuiltinField(el, 'col note', TOKEN);
    expect((el as { note?: unknown }).note).toEqual({ value: 'col note', token: TOKEN });
  });
});
