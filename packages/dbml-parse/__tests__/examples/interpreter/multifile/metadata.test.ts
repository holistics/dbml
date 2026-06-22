import { describe, expect, test } from 'vitest';
import { getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - auto-imported metadata', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
Metadata Table public.users {
  owner: 'scott'
}
`,
    '/main.dbml': `
use { table public.users } from './base.dbml'
`,
  });

  test('metadata travels with its target table without an explicit metadata import', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const meta = db.metadataElements.find((m) => m.target.name.at(-1) === 'users' && m.target.kind === 'table');
    expect(meta).toBeDefined();
    expect(meta!.values.owner).toBe('scott');
  });

  test('metadata is still emitted in the file that declares it', () => {
    const db = getDatabase(compiler, '/base.dbml');
    const meta = db.metadataElements.find((m) => m.target.name.at(-1) === 'users' && m.target.kind === 'table');
    expect(meta).toBeDefined();
    expect(meta!.values.owner).toBe('scott');
  });
});

describe('[example] multifile interpreter - unreachable metadata/records are not emitted', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
`,
    // Declares metadata + records for users, but is NOT imported by main.dbml.
    '/extra.dbml': `
use { table public.users } from './base.dbml'
Metadata Table public.users {
  owner: 'scott'
}
records users(id) {
  1
}
`,
    '/main.dbml': `
use { table public.users } from './base.dbml'
`,
  });

  test('metadata declared in an unreachable file is excluded', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const meta = db.metadataElements.find((m) => m.target.name.at(-1) === 'users' && m.target.kind === 'table');
    expect(meta).toBeUndefined();
  });

  test('records declared in an unreachable file are excluded', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const rec = db.records.find((r) => r.tableName === 'users');
    expect(rec).toBeUndefined();
  });

  test('the file declaring them still emits both', () => {
    const db = getDatabase(compiler, '/extra.dbml');
    expect(db.metadataElements.find((m) => m.target.name.at(-1) === 'users')).toBeDefined();
    expect(db.records.find((r) => r.tableName === 'users')).toBeDefined();
  });
});
