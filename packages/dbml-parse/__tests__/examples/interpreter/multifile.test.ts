import {
  describe, expect, test,
} from 'vitest';
import { Compiler } from '@/index';
import { Filepath } from '@/core/types/filepath';
import type { Database } from '@/core/types/schemaJson';

// Build a multi-file compiler from a record of absolute filepath -> source.
function makeCompiler (files: Record<string, string>): { compiler: Compiler; fps: Record<string, Filepath> } {
  const compiler = new Compiler();
  const fps: Record<string, Filepath> = {};
  for (const [path, src] of Object.entries(files)) {
    const fp = Filepath.from(path);
    fps[path] = fp;
    compiler.setSource(fp, src);
  }
  return { compiler, fps };
}

// Interpret a file's full schema including externals imported via `use`.
function exportDb (compiler: Compiler, fp: Filepath): Database {
  const result = compiler.exportSchemaJson(fp);
  expect(result.getErrors()).toHaveLength(0);
  return result.getValue()! as Database;
}


describe('[example] multifile interpreter — enum across files', () => {
  // types.dbml:  Enum job_status { pending running done }
  // main.dbml:   use { enum job_status } from './types.dbml'
  //              Table jobs { id int [pk]; status job_status }
  const { compiler, fps } = makeCompiler({
    '/types.dbml': `
Enum job_status {
  pending
  running
  done
}
`,
    '/main.dbml': `
use { enum job_status } from './types.dbml'

Table jobs {
  id int [pk]
  status job_status
}
`,
  });

  test('no binding errors in consumer', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    // expect: zero binding errors — job_status resolves across file boundary
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported enum appears in exported schema', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    // expect: job_status enum is included as an external in the consumer's schema
    const e = db.enums.find((e) => e.name === 'job_status');
    expect(e).toBeDefined();
  });

  test('imported enum values are preserved', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const e = db.enums.find((e) => e.name === 'job_status')!;
    // expect: all three enum values present, order preserved
    expect(e.values.map((v) => v.name)).toEqual(['pending', 'running', 'done']);
  });

  test('column that uses the imported enum has correct type_name', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const jobs = db.tables.find((t) => t.name === 'jobs')!;
    const statusField = jobs.fields.find((f) => f.name === 'status')!;
    // expect: field type resolves to the imported enum name
    expect(statusField.type.type_name).toBe('job_status');
  });
});


describe('[example] multifile interpreter — enum alias', () => {
  // types.dbml:  Enum job_status { pending running done }
  // main.dbml:   use { enum job_status as Status } from './types.dbml'
  //              Table jobs { id int [pk]; status Status }
  const { compiler, fps } = makeCompiler({
    '/types.dbml': `
Enum job_status {
  pending
  running
  done
}
`,
    '/main.dbml': `
use { enum job_status as Status } from './types.dbml'

Table jobs {
  id int [pk]
  status Status
}
`,
  });

  test('no binding errors — alias is the resolvable name', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('alias name appears in exported schema (original name stripped)', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    // expect: exported under the alias "Status", not "job_status"
    expect(db.enums.find((e) => e.name === 'Status')).toBeDefined();
    expect(db.enums.find((e) => e.name === 'job_status')).toBeUndefined();
  });

  test('enum values are preserved under the alias', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const e = db.enums.find((e) => e.name === 'Status')!;
    expect(e.values.map((v) => v.name)).toEqual(['pending', 'running', 'done']);
  });

  test('column type references the alias name', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const jobs = db.tables.find((t) => t.name === 'jobs')!;
    const statusField = jobs.fields.find((f) => f.name === 'status')!;
    // expect: column type is "Status", the consumer-side alias
    expect(statusField.type.type_name).toBe('Status');
  });
});


describe('[example] multifile interpreter — indexes cross-file', () => {
  // tables.dbml: Table bookings { id, user_id, event_id, created_at
  //                indexes { (user_id, event_id) [unique, name: 'unique_booking']; created_at } }
  // main.dbml:   use { table bookings } from './tables.dbml'
  //              Table events { id int [pk]; name varchar }
  //              Ref: bookings.event_id > events.id
  const { compiler, fps } = makeCompiler({
    '/tables.dbml': `
Table bookings {
  id int [pk]
  user_id int
  event_id int
  created_at timestamp

  indexes {
    (user_id, event_id) [unique, name: 'unique_booking']
    created_at
  }
}
`,
    '/main.dbml': `
use { table bookings } from './tables.dbml'

Table events {
  id int [pk]
  name varchar
}

Ref: bookings.event_id > events.id
`,
  });

  test('no binding errors — cross-file ref resolves', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported table retains both indexes', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const bookings = db.tables.find((t) => t.name === 'bookings')!;
    // expect: both composite and single-column index are preserved
    expect(bookings.indexes).toHaveLength(2);
  });

  test('composite index is unique and carries the declared name', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const bookings = db.tables.find((t) => t.name === 'bookings')!;
    const compositeIdx = bookings.indexes.find((i) => i.columns.length === 2)!;
    // expect: (user_id, event_id) [unique, name: 'unique_booking']
    expect(compositeIdx.unique).toBe(true);
    expect(compositeIdx.name).toBe('unique_booking');
    expect(compositeIdx.columns.map((c) => c.value)).toEqual(['user_id', 'event_id']);
  });

  test('single-column index is preserved', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const bookings = db.tables.find((t) => t.name === 'bookings')!;
    const singleIdx = bookings.indexes.find((i) => i.columns.length === 1)!;
    expect(singleIdx.columns[0].value).toBe('created_at');
  });
});


describe('[example] multifile interpreter — schema-alias ref', () => {
  // tables.dbml: Table ecommerce.users as EU { id int [pk]; name varchar }
  // main.dbml:   use { table ecommerce.users as EU } from './tables.dbml'
  //              Table orders { id int [pk]; user_id int [ref: > EU.id] }
  const { compiler, fps } = makeCompiler({
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

  test('no binding errors — inline ref binds against the alias', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('alias EU appears as a table in exported schema; schema prefix is stripped', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const eu = db.tables.find((t) => t.name === 'EU');
    // expect: visible as "EU" with no schema prefix
    expect(eu).toBeDefined();
    expect(eu!.schemaName).toBeNull();
  });

  test('original schema-qualified name is not separately exposed', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    // expect: "users" (with or without schema) is not directly in main's table list
    expect(db.tables.find((t) => t.name === 'users')).toBeUndefined();
  });

  test('inline ref on orders.user_id resolves to EU', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const orders = db.tables.find((t) => t.name === 'orders')!;
    const userIdField = orders.fields.find((f) => f.name === 'user_id')!;
    // expect: [ref: > EU.id] captured as inline_ref targeting EU
    const ref = userIdField.inline_refs[0];
    expect(ref.tableName).toBe('EU');
    expect(ref.fieldNames).toContain('id');
    expect(ref.relation).toBe('>');
  });
});


describe('[example] multifile interpreter — imported tablegroup', () => {
  // base.dbml:   Table users { id int [pk]; email varchar }
  //              Table posts { id int [pk]; user_id int }
  //              TableGroup content { users; posts }
  // main.dbml:   use { tablegroup content } from './base.dbml'
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
  email varchar
}

Table posts {
  id int [pk]
  user_id int
}

TableGroup content {
  users
  posts
}
`,
    '/main.dbml': `
use { tablegroup content } from './base.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported tablegroup appears in exported schema', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    // expect: "content" tablegroup is included from base.dbml
    expect(db.tableGroups.find((g) => g.name === 'content')).toBeDefined();
  });

  test('tablegroup members list both tables', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const tg = db.tableGroups.find((g) => g.name === 'content')!;
    const memberNames = tg.tables.map((t) => t.name);
    // expect: users and posts are the declared members
    expect(memberNames).toContain('users');
    expect(memberNames).toContain('posts');
  });
});


describe('[example] multifile interpreter — alias-and-schema-strip', () => {
  // auth-tables.dbml: Table auth.users { id int [pk]; email varchar }
  // main.dbml:        use { table auth.users as u } from './auth-tables.dbml'
  //                   Table orders { id int [pk]; user_id int [ref: > u.id] }
  const { compiler, fps } = makeCompiler({
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

  test('no binding errors — inline ref binds against alias u', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('alias u appears without schema prefix in exported schema', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const u = db.tables.find((t) => t.name === 'u');
    // expect: visible as "u" with no schemaName
    expect(u).toBeDefined();
    expect(u!.schemaName).toBeNull();
  });

  test('original auth.users is not directly exposed', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    // expect: original "users" (with or without "auth" schema) is not separately present
    expect(db.tables.find((t) => t.name === 'users')).toBeUndefined();
  });

  test('inline ref on orders.user_id points to u', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const orders = db.tables.find((t) => t.name === 'orders')!;
    const ref = orders.fields.find((f) => f.name === 'user_id')!.inline_refs[0];
    // expect: [ref: > u.id] — tableName is the alias, not the original
    expect(ref.tableName).toBe('u');
    expect(ref.fieldNames).toContain('id');
  });
});


describe('[example] multifile interpreter — mixed selective + wildcard from same file', () => {
  // `use { table users } from './shared.dbml'` followed by `use * from
  // './shared.dbml'` exposes the same underlying `users` table twice via two
  // distinct UseSymbol wrappers. schemaModule.symbolMembers dedupes them by
  // (originalSymbol, locally-visible name), so the consumer sees a single
  // entry per name and interpretation runs cleanly.
  const { compiler, fps } = makeCompiler({
    '/shared.dbml': `
Table users {
  id int [pk]
  name varchar
}

Table roles {
  id int [pk]
  label varchar
}
`,
    '/main.dbml': `
use { table users } from './shared.dbml'
use * from './shared.dbml'

Table memberships {
  id int [pk]
  user_id int [ref: > users.id]
  role_id int [ref: > roles.id]
}
`,
  });

  test('interpretation succeeds and surfaces users, roles, memberships without errors', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const names = db.tables.map((t) => t.name).sort();
    expect(names).toEqual(['memberships', 'roles', 'users']);
  });
});


describe('[example] multifile interpreter — inline ref on imported table carried to consumer', () => {
  // source.dbml: Table accounts { id int [pk] }
  //              Table users { id int [pk]; account_id int [ref: > accounts.id] }
  // consumer.dbml: use { table accounts } + use { table users }
  // Inline refs on an imported table's columns must survive in the consumer's
  // exported schema (the inline ref is part of the table definition, not a
  // standalone Ref, so it travels with the table).
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table accounts {
  id int [pk]
}

Table users {
  id int [pk]
  account_id int [ref: > accounts.id]
}
`,
    '/consumer.dbml': `
use { table accounts } from './source.dbml'
use { table users } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('inline ref on users.account_id appears in exported schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    const accountIdField = users.fields.find((f) => f.name === 'account_id')!;
    expect(accountIdField.inline_refs).toHaveLength(1);
    expect(accountIdField.inline_refs[0].tableName).toBe('accounts');
    expect(accountIdField.inline_refs[0].fieldNames).toContain('id');
    expect(accountIdField.inline_refs[0].relation).toBe('>');
  });
});


describe('[example] multifile interpreter — standalone Ref between two imported tables', () => {
  // Consumer imports both tables and declares a standalone Ref between them.
  // The Ref must appear in the consumer's exported schema.
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
  user_id int
}
`,
    '/consumer.dbml': `
use { table users } from './base.dbml'
use { table orders } from './base.dbml'

Ref: orders.user_id > users.id
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('standalone Ref appears in exported schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
  });

  test('Ref endpoints point to the correct tables and columns', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const ref = db.refs[0];
    const ep = ref.endpoints;
    const ordersEp = ep.find((e) => e.tableName === 'orders')!;
    const usersEp = ep.find((e) => e.tableName === 'users')!;
    expect(ordersEp).toBeDefined();
    expect(usersEp).toBeDefined();
    expect(ordersEp.fieldNames).toContain('user_id');
    expect(usersEp.fieldNames).toContain('id');
  });
});


describe('[example] multifile interpreter — Ref cardinality preserved across file boundary', () => {
  // Verifies that the many-to-one cardinality (< and >) is faithfully preserved
  // when the ref endpoints reference imported tables.
  const { compiler, fps } = makeCompiler({
    '/tables.dbml': `
Table teams {
  id int [pk]
}

Table players {
  id int [pk]
  team_id int
}
`,
    '/consumer.dbml': `
use { table teams } from './tables.dbml'
use { table players } from './tables.dbml'

Ref many_to_one: players.team_id > teams.id
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('Ref cardinality: players endpoint is many (*), teams endpoint is one (1)', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const ref = db.refs[0];
    const playersEp = ref.endpoints.find((e) => e.tableName === 'players')!;
    const teamsEp = ref.endpoints.find((e) => e.tableName === 'teams')!;
    // '>' at players side means many (players side = '*', teams side = '1')
    expect(playersEp.relation).toBe('*');
    expect(teamsEp.relation).toBe('1');
  });

  test('Ref name is preserved', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs[0].name).toBe('many_to_one');
  });
});


describe('[example] multifile interpreter — schema merging: tables under same named schema', () => {
  // File A contributes auth.users; File B contributes auth.posts.
  // Consumer imports from both and both should appear under the auth schema.
  const { compiler, fps } = makeCompiler({
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
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both auth.users and auth.posts appear in exported tables', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const names = db.tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('posts');
  });

  test('both tables carry schemaName "auth"', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    const posts = db.tables.find((t) => t.name === 'posts')!;
    expect(users.schemaName).toBe('auth');
    expect(posts.schemaName).toBe('auth');
  });
});


describe('[example] multifile interpreter — TableGroup: member table data preserved', () => {
  // Importing a tablegroup auto-expands member tables. Those tables must appear
  // in the exported schema with their full field and index definitions intact.
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
  email varchar
  indexes {
    email [unique]
  }
}

Table posts {
  id int [pk]
  user_id int
}

TableGroup social {
  users
  posts
}
`,
    '/consumer.dbml': `
use { tablegroup social } from './base.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both member tables appear in exported schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const names = db.tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('posts');
  });

  test('users table retains its fields', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    const fieldNames = users.fields.map((f) => f.name);
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('email');
  });

  test('users table retains its unique index on email', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    const emailIdx = users.indexes.find((i) => i.columns.some((c) => c.value === 'email'))!;
    expect(emailIdx).toBeDefined();
    expect(emailIdx.unique).toBe(true);
  });

  test('imported tablegroup appears in db.tableGroups', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tableGroups.find((g) => g.name === 'social')).toBeDefined();
  });
});


describe('[example] multifile interpreter — refs with same logical endpoints via different aliases across files', () => {
  // Two Ref declarations target the same pair of columns, but one uses the
  // original table name and the other uses an alias. They are two distinct
  // textual Refs — the system should include both in the exported schema.
  //
  // Scenario:
  //   base.dbml:     Table users { id int [pk] }
  //                  Table orders { id int; user_id int }
  //   consumer.dbml: use { table users } from './base.dbml'
  //                  use { table users as u } from './base.dbml'   ← both names visible
  //                  use { table orders } from './base.dbml'
  //                  Ref r1: orders.user_id > users.id
  //                  Ref r2: orders.user_id > u.id                 ← alias endpoint
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
  user_id int
}
`,
    '/consumer.dbml': `
use { table users } from './base.dbml'
use { table users as u } from './base.dbml'
use { table orders } from './base.dbml'

Ref r1: orders.user_id > users.id
Ref r2: orders.user_id > u.id
`,
  });

  test('no binding errors — both endpoint names resolve', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both Refs appear in exported schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(2);
  });

  test('r1 targets the original table name; r2 targets the alias', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const r1 = db.refs.find((r) => r.name === 'r1')!;
    const r2 = db.refs.find((r) => r.name === 'r2')!;
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(r1.endpoints.find((e) => e.tableName === 'users')).toBeDefined();
    expect(r2.endpoints.find((e) => e.tableName === 'u')).toBeDefined();
  });
});
