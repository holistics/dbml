import {
  describe, expect, it,
} from 'vitest';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import { SymbolKind } from '@/core/types/symbol';
import { MetadataKind } from '@/core/types/symbol/metadata';
import type { ElementIdentifier } from '@/compiler/queries/transform/types';

function update (dbml: string, target: ElementIdentifier, settingName: string, value: string | null | undefined) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbml);
  const compiler = new Compiler(layout);
  return compiler.updateElementSetting(DEFAULT_ENTRY, target, settingName, value);
}

describe('updateElementSetting - table', () => {
  it('adds a setting to a table with no settings', () => {
    const dbml = `Table users {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'headercolor', '#FF0000');
    expect(result).toContain('[headercolor: #FF0000]');
  });

  it('updates an existing setting on a table', () => {
    const dbml = `Table users [headercolor: #000000] {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'headercolor', '#FF0000');
    expect(result).toContain('headercolor: #FF0000');
    expect(result).not.toContain('#000000');
  });

  it('removes a setting when value is null', () => {
    const dbml = `Table users [headercolor: #FF0000] {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'headercolor', null);
    expect(result).not.toContain('headercolor');
    expect(result).not.toContain('#FF0000');
  });

  it('returns original source when setting to remove does not exist', () => {
    const dbml = `Table users {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'headercolor', null);
    expect(result).toBe(dbml);
  });

  it('returns original source when target element is not found', () => {
    const dbml = `Table users {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'nonexistent' }, 'headercolor', '#FF0000');
    expect(result).toBe(dbml);
  });

  it('works with a schema-qualified identifier', () => {
    const dbml = `Table myschema.users {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, schema: 'myschema', table: 'users' }, 'headercolor', '#FF0000');
    expect(result).toContain('[headercolor: #FF0000]');
  });
});

describe('updateElementSetting - name-only setting', () => {
  it('adds a name-only setting when value is undefined', () => {
    const dbml = `Table users {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'pk', undefined);
    expect(result).toMatch(/\[pk\]/);
  });
});

describe('updateElementSetting - table with multiple settings', () => {
  it('removes one setting and keeps the other', () => {
    const dbml = `Table users [headercolor: #FF0000, note: 'test'] {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'headercolor', null);
    expect(result).not.toContain('headercolor');
    expect(result).toContain('note');
  });

  it('updates one setting among multiple', () => {
    const dbml = `Table users [headercolor: #FF0000, note: 'test'] {
  id int
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'headercolor', '#00FF00');
    expect(result).toContain('headercolor: #00FF00');
    expect(result).toContain('note');
  });
});

describe('updateElementSetting - tablegroup', () => {
  it('adds a setting to a tablegroup', () => {
    const dbml = `Table users {
  id int
}
TableGroup mygroup {
  users
}`;
    const result = update(dbml, { kind: SymbolKind.TableGroup, name: 'mygroup' }, 'color', '#FF0000');
    expect(result).toContain('color: #FF0000');
  });
});

describe('updateElementSetting - enum', () => {
  it('adds a setting to an enum', () => {
    const dbml = `Enum status {
  active
  inactive
}`;
    const result = update(dbml, { kind: SymbolKind.Enum, name: 'status' }, 'note', "'Status enum'");
    expect(result).toContain('note');
  });
});

const PRELUDE = `
Table a {
  id int
}
Table b {
  id int
}
`;

describe('updateElementSetting - dep', () => {
  const dep = (up: string, down: string): ElementIdentifier => ({
    kind: MetadataKind.Dep,
    upstream: { tableName: up },
    downstream: { tableName: down },
  });

  it('adds color to a dep block header', () => {
    const dbml = `${PRELUDE}Dep {
  a -> b
}`;
    const result = update(dbml, dep('a', 'b'), 'color', '#FF0000');
    expect(result).toContain('color');
    expect(result).toContain('#FF0000');
  });

  it('updates existing color on a dep block header', () => {
    const dbml = `${PRELUDE}Dep [color: #000000] {
  a -> b
}`;
    const result = update(dbml, dep('a', 'b'), 'color', '#FF0000');
    expect(result).toContain('#FF0000');
    expect(result).not.toContain('#000000');
  });

  it('removes color from a dep block', () => {
    const dbml = `${PRELUDE}Dep [color: #FF0000] {
  a -> b
}`;
    const result = update(dbml, dep('a', 'b'), 'color', null);
    expect(result).not.toContain('#FF0000');
    expect(result).not.toContain('color');
  });

  it('updates color in dep body form', () => {
    const dbml = `${PRELUDE}Dep {
  a -> b
  color: #000000
}`;
    const result = update(dbml, dep('a', 'b'), 'color', '#FF0000');
    expect(result).toContain('#FF0000');
    expect(result).not.toContain('#000000');
  });

  it('adds color to a short-form dep', () => {
    const dbml = `${PRELUDE}Dep: a -> b`;
    const result = update(dbml, dep('a', 'b'), 'color', '#FF0000');
    expect(result).toContain('color');
    expect(result).toContain('#FF0000');
  });

  it('updates color on short-form dep header', () => {
    const dbml = `${PRELUDE}Dep [color: #000000]: a -> b`;
    const result = update(dbml, dep('a', 'b'), 'color', '#FF0000');
    expect(result).toContain('#FF0000');
    expect(result).not.toContain('#000000');
  });

  it('updates color on short-form dep edge node', () => {
    const dbml = `${PRELUDE}Dep: a -> b [color: #000000]`;
    const result = update(dbml, dep('a', 'b'), 'color', '#FF0000');
    expect(result).toContain('#FF0000');
    expect(result).not.toContain('#000000');
  });

  it('removes color from short-form dep edge node', () => {
    const dbml = `${PRELUDE}Dep: a -> b [color: #FF0000]`;
    const result = update(dbml, dep('a', 'b'), 'color', null);
    expect(result).not.toContain('#FF0000');
  });

  it('returns original when dep not found', () => {
    const dbml = `${PRELUDE}Dep {
  a -> b
}`;
    const result = update(dbml, dep('a', 'nonexistent'), 'color', '#FF0000');
    expect(result).toBe(dbml);
  });
});

describe('updateElementSetting - ref', () => {
  const ref = (left: string[], right: string[]): ElementIdentifier => ({
    kind: MetadataKind.Ref,
    endpoints: [
      { tableName: left[0], fieldNames: left.slice(1) },
      { tableName: right[0], fieldNames: right.slice(1) },
    ],
  });

  it('adds color to a short-form ref', () => {
    const dbml = `${PRELUDE}Ref: a.id > b.id`;
    const result = update(dbml, ref(['a', 'id'], ['b', 'id']), 'color', '#FF0000');
    expect(result).toContain('color');
    expect(result).toContain('#FF0000');
  });

  it('updates existing color on a ref', () => {
    const dbml = `${PRELUDE}Ref: a.id > b.id [color: #000000]`;
    const result = update(dbml, ref(['a', 'id'], ['b', 'id']), 'color', '#FF0000');
    expect(result).toContain('#FF0000');
    expect(result).not.toContain('#000000');
  });

  it('removes color from a ref', () => {
    const dbml = `${PRELUDE}Ref: a.id > b.id [color: #FF0000]`;
    const result = update(dbml, ref(['a', 'id'], ['b', 'id']), 'color', null);
    expect(result).not.toContain('#FF0000');
  });

  it('updates color on a ref edge in block form', () => {
    const dbml = `${PRELUDE}Ref {
  a.id > b.id [color: #000000]
}`;
    const result = update(dbml, ref(['a', 'id'], ['b', 'id']), 'color', '#FF0000');
    expect(result).toContain('#FF0000');
    expect(result).not.toContain('#000000');
  });

  it('returns original when ref not found', () => {
    const dbml = `${PRELUDE}Ref: a.id > b.id`;
    const result = update(dbml, ref(['a', 'id'], ['b', 'nonexistent']), 'color', '#FF0000');
    expect(result).toBe(dbml);
  });
});
