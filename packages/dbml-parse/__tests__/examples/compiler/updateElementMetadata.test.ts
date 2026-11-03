import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import { SymbolKind } from '@/core/types/symbol';
import { type TypedValue } from '@/compiler/queries/utils';
import type { ElementIdentifier } from '@/compiler/queries/transform/types';

function update (dbml: string, target: ElementIdentifier, key: string, value: TypedValue | null) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbml);
  const compiler = new Compiler(layout);
  return compiler.updateElementMetadata(DEFAULT_ENTRY, target, key, value);
}

const TABLE = `Table users {
  id int
  name varchar
}`;

const TABLE_WITH_META = `Table users {
  id int
  name varchar
}

Metadata Table users {
  label: "User"
}`;

describe('updateElementMetadata - table, no existing block', () => {
  it('creates a Metadata block when none exists', () => {
    const result = update(TABLE, { kind: SymbolKind.Table, table: 'users' }, 'label', 'User');
    expect(result).toContain('Metadata Table users');
    expect(result).toContain("label: 'User'");
  });

  it('does nothing when removing a key from a non-existent block', () => {
    const result = update(TABLE, { kind: SymbolKind.Table, table: 'users' }, 'label', null);
    expect(result).toBe(TABLE);
  });
});

describe('updateElementMetadata - table, existing block', () => {
  it('updates an existing key in the block', () => {
    const result = update(TABLE_WITH_META, { kind: SymbolKind.Table, table: 'users' }, 'label', 'Person');
    expect(result).toContain("label: 'Person'");
    expect(result).not.toContain('User');
  });

  it('adds a new key to an existing block', () => {
    const result = update(TABLE_WITH_META, { kind: SymbolKind.Table, table: 'users' }, 'description', 'A user');
    expect(result).toContain('label: "User"');
    expect(result).toContain("description: 'A user'");
  });

  it('removes the key when value is null and other keys remain', () => {
    const dbml = `Table users {
  id int
}

Metadata Table users {
  label: "User"
  description: "A user"
}`;
    const result = update(dbml, { kind: SymbolKind.Table, table: 'users' }, 'label', null);
    expect(result).not.toContain('label');
    expect(result).toContain('description: "A user"');
  });

  it('removes the entire block when the last key is removed', () => {
    const result = update(TABLE_WITH_META, { kind: SymbolKind.Table, table: 'users' }, 'label', null);
    expect(result).not.toContain('Metadata');
    expect(result).not.toContain('label');
  });

  it('does nothing when removing a key that does not exist in the block', () => {
    const result = update(TABLE_WITH_META, { kind: SymbolKind.Table, table: 'users' }, 'nonexistent', null);
    expect(result).toBe(TABLE_WITH_META);
  });
});

describe('updateElementMetadata - schema-qualified table', () => {
  const SCHEMA_TABLE = `Table myschema.users {
  id int
}`;

  it('creates a Metadata block with schema-qualified name', () => {
    const result = update(SCHEMA_TABLE, { kind: SymbolKind.Table, schema: 'myschema', table: 'users' }, 'label', 'User');
    expect(result).toContain('Metadata Table myschema.users');
    expect(result).toContain("label: 'User'");
  });
});

describe('updateElementMetadata - column', () => {
  it('creates a Metadata Column block', () => {
    const result = update(TABLE, { kind: SymbolKind.Column, table: 'users', column: 'id' }, 'label', 'ID');
    expect(result).toContain('Metadata Column users.id');
    expect(result).toContain("label: 'ID'");
  });

  it('updates an existing key in a Metadata Column block', () => {
    const dbml = `${TABLE}

Metadata Column users.id {
  label: "ID"
}`;
    const result = update(dbml, { kind: SymbolKind.Column, table: 'users', column: 'id' }, 'label', 'Identifier');
    expect(result).toContain("label: 'Identifier'");
    expect(result).not.toContain('ID');
  });

  it('removes the entire Column block when the last key is removed', () => {
    const dbml = `${TABLE}

Metadata Column users.id {
  label: "ID"
}`;
    const result = update(dbml, { kind: SymbolKind.Column, table: 'users', column: 'id' }, 'label', null);
    expect(result).not.toContain('Metadata Column');
    expect(result).not.toContain('label');
  });
});

describe('updateElementMetadata - tablegroup', () => {
  const DBML = `Table users {
  id int
}
TableGroup mygroup {
  users
}`;

  it('creates a Metadata TableGroup block', () => {
    const result = update(DBML, { kind: SymbolKind.TableGroup, name: 'mygroup' }, 'label', 'My Group');
    expect(result).toContain('Metadata TableGroup mygroup');
    expect(result).toContain("label: 'My Group'");
  });

  it('removes the block when the last key is removed', () => {
    const dbml = `${DBML}

Metadata TableGroup mygroup {
  label: "My Group"
}`;
    const result = update(dbml, { kind: SymbolKind.TableGroup, name: 'mygroup' }, 'label', null);
    expect(result).not.toContain('Metadata TableGroup');
  });
});

describe('updateElementMetadata - note (StickyNote)', () => {
  const DBML = `Note mynote {
  'Some note'
}`;

  it('creates a Metadata Note block', () => {
    const result = update(DBML, { kind: SymbolKind.StickyNote, name: 'mynote' }, 'label', 'My Note');
    expect(result).toContain('Metadata Note mynote');
    expect(result).toContain("label: 'My Note'");
  });
});

describe('updateElementMetadata - unsupported element kind', () => {
  it('returns original source for an unsupported kind', () => {
    const result = update(TABLE, { kind: SymbolKind.Enum, name: 'status' } as ElementIdentifier, 'label', '"x"');
    expect(result).toBe(TABLE);
  });
});
