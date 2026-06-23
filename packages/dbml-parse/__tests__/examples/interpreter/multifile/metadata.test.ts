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

  // NOTE: the precise warning code (e.g. DUPLICATE_METADATA_KEY_ACROSS_BLOCKS)
  // is not introduced yet; the source implementer must add it. We assert
  // structurally that a warning IS emitted and the within-block hard error is
  // NOT present.
  test('emits a cross-file duplicate-key warning, retains last-write-wins value', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));

    expect(result.getWarnings().length).toBeGreaterThanOrEqual(1);
    const errorCodes = result.getErrors().map((e) => e.code);
    expect(errorCodes).not.toContain(CompileErrorCode.DUPLICATE_METADATA_FIELD);

    const db = result.getValue()!;
    const metas = db.metadataElements.filter(
      (m) => m.target.name.at(-1) === 'users' && m.target.kind === 'table',
    );
    // Both blocks are retained as separate elements (nothing dropped). base.dbml's
    // #aaa is the earlier/imported block, main.dbml's #f00 is applied last.
    expect(metas.map((m) => m.values.color)).toEqual(['#aaa', '#f00']);
    expect(metas.at(-1)!.values.color).toBe('#f00');
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
