import { describe, expect, test } from 'vitest';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - schema-alias ref', () => {
  // tables.dbml: Table ecommerce.users as EU { id int [pk]; name varchar }
  // main.dbml:   use { table ecommerce.users as EU } from './tables.dbml'
  //              Table orders { id int [pk]; user_id int [ref: > EU.id] }
  const { compiler } = setupCompiler({
    '/tables.dbml': `
Table ecommerce.users as EU {
  id int [pk]
  name varchar
}
`,
    '/main.dbml': `
use { table ecommerce.users as EU } from './tables.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > EU.id]
}
`,
  });

  test('no binding errors - inline ref binds against the alias', () => {
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('alias EU appears as a table in exported schema; schema prefix is stripped', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const eu = db.tables.find((t) => t.name === 'EU');

    expect(eu).toBeDefined();
    expect(eu!.schemaName).toBe('');
  });

  test('original schema-qualified name is not separately exposed', () => {
    const db = getDatabase(compiler, '/main.dbml');
    // expect: "users" (with or without schema) is not directly in main's table list
    expect(db.tables.find((t) => t.name === 'users')).toBeUndefined();
  });

  test('inline ref on orders.user_id resolves to EU', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const orders = db.tables.find((t) => t.name === 'orders')!;
    const userIdField = orders.fields.find((f) => f.name === 'user_id')!;
    // expect: [ref: > EU.id] captured as inline_ref targeting EU
    const ref = userIdField.inline_refs[0];
    expect(ref.tableName).toBe('EU');
    expect(ref.fieldNames).toContain('id');
    expect(ref.relation).toBe('>');
  });
});


describe('[example] multifile interpreter - alias-and-schema-strip', () => {
  // auth-tables.dbml: Table auth.users { id int [pk]; email varchar }
  // main.dbml:        use { table auth.users as u } from './auth-tables.dbml'
  //                   Table orders { id int [pk]; user_id int [ref: > u.id] }
  const { compiler } = setupCompiler({
    '/auth-tables.dbml': `
Table auth.users {
  id int [pk]
  email varchar
}
`,
    '/main.dbml': `
use { table auth.users as u } from './auth-tables.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > u.id]
}
`,
  });

  test('no binding errors - inline ref binds against alias u', () => {
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('alias u appears without schema prefix in exported schema', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const u = db.tables.find((t) => t.name === 'u');
    // expect: visible as "u" with no schemaName
    expect(u).toBeDefined();
    expect(u!.schemaName).toBe('');
  });

  test('original auth.users is not directly exposed', () => {
    const db = getDatabase(compiler, '/main.dbml');
    // expect: original "users" (with or without "auth" schema) is not separately present
    expect(db.tables.find((t) => t.name === 'users')).toBeUndefined();
  });

  test('inline ref on orders.user_id points to u', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const orders = db.tables.find((t) => t.name === 'orders')!;
    const ref = orders.fields.find((f) => f.name === 'user_id')!.inline_refs[0];
    // expect: [ref: > u.id] - tableName is the alias, not the original
    expect(ref.tableName).toBe('u');
    expect(ref.fieldNames).toContain('id');
  });
});


describe('[example] multifile interpreter - schema merging: tables under same named schema', () => {
  // File A contributes auth.users; File B contributes auth.posts.
  // Consumer imports from both and both should appear under the auth schema.
  const { compiler } = setupCompiler({
    '/users-db.dbml': `
Table auth.users {
  id int [pk]
  email varchar
}
`,
    '/posts-db.dbml': `
Table auth.posts {
  id int [pk]
  user_id int
}
`,
    '/consumer.dbml': `
use { table auth.users } from './users-db.dbml'
use { table auth.posts } from './posts-db.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both auth.users and auth.posts appear in exported tables', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const names = db.tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('posts');
  });

  test('both tables carry schemaName "auth"', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((t) => t.name === 'users')!;
    const posts = db.tables.find((t) => t.name === 'posts')!;
    expect(users.schemaName).toBe('auth');
    expect(posts.schemaName).toBe('auth');
  });
});


describe('[example] multifile interpreter - transitive schema import (a -> b -> c)', () => {
  // c.dbml: defines Table x.c
  // b.dbml: imports schema x from c, defines Table x.b
  // a.dbml: imports schema x from b - should pull in both x.b and x.c transitively
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table x.c {
  id int
}
`,
    '/b.dbml': `
use { schema x } from './c.dbml'

Table x.b {
  id int
}
`,
    '/a.dbml': `
use { schema x } from './b.dbml'
`,
  });

  test('no errors when interpreting a.dbml', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('x.b is present in a.dbml schema', () => {
    const db = getDatabase(compiler, '/a.dbml');
    const table = db.tables.find((t) => t.name === 'b' && t.schemaName === 'x');
    expect(table).toBeDefined();
  });

  test('x.c is NOT transitively present (use is local-only, not transitive)', () => {
    const db = getDatabase(compiler, '/a.dbml');
    const table = db.tables.find((t) => t.name === 'c' && t.schemaName === 'x');
    expect(table).toBeUndefined();
  });
});

describe('[example] multifile interpreter - transitive schema import with ref in entrypoint errors', () => {
  // a.dbml imports schema x from b, which imports x from c
  // a.dbml declares a Ref between x.b and x.c - x.c is not transitively visible, so should error
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table x.c {
  id int [pk]
}
`,
    '/b.dbml': `
use { schema x } from './c.dbml'

Table x.b {
  id int [pk]
}
`,
    '/a.dbml': `
use { schema x } from './b.dbml'

Ref: x.b.id > x.c.id
`,
  });

  test('Ref between x.b and x.c errors because x.c is not in scope', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors().length).toBeGreaterThan(0);
  });
});

describe('[example] multifile interpreter - transitive schema import via reuse allows cross-ref', () => {
  // Same topology but b.dbml uses `reuse` so x.c is pulled into b and transitively into a
  // Ref: x.b.id > x.c.id in a.dbml should resolve without error
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table x.c {
  id int [pk]
}
`,
    '/b.dbml': `
reuse { schema x } from './c.dbml'

Table x.b {
  id int [pk]
}
`,
    '/a.dbml': `
use { schema x } from './b.dbml'

Ref: x.b.id > x.c.id
`,
  });

  test('no errors - x.c transitively reachable via reuse', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('x.c present in a.dbml schema', () => {
    const db = getDatabase(compiler, '/a.dbml');
    const table = db.tables.find((t) => t.name === 'c' && t.schemaName === 'x');
    expect(table).toBeDefined();
  });
});

describe('[example] use { schema public } pulls tables and records from external file', () => {
  const { compiler } = setupCompiler({
    '/a.dbml': `
Table "v" {
  id int
  abc CLOB

  indexes {
    id
  }
}

Records "v"(id) {
  1
  2
  3
}
`,
    '/main.dbml': `
use { schema public } from './a.dbml'
`,
  });

  test('table v is pulled into main', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.tables.find((t) => t.name === 'v')).toBeDefined();
  });

  test('table v has correct fields', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const v = db.tables.find((t) => t.name === 'v')!;
    expect(v.fields.map((f) => f.name)).toEqual(['id', 'abc']);
  });

  test('records for v are present', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.records.length).toBeGreaterThan(0);
  });

  test('indexes on v are present', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const v = db.tables.find((t) => t.name === 'v')!;
    expect(v.indexes.length).toBeGreaterThan(0);
  });
});

describe('[example] wildcard import pulls tables from reuse { schema public } chain', () => {
  const { compiler } = setupCompiler({
    '/nested.dbml': `
Table R [note: 'this is R'] {
  id int
  r BFILE
}
Table G [note: 'this is G'] {
  id int
  g CLOB
}
`,
    '/direct.dbml': `
reuse { schema public } from './nested.dbml'
use { schema public } from './nested.dbml'
`,
    '/main.dbml': `
use * from './direct.dbml'

Ref: R.id > R.r
`,
  });

  test('tables R and G pulled into main via wildcard + reuse schema chain', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.tables.find((t) => t.name === 'R')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'G')).toBeDefined();
  });

  test('ref between R columns resolves', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });
});


describe('[stress] schema-qualified table with ref auto-pull', () => {
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table auth.users {
  id int [pk]
  name varchar
}
Table auth.orders {
  id int [pk]
  user_id int
}
Ref: auth.orders.user_id > auth.users.id
`,
    '/consumer.dbml': `
use { table auth.users } from './source.dbml'
use { table auth.orders } from './source.dbml'
`,
  });

  test('both schema-qualified tables present', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 'users' && t.schemaName === 'auth')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'orders' && t.schemaName === 'auth')).toBeDefined();
  });

  test('ref between schema-qualified tables is auto-pulled', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
  });
});


describe('[stress] aliased schema-qualified table in ref', () => {
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table auth.users {
  id int [pk]
}
Table auth.orders {
  id int [pk]
  user_id int
}
Ref: auth.orders.user_id > auth.users.id
`,
    '/consumer.dbml': `
use { table auth.users as u } from './source.dbml'
use { table auth.orders as o } from './source.dbml'
`,
  });

  test('ref endpoints use alias names', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    const ordersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('user_id'))!;
    expect(usersEp.tableName).toBe('u');
    expect(ordersEp.tableName).toBe('o');
  });
});


describe('[stress] wildcard from two files with overlapping schemas', () => {
  const { compiler } = setupCompiler({
    '/a.dbml': `
Table auth.users {
  id int [pk]
  name varchar
}
`,
    '/b.dbml': `
Table auth.roles {
  id int [pk]
  label varchar
}
`,
    '/consumer.dbml': `
use * from './a.dbml'
use * from './b.dbml'
`,
  });

  test('both tables under auth schema present', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    const roles = db.tables.find((t) => t.name === 'roles');
    expect(users).toBeDefined();
    expect(roles).toBeDefined();
    expect(users!.schemaName).toBe('auth');
    expect(roles!.schemaName).toBe('auth');
  });
});
