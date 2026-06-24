import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import { getDatabase, setupCompiler, fp } from './utils';

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
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'scott' });
  });

  test('metadata is still attached in the file that declares it', () => {
    const db = getDatabase(compiler, '/base.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'scott' });
  });
});

describe('[example] multifile interpreter - duplicate metadata key across files', () => {
  // base.dbml declares the table + a color; main.dbml imports the table (which
  // carries its metadata) and sets the SAME key again with a different value.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
Metadata Table public.users {
  color: #aaa
}
`,
    '/main.dbml': `
use { table public.users } from './base.dbml'
Metadata Table public.users {
  color: #f00
}
`,
  });

  // Cross-file override is a feature: the compiler merges per-key, last-wins,
  // silently. base.dbml's #aaa is the imported block; main.dbml's #f00 applies last.
  test('merges cross-file duplicate key, last-write-wins, no warning', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));

    expect(result.getWarnings()).toHaveLength(0);
    const errorCodes = result.getErrors().map((e) => e.code);
    expect(errorCodes).not.toContain(CompileErrorCode.DUPLICATE_METADATA_FIELD);

    const db = result.getValue()!;
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ color: '#f00' });
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
    const users = db.tables.find((t) => t.name === 'users');
    // No reachable metadata block, so nothing is attached.
    expect(users?.metadata ?? {}).toEqual({});
  });

  test('records declared in an unreachable file are excluded', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const rec = db.records.find((r) => r.tableName === 'users');
    expect(rec).toBeUndefined();
  });

  test('the file declaring them still emits both', () => {
    const db = getDatabase(compiler, '/extra.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'scott' });
    expect(db.records.find((r) => r.tableName === 'users')).toBeDefined();
  });
});
