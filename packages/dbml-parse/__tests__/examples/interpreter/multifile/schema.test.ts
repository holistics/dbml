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

describe('[example] use { schema auth as a } pulls tables under alias', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table auth.users { id int [pk]\n  email varchar }
Table auth.posts { id int [pk]\n  title varchar }
`,
    '/main.dbml': `
use { schema auth as a } from './base'
`,
  });

  test('alias schema has both tables', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.tables.find((t) => t.name === 'users')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'posts')).toBeDefined();
  });

  test('tables accessible via alias schema name in refs', () => {
    const { compiler: c2 } = setupCompiler({
      '/base.dbml': `
Table auth.users { id int [pk] }
Table auth.posts { id int [pk]\n  user_id int }
`,
      '/main.dbml': `
use { schema auth as a } from './base'
Ref: a.posts.user_id > a.users.id
`,
    });
    const result = c2.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    expect(result.getValue()!.refs).toHaveLength(1);
  });

  test('original schema name not directly accessible', () => {
    const { compiler: c3 } = setupCompiler({
      '/base.dbml': 'Table auth.users { id int [pk] }',
      '/main.dbml': `
use { schema auth as a } from './base'
Ref: auth.users.id > auth.users.id
`,
    });
    const result = c3.interpretFile(fp('/main.dbml'));
    expect(result.getErrors().length).toBeGreaterThan(0);
  });
});

describe('[example] two schema aliases to same name merge into one schema', () => {
  const { compiler } = setupCompiler({
    '/a.dbml': `
Table t { id int [pk] }
Table x.g { id int [pk] }
`,
    '/main.dbml': `
use { schema public as a } from './a.dbml'
use { schema x as a } from './a.dbml'
`,
  });

  test('no errors', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('schema a contains tables from both public and x', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.tables.find((t) => t.name === 't' && t.schemaName === 'a')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'g' && t.schemaName === 'a')).toBeDefined();
  });

  test('refs work across merged schemas', () => {
    const { compiler: c2 } = setupCompiler({
      '/a.dbml': `
Table t { id int [pk] }
Table x.g { id int [pk]\n  t_id int }
`,
      '/main.dbml': `
use { schema public as a } from './a.dbml'
use { schema x as a } from './a.dbml'
Ref: a.g.t_id > a.t.id
`,
    });
    const result = c2.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    expect(result.getValue()!.refs).toHaveLength(1);
  });
});

describe('[example] same symbol in multiple schemas via wildcard + aliased schema import, no duplicates', () => {
  const { compiler } = setupCompiler({
    '/nested.dbml': `
Enum status {
  active
  inactive
}
Table t { id int [pk]\n  s status }
`,
    '/direct.dbml': "reuse { schema public } from './nested.dbml'",
    '/main.dbml': `
use * from './direct.dbml'
use { schema public as nested } from './nested.dbml'
`,
  });

  test('no errors', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('enum appears only once in output', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const statuses = db.enums.filter((e) => e.name === 'status');
    expect(statuses).toHaveLength(1);
  });

  test('table appears only once in output', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const tables = db.tables.filter((t) => t.name === 't');
    expect(tables).toHaveLength(1);
  });
});

describe('[example] use { schema public } merges wildcard-reused tables transitively', () => {
  // a.dbml imports schema public from b.
  // b.dbml has `reuse * from './c'` (wildcard) and `use * from './a'`, plus Table T.
  // c.dbml defines Table E.
  // Ref T.id > E.id in a.dbml should resolve because E is reused into b via wildcard.
  const { compiler } = setupCompiler({
    '/a.dbml': `
use { schema public } from './b'

Ref: T.id > E.id
`,
    '/b.dbml': `
reuse * from './c'
use * from './a'

Table T {
  id int
}
`,
    '/c.dbml': `
Table E {
  id int
}
`,
  });

  test('no errors when interpreting a.dbml', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('Table T is present in a.dbml', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T')).toBeDefined();
  });

  test('Table E is present in a.dbml (via wildcard reuse chain)', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'E')).toBeDefined();
  });
});

describe('[example] chained wildcard reuse through schema merge (a -> b -> c -> d)', () => {
  // d.dbml defines Table T3.
  // c.dbml wildcard-reuses d.
  // b.dbml wildcard-reuses c, defines Table T2.
  // a.dbml imports schema public from b - should pull in T2 and T3 transitively.
  const { compiler } = setupCompiler({
    '/d.dbml': `
Table T3 {
  id int [pk]
}
`,
    '/c.dbml': `
reuse * from './d'
`,
    '/b.dbml': `
reuse * from './c'

Table T2 {
  id int [pk]
}
`,
    '/a.dbml': `
use { schema public } from './b'

Ref: T2.id > T3.id
`,
  });

  test('no errors when interpreting a.dbml', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('T2 is present', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T2')).toBeDefined();
  });

  test('T3 is present via chained wildcard reuse', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T3')).toBeDefined();
  });
});

describe('[example] non-public schema with wildcard reuse through schema merge', () => {
  // c.dbml defines Table auth.roles.
  // b.dbml wildcard-reuses c, defines Table auth.users.
  // a.dbml imports schema auth from b - should pull both auth.users and auth.roles.
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table auth.roles {
  id int [pk]
}
`,
    '/b.dbml': `
reuse * from './c'

Table auth.users {
  id int [pk]
}
`,
    '/a.dbml': `
use { schema auth } from './b'

Ref: auth.users.id > auth.roles.id
`,
  });

  test('no errors when interpreting a.dbml', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('auth.users is present', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'users' && t.schemaName === 'auth')).toBeDefined();
  });

  test('auth.roles is present via wildcard reuse', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'roles' && t.schemaName === 'auth')).toBeDefined();
  });
});

describe('[example] wildcard reuse from multiple files through schema merge', () => {
  // c.dbml defines Table T1.
  // d.dbml defines Table T2.
  // b.dbml wildcard-reuses both c and d.
  // a.dbml imports schema public from b - should pull T1 and T2.
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table T1 {
  id int [pk]
}
`,
    '/d.dbml': `
Table T2 {
  id int [pk]
}
`,
    '/b.dbml': `
reuse * from './c'
reuse * from './d'
`,
    '/a.dbml': `
use { schema public } from './b'

Ref: T1.id > T2.id
`,
  });

  test('no errors when interpreting a.dbml', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('T1 present via wildcard reuse from c', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T1')).toBeDefined();
  });

  test('T2 present via wildcard reuse from d', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T2')).toBeDefined();
  });
});

describe('[example] mixed selective and wildcard reuses through schema merge', () => {
  // c.dbml defines Table T_wild.
  // d.dbml defines Table T_sel.
  // b.dbml has `reuse * from './c'` (wildcard) and `reuse { table T_sel } from './d'` (selective).
  // a.dbml imports schema public from b — should pull both.
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table T_wild {
  id int [pk]
}
`,
    '/d.dbml': `
Table T_sel {
  id int [pk]
}
`,
    '/b.dbml': `
reuse * from './c'
reuse { table T_sel } from './d'
`,
    '/a.dbml': `
use { schema public } from './b'

Ref: T_wild.id > T_sel.id
`,
  });

  test('no errors when interpreting a.dbml', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('T_wild present via wildcard reuse', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T_wild')).toBeDefined();
  });

  test('T_sel present via selective reuse', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T_sel')).toBeDefined();
  });
});

describe('[example] use-only wildcard is NOT transitive through schema merge', () => {
  // c.dbml defines Table E.
  // b.dbml has `use * from './c'` (NOT reuse), defines Table T.
  // a.dbml imports schema public from b - should see T but NOT E.
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table E {
  id int [pk]
}
`,
    '/b.dbml': `
use * from './c'

Table T {
  id int [pk]
}
`,
    '/a.dbml': `
use { schema public } from './b'
`,
  });

  test('T is present', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'T')).toBeDefined();
  });

  test('E is NOT present (use is local-only, not transitive)', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'E')).toBeUndefined();
  });
});

describe('[example] nested schema import places members under correct schema', () => {
  // base.dbml defines Table x.y.t1.
  // main.dbml imports schema x.y from base — t1 should be under schema x.y, not x.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table x.y.t1 {
  id int [pk]
}
`,
    '/main.dbml': `
use { schema x.y } from './base'
`,
  });

  test('no errors when interpreting main.dbml', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('t1 appears under schema x.y', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const t1 = db.tables.find((t) => t.name === 't1');
    expect(t1).toBeDefined();
    expect(t1!.schemaName).toBe('x.y');
  });
});

describe('[example] nested schema import with ref resolution', () => {
  // base.dbml defines Table x.y.users and Table x.y.orders.
  // main.dbml imports schema x.y from base, then uses a ref between them.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table x.y.users {
  id int [pk]
}
Table x.y.orders {
  id int [pk]
  user_id int
}
`,
    '/main.dbml': `
use { schema x.y } from './base'

Ref: x.y.orders.user_id > x.y.users.id
`,
  });

  test('no errors when interpreting main.dbml', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('ref resolves across nested-schema imported tables', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.refs).toHaveLength(1);
  });
});

describe('[example] nested schema with wildcard reuse through schema merge', () => {
  // c.dbml defines Table x.y.deep.
  // b.dbml wildcard-reuses c, defines Table x.y.local.
  // a.dbml imports schema x.y from b — should pull both.
  const { compiler } = setupCompiler({
    '/c.dbml': `
Table x.y.deep {
  id int [pk]
}
`,
    '/b.dbml': `
reuse * from './c'

Table x.y.local {
  id int [pk]
}
`,
    '/a.dbml': `
use { schema x.y } from './b'

Ref: x.y.local.id > x.y.deep.id
`,
  });

  test('no errors when interpreting a.dbml', () => {
    const result = compiler.interpretFile(fp('/a.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('x.y.local is present', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'local' && t.schemaName === 'x.y')).toBeDefined();
  });

  test('x.y.deep is present via wildcard reuse', () => {
    const db = getDatabase(compiler, '/a.dbml');
    expect(db.tables.find((t) => t.name === 'deep' && t.schemaName === 'x.y')).toBeDefined();
  });
});

describe('[example] reuse * from file with reuse { schema x as y } merges to aliased schema', () => {
  // base.dbml has Table x.t1 and Table x.t2.
  // mid.dbml reuses schema x aliased as y.
  // consumer.dbml does reuse * from mid — should see t1 and t2 under schema y.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table x.t1 {
  id int [pk]
}
Table x.t2 {
  id int [pk]
  t1_id int
}
`,
    '/mid.dbml': `
reuse { schema x as y } from './base'
`,
    '/consumer.dbml': `
reuse * from './mid'

Ref: y.t2.t1_id > y.t1.id
`,
  });

  test('no errors', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('t1 under aliased schema y', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 't1' && t.schemaName === 'y')).toBeDefined();
  });

  test('t2 under aliased schema y', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 't2' && t.schemaName === 'y')).toBeDefined();
  });

  test('ref resolves through aliased schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
  });
});

describe('[example] reuse * from file with use { schema x as y } does NOT merge (use is local-only)', () => {
  // mid.dbml uses `use` (not reuse), so the alias is local — not transitively visible.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table x.t1 {
  id int [pk]
}
`,
    '/mid.dbml': `
use { schema x as y } from './base'
`,
    '/consumer.dbml': `
reuse * from './mid'
`,
  });

  test('no errors', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('t1 is NOT present (use is local-only)', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 't1')).toBeUndefined();
  });
});

describe('[example] chained reuse * preserves aliased schema transitively', () => {
  // base -> mid (reuse schema alias) -> consumer (reuse *) -> final (use schema y)
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table x.t1 {
  id int [pk]
}
`,
    '/mid.dbml': `
reuse { schema x as y } from './base'
`,
    '/consumer.dbml': `
reuse * from './mid'
`,
    '/final.dbml': `
use { schema y } from './consumer'
`,
  });

  test('no errors', () => {
    const result = compiler.interpretFile(fp('/final.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('t1 under aliased schema y in final', () => {
    const db = getDatabase(compiler, '/final.dbml');
    expect(db.tables.find((t) => t.name === 't1' && t.schemaName === 'y')).toBeDefined();
  });
});

