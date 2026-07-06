import { describe, expect, test } from 'vitest';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[example] use + reuse same symbol, reuse makes it transitive', () => {
  const { compiler } = setupCompiler({
    '/b.dbml': `
Table t {
  id int [pk]
}
`,
    '/a.dbml': `
use { table t } from './b.dbml'
reuse { table t } from './b.dbml'
`,
    '/c.dbml': `
use { table t } from './a.dbml'
`,
  });

  test('use+reuse file exports the table', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 't')).toBeDefined();
  });

  test('downstream file sees the table via transitive reuse', () => {
    const db = getDatabase(compiler, '/c.dbml');
    expect(db.tables.find((t) => t.name === 't')).toBeDefined();
  });
});

describe('[example] use original + reuse alias, only alias is transitive', () => {
  const { compiler } = setupCompiler({
    '/b.dbml': `
Table users {
  id int [pk]
  email varchar
}
`,
    '/a.dbml': `
use { table users } from './b.dbml'
reuse { table users as u } from './b.dbml'
`,
    '/c.dbml': `
use { table u } from './a.dbml'
`,
  });

  test('reuse alias is visible in declaring file', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'u')).toBeDefined();
  });

  test('reuse alias is transitively visible downstream', () => {
    const db = getDatabase(compiler, '/c.dbml');
    expect(db.tables.find((t) => t.name === 'u')).toBeDefined();
  });

  test('use-only original name is not visible downstream', () => {
    const db = compiler.interpretFile(fp('/c.dbml')).getValue()!;
    expect(db.tables.find((t) => t.name === 'users')).toBeUndefined();
  });
});

describe('[example] transitive wildcard reuse', () => {
  const { compiler } = setupCompiler({
    '/c.dbml': 'Table t1 { id int [pk] }',
    '/b.dbml': `
reuse * from './c.dbml'
Table t2 { id int [pk] }
`,
    '/a.dbml': "use * from './b.dbml'",
  });

  test('wildcard import includes direct table from source', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 't2')).toBeDefined();
  });

  test('wildcard import includes table re-exported via reuse', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 't1')).toBeDefined();
  });
});

describe('[example] transitive wildcard use is NOT transitive', () => {
  const { compiler } = setupCompiler({
    '/c.dbml': 'Table t1 { id int [pk] }',
    '/b.dbml': `
use * from './c.dbml'
Table t2 { id int [pk] }
`,
    '/a.dbml': "use * from './b.dbml'",
  });

  test('wildcard import includes direct table from source', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 't2')).toBeDefined();
  });

  test('wildcard use does not re-export tables from upstream', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 't1')).toBeUndefined();
  });
});

describe('[example] same real name via 2 paths deduplicates', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk]\n  email varchar\n}',
    '/alt.dbml': "reuse { table users } from './base.dbml'",
    '/main.dbml': `
use { table users } from './base.dbml'
use { table users } from './alt.dbml'
`,
  });

  test('importing same table from two paths produces no errors', () => {
    expect(compiler.interpretFile(fp('/main.dbml')).getErrors()).toHaveLength(0);
  });

  test('deduplicates to single table in output', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.tables.filter((t) => t.name === 'users')).toHaveLength(1);
  });

  test('deduplicated table preserves all fields', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.tables.find((t) => t.name === 'users')!.fields.map((f) => f.name)).toEqual(['id', 'email']);
  });
});

describe('[example] same symbol via 2 paths, refs to both names, duplicate ref error', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }\nTable orders { id int [pk]\n  user_id int\n}',
    '/alt.dbml': "reuse { table users } from './base.dbml'",
    '/main.dbml': `
use { table users } from './base.dbml'
use { table users as u } from './alt.dbml'
use { table orders } from './base.dbml'

Ref: orders.user_id > users.id
Ref: orders.user_id > u.id
`,
  });

  test('refs to same original table via real name and alias produce duplicate error', () => {
    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors.some((e) => e.message === 'References with same endpoints exist')).toBe(true);
  });
});

describe('[example] same symbol via 2 names, refs to different endpoints, no error', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users { id int [pk] }
Table orders { id int [pk]\n  user_id int }
Table invoices { id int [pk]\n  user_id int }
`,
    '/alt.dbml': "reuse { table users } from './base.dbml'",
    '/main.dbml': `
use { table users } from './base.dbml'
use { table users as u } from './alt.dbml'
use { table orders } from './base.dbml'
use { table invoices } from './base.dbml'

Ref: orders.user_id > users.id
Ref: invoices.user_id > u.id
`,
  });

  test('refs with different source tables but same target original produce no error', () => {
    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('both refs emitted in output', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.refs).toHaveLength(2);
  });
});
