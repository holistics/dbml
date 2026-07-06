import { describe, expect, it } from 'vitest';
import { CompileErrorCode } from '@/index';
import { SettingName } from '@/core/types';
import {
  BUILTIN_METADATA_FIELD_HELPERS,
  BUILTIN_METADATA_KEYS,
  type MetadataTarget,
} from '@/core/global_modules/metadata/builtin';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
  SyntaxNode,
} from '@/core/types/nodes';
import { TokenPosition } from '@/core/types/schemaJson';
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
      expect(t.metadata).toMatchObject({ note: 'from metadata' });
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
      expect(t.metadata).toMatchObject({ headercolor: '#000' });
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

    it('writes none as a valid color that overrides the inline value', () => {
      const source = `Table users [headercolor: #fff] {
  id int
}

Metadata Table public.users {
  headercolor: none
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      expect(table(source)!.headerColor).toBe('none');
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
      expect(g.metadata).toMatchObject({ note: 'group note', color: '#123' });
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
      expect(n.metadata).toMatchObject({ color: '#456', note: 'should stay custom' });
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
      expect(col.metadata).toMatchObject({ note: 'col note from metadata', color: '#999' });
    });

    it("promotes a boolean flag written as 'true'/'false' onto the typed field", () => {
      const source = `Table users {
  id int
}

Metadata Column public.users.id {
  unique: 'true'
  pk: 'false'
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const col = table(source)!.fields.find((f) => f.name === 'id')!;
      expect(col.unique).toBe(true);
      expect(col.pk).toBe(false);
      // raw values also remain in custom metadata.
      expect(col.metadata).toMatchObject({ unique: 'true', pk: 'false' });
    });

    it('errors when a boolean flag is not a true/false string literal', () => {
      const bad = (value: string) => {
        const source = `Table users {
  id int
}

Metadata Column public.users.id {
  unique: ${value}
}`;
        return interpret(source).getErrors().map((e) => e.code);
      };
      expect(bad("'banana'")).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
      expect(bad('42')).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
      // bare identifier (unquoted) is not accepted in this string-only iteration.
      expect(bad('true')).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });
  });
});

// Pluck the inline value node of the first `key: value` field inside the body
// of the first element in `source` — i.e. exactly the `sub.body?.callee` that
// the validation pass feeds to BUILTIN_METADATA_FIELDS[...].validate. Parsing a
// real snippet (rather than fabricating AST) keeps this test honest about the
// input type.
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
const boolFieldNode = (value: string) =>
  fieldValueNode(`Metadata Column public.users.id {\n  unique: ${value}\n}`);

const TOKEN = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } as TokenPosition;

describe('[unit] BUILTIN_METADATA_FIELD_HELPERS spec table', () => {
  it('is a superset of every key used in BUILTIN_METADATA_KEYS', () => {
    const matrixKeys = new Set(Object.values(BUILTIN_METADATA_KEYS).flat());
    const specKeys = new Set(Object.keys(BUILTIN_METADATA_FIELD_HELPERS));
    for (const key of matrixKeys) {
      expect(specKeys.has(key)).toBe(true);
    }
  });

  describe('validate (pre-extraction, against the value AST node)', () => {
    it('Note accepts a quoted string and rejects a non-string', () => {
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Note]!.validate(noteFieldNode("'hi'"))).toBe(true);
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Note]!.validate(noteFieldNode('42'))).toBe(false);
    });

    it('Color/HeaderColor accept a color literal or none and reject a string', () => {
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Color]!.validate(colorFieldNode('#fff'))).toBe(true);
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Color]!.validate(colorFieldNode('none'))).toBe(true);
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Color]!.validate(colorFieldNode("'red'"))).toBe(false);

      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.HeaderColor]!.validate(colorFieldNode('#fff'))).toBe(true);
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.HeaderColor]!.validate(colorFieldNode("'red'"))).toBe(false);
    });

    it("Unique accepts 'true'/'false' string literals and rejects others", () => {
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.validate(boolFieldNode("'true'"))).toBe(true);
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.validate(boolFieldNode("'false'"))).toBe(true);
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.validate(boolFieldNode("'banana'"))).toBe(false);
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.validate(boolFieldNode('42'))).toBe(false);
      // bare (unquoted) true is not a string literal in this iteration.
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.validate(boolFieldNode('true'))).toBe(false);
    });

    it('treats an absent value node as invalid (caller skips it separately)', () => {
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Note]!.validate(undefined)).toBe(false);
    });

    it('carries the value-type message fragment the caller splices into the diagnostic', () => {
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Note]!.message).toBe('a string');
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Color]!.message).toBe("a color literal or 'none'");
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.HeaderColor]!.message).toBe("a color literal or 'none'");
      expect(BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.message).toBe("'true' or 'false'");
    });
  });

  describe('assign (post-extraction, writes the value onto the typed field)', () => {
    it('Note writes { value, token } onto .note, stringifying the value', () => {
      const el = {} as MetadataTarget;
      BUILTIN_METADATA_FIELD_HELPERS[SettingName.Note]!.assign(el, '42', TOKEN);
      expect((el as { note?: unknown }).note).toEqual({ value: '42', token: TOKEN });
    });

    it('Color writes the raw value onto .color', () => {
      const el = {} as MetadataTarget;
      BUILTIN_METADATA_FIELD_HELPERS[SettingName.Color]!.assign(el, '#fff', TOKEN);
      expect((el as { color?: unknown }).color).toBe('#fff');
    });

    it('HeaderColor writes the raw value onto .headerColor (not .color)', () => {
      const el = {} as MetadataTarget;
      BUILTIN_METADATA_FIELD_HELPERS[SettingName.HeaderColor]!.assign(el, '#fff', TOKEN);
      expect((el as { headerColor?: unknown }).headerColor).toBe('#fff');
      expect((el as { color?: unknown }).color).toBeUndefined();
    });

    it("Unique parses the string literal into the boolean field", () => {
      const el = {} as MetadataTarget;
      BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.assign(el, 'true', TOKEN);
      expect((el as { unique?: unknown }).unique).toBe(true);
      BUILTIN_METADATA_FIELD_HELPERS[SettingName.Unique]!.assign(el, 'false', TOKEN);
      expect((el as { unique?: unknown }).unique).toBe(false);
    });
  });
});
