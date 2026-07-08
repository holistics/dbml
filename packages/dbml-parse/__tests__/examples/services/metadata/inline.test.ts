import { describe, expect, it } from 'vitest';
import { CompileErrorCode } from '@/index';
import { interpret } from '../../../utils';

function db (source: string) {
  return interpret(source).getValue();
}

function table (source: string, name = 'users') {
  return db(source)?.tables?.find((t) => t.name === name);
}

describe('[example] Inline custom metadata (settings list)', () => {
  describe('Table', () => {
    it('harvests non-builtin keys into metadata', () => {
      const source = `Table users [owner: "data-team", sla_hours: "24", active: "true"] {
  id int
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      expect(t.metadata).toMatchObject({ owner: 'data-team', sla_hours: '24', active: 'true' });
    });

    it('keeps builtin headercolor/note typed and out of metadata', () => {
      const source = `Table users [headercolor: #fff, note: "n", owner: "x"] {
  id int
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      expect(t.headerColor).toBe('#fff');
      expect(t.note?.value).toBe('n');
      // Builtins are NOT duplicated into metadata; only the custom key is.
      expect(t.metadata).toEqual({ owner: 'x' });
    });

    it('treats a key that is a builtin on another kind as free-form metadata', () => {
      // `color` is a builtin on TableGroup/Note, but NOT on Table.
      const source = `Table users [color: #abc] {
  id int
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      expect((t as any).color).toBeUndefined();
      expect(t.metadata).toMatchObject({ color: '#abc' });
    });

    it('errors on a valueless custom key', () => {
      const source = `Table users [owner] {
  id int
}`;
      const codes = interpret(source).getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_TABLE_SETTING_VALUE);
    });

    it('errors on a non-scalar custom value', () => {
      const source = `Table users [owner: (a, b)] {
  id int
}`;
      const codes = interpret(source).getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_TABLE_SETTING_VALUE);
    });

    it('errors on a duplicate custom key', () => {
      const source = `Table users [owner: "a", owner: "b"] {
  id int
}`;
      const codes = interpret(source).getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.DUPLICATE_TABLE_SETTING);
    });
  });

  describe('TableGroup', () => {
    it('harvests non-builtin keys, keeps color/note typed', () => {
      const source = `Table users {
  id int
}

TableGroup g1 [color: #123, note: "gn", team: "growth"] {
  users
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const g = result.getValue()?.tableGroups?.find((tg) => tg.name === 'g1')!;
      expect(g.color).toBe('#123');
      expect(g.note?.value).toBe('gn');
      expect(g.metadata).toEqual({ team: 'growth' });
    });
  });

  describe('Note (sticky)', () => {
    it('harvests non-builtin keys, keeps color typed', () => {
      const source = `Note overview [color: #456, author: "alice"] {
  'the body'
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const n = result.getValue()?.notes?.find((note) => note.name === 'overview')!;
      expect(n.color).toBe('#456');
      expect(n.metadata).toEqual({ author: 'alice' });
    });
  });

  describe('Column', () => {
    it('harvests non-builtin keys into the column metadata', () => {
      const source = `Table users {
  id int [pk, pii: "true", classification: "internal"]
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const col = table(source)!.fields.find((f) => f.name === 'id')!;
      expect(col.pk).toBe(true);
      expect(col.metadata).toMatchObject({ pii: 'true', classification: 'internal' });
    });

    it('harvests inline metadata on a TablePartial column', () => {
      // At the @dbml/parse layer, an injected partial column is surfaced via the
      // emitted TablePartial's fields; dbml-core expands it into the host table.
      const source = `TablePartial Base {
  id int [pk, owner: "data-team"]
}

Table users {
  ~Base
  name varchar
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const partial = result.getValue()?.tablePartials?.find((p) => p.name === 'Base')!;
      const col = partial.fields.find((f) => f.name === 'id');
      expect(col?.metadata).toMatchObject({ owner: 'data-team' });
    });
  });

  describe('precedence with Metadata blocks', () => {
    it('lets a reachable Metadata block override an inline custom key per-key', () => {
      const source = `Table users [owner: "inline", region: "us"] {
  id int
}

Metadata Table public.users {
  owner: "from-block"
  sla: "24"
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      // block overrides owner; inline-only `region` survives; block adds `sla`.
      expect(t.metadata).toMatchObject({ owner: 'from-block', region: 'us', sla: '24' });
    });

    it('keeps inline metadata when no block targets the element', () => {
      const source = `Table users [owner: "inline-only"] {
  id int
}`;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      expect(table(source)!.metadata).toEqual({ owner: 'inline-only' });
    });

    it('promotes an inline-only overlap key from a block onto the typed field, over the inline metadata base', () => {
      // headercolor inline-as-setting is the base; block headercolor overrides it.
      const source = `
Table users [headercolor: #111, owner: "x"] {
  id int
}

Metadata Table public.users {
  headercolor: #222
}
      `;
      const result = interpret(source);
      expect(result.getErrors()).toHaveLength(0);
      const t = table(source)!;
      expect(t.headerColor).toBe('#222');
      expect(t.metadata).toMatchObject({ owner: 'x' });
    });
  });
});
