import {
  describe, expect, it,
} from 'vitest';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import { SymbolKind } from '@/core/types/symbol';
import type { ElementIdentifier } from '@/compiler/queries/transform/types';

function update (dbml: string, target: ElementIdentifier, settingName: string, value: string | null | undefined) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbml);
  const compiler = new Compiler(layout);
  return compiler.updateElementSetting(DEFAULT_ENTRY, target, settingName, value);
}

const table = (name: string): ElementIdentifier => ({ kind: SymbolKind.Table, table: name });

describe('updateElementSetting - table', () => {
  it('adds a setting to a table with no settings', () => {
    const dbml = 'Table users {\n  id int\n}';
    const result = update(dbml, table('users'), 'headercolor', '#FF0000');
    expect(result).toContain('[headercolor: #FF0000]');
  });

  it('updates an existing setting on a table', () => {
    const dbml = 'Table users [headercolor: #000000] {\n  id int\n}';
    const result = update(dbml, table('users'), 'headercolor', '#FF0000');
    expect(result).toContain('headercolor: #FF0000');
    expect(result).not.toContain('#000000');
  });

  it('removes a setting when value is null', () => {
    const dbml = 'Table users [headercolor: #FF0000] {\n  id int\n}';
    const result = update(dbml, table('users'), 'headercolor', null);
    expect(result).not.toContain('headercolor');
    expect(result).not.toContain('#FF0000');
  });

  it('returns original source when setting to remove does not exist', () => {
    const dbml = 'Table users {\n  id int\n}';
    const result = update(dbml, table('users'), 'headercolor', null);
    expect(result).toBe(dbml);
  });

  it('returns original source when target element is not found', () => {
    const dbml = 'Table users {\n  id int\n}';
    const result = update(dbml, table('nonexistent'), 'headercolor', '#FF0000');
    expect(result).toBe(dbml);
  });

  it('works with a structured TableIdentifier with explicit kind', () => {
    const dbml = 'Table users {\n  id int\n}';
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'headercolor', '#FF0000');
    expect(result).toContain('[headercolor: #FF0000]');
  });

  // TODO: schema-qualified lookup needs investigation
  it.skip('works with a schema-qualified identifier', () => {
    const dbml = 'Schema myschema {\n  Table users {\n    id int\n  }\n}';
    const result = update(dbml, { kind: SymbolKind.Table, schema: 'myschema', table: 'users' }, 'headercolor', '#FF0000');
    expect(result).toContain('[headercolor: #FF0000]');
  });
});

describe('updateElementSetting - name-only setting', () => {
  it('adds a name-only setting when value is undefined', () => {
    const dbml = 'Table users {\n  id int\n}';
    const result = update(dbml, table('users'), 'pk', undefined);
    expect(result).toMatch(/\[pk\]/);
  });
});

describe('updateElementSetting - table with multiple settings', () => {
  it('removes one setting and keeps the other', () => {
    const dbml = 'Table users [headercolor: #FF0000, note: \'test\'] {\n  id int\n}';
    const result = update(dbml, table('users'), 'headercolor', null);
    expect(result).not.toContain('headercolor');
    expect(result).toContain('note');
  });

  it('updates one setting among multiple', () => {
    const dbml = 'Table users [headercolor: #FF0000, note: \'test\'] {\n  id int\n}';
    const result = update(dbml, table('users'), 'headercolor', '#00FF00');
    expect(result).toContain('headercolor: #00FF00');
    expect(result).toContain('note');
  });
});

describe('updateElementSetting - tablegroup', () => {
  it('adds a setting to a tablegroup', () => {
    const dbml = 'Table users {\n  id int\n}\nTableGroup mygroup {\n  users\n}';
    const result = update(dbml, { kind: SymbolKind.TableGroup, name: 'mygroup' }, 'color', '#FF0000');
    expect(result).toContain('color: #FF0000');
  });
});

describe('updateElementSetting - enum', () => {
  it('adds a setting to an enum', () => {
    const dbml = 'Enum status {\n  active\n  inactive\n}';
    const result = update(dbml, { kind: SymbolKind.Enum, name: 'status' }, 'note', '\'Status enum\'');
    expect(result).toContain('note');
  });
});
