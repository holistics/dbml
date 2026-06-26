import { describe, expect, it } from 'vitest';
import { CompileErrorCode } from '@/index';
import { interpret } from '../../../utils';

function db (source: string) {
  return interpret(source).getValue();
}

function table (source: string, name = 'users') {
  return db(source)?.tables?.find((t) => t.name === name);
}

describe('[example] Metadata overlap-key promotion', () => {
  describe('Table', () => {
    it('promotes note onto the inline note, overriding any inline value', () => {
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
      // Promoted onto the typed inline field...
      expect(t.note?.value).toBe('from metadata');
      // ...and the note token points at the metadata key/value pair, not the
      // inline declaration (line 7 is the `note: 'from metadata'` line).
      expect(t.note?.token.start.line).toBe(7);
      // ...while still remaining in the raw metadata (additive).
      expect(t.metadata).toMatchObject({ note: 'from metadata' });
    });

    it('promotes headercolor onto headerColor, overriding the inline value', () => {
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

    it('promotes none as a valid color that overrides the inline value', () => {
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

    it('does NOT promote `color` on a Table (not an overlap key for Table)', () => {
      const source = `Table users {
  id int
}

Metadata Table public.users {
  color: #aaa
}`;
      const result = interpret(source);
      // `color` is free-form custom metadata for a Table: no validation, no promotion.
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

    it('errors when an overlap color key is not a color literal', () => {
      const source = `Table users {
  id int
}

Metadata Table public.users {
  headercolor: 'banana'
}`;
      const codes = interpret(source).getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });

    it('errors when an overlap note key is not a quoted string', () => {
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
    it('promotes note and color onto the group', () => {
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
    it('promotes color, but NOT a note/content key', () => {
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
    it('promotes note onto the column, color-named keys stay free-form', () => {
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
      // color is not a column overlap key: free-form, no promotion, no error.
      expect((col as any).color).toBeUndefined();
      expect(col.metadata).toMatchObject({ note: 'col note from metadata', color: '#999' });
    });
  });
});
