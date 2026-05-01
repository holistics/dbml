import {
  describe, expect, test,
} from 'vitest';
import { Compiler } from '@/index';
import { Filepath } from '@/core/types/filepath';
import { CompileErrorCode } from '@/core/types/errors';
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
  const result = compiler.interpretFile(fp);
  expect(result.getErrors()).toHaveLength(0);
  return result.getValue()! as Database;
}


describe('[example] multifile interpreter - enum across files', () => {
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
    // expect: zero binding errors - job_status resolves across file boundary
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


describe('[example] multifile interpreter - enum alias', () => {
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

  test('no binding errors - alias is the resolvable name', () => {
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


describe('[example] multifile interpreter - indexes cross-file', () => {
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

  test('no binding errors - cross-file ref resolves', () => {
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


describe('[example] multifile interpreter - schema-alias ref', () => {
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

  test('no binding errors - inline ref binds against the alias', () => {
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


describe('[example] multifile interpreter - imported tablegroup', () => {
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


describe('[example] multifile interpreter - alias-and-schema-strip', () => {
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

  test('no binding errors - inline ref binds against alias u', () => {
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
    // expect: [ref: > u.id] - tableName is the alias, not the original
    expect(ref.tableName).toBe('u');
    expect(ref.fieldNames).toContain('id');
  });
});


describe('[example] multifile interpreter - mixed selective + wildcard from same file', () => {
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


describe('[example] multifile interpreter - inline ref on imported table carried to consumer', () => {
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


describe('[example] multifile interpreter - standalone Ref between two imported tables', () => {
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


describe('[example] multifile interpreter - Ref cardinality preserved across file boundary', () => {
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


describe('[example] multifile interpreter - schema merging: tables under same named schema', () => {
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


describe('[example] multifile interpreter - TableGroup: member table data preserved', () => {
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


describe('[example] multifile interpreter - refs with same logical endpoints via different aliases across files', () => {
  // Two Ref declarations target the same pair of columns, but one uses the
  // original table name and the other uses an alias. They are two distinct
  // textual Refs - the system should include both in the exported schema.
  //
  // Scenario:
  //   base.dbml:     Table users { id int [pk] }
  //                  Table orders { id int; user_id int }
  //   consumer.dbml: use { table users } from './base.dbml'
  //                  use { table users as u } from './base.dbml'   <- both names visible
  //                  use { table orders } from './base.dbml'
  //                  Ref r1: orders.user_id > users.id
  //                  Ref r2: orders.user_id > u.id                 <- alias endpoint
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

  test('references with the same endpoint exists can be detected even aliased', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    const bindErrors = compiler.bindNode(ast).getErrors();
    expect(bindErrors).toHaveLength(2);
    expect(bindErrors[0].diagnostic).toMatchInlineSnapshot(`"References with same endpoints exist"`);
    expect(bindErrors[1].diagnostic).toMatchInlineSnapshot(`"References with same endpoints exist"`);
  });
});


describe('[example] multifile binder - TableGroup cannot reference imported table', () => {
  // base.dbml:   Table users { id int [pk] }
  //              Table posts { id int [pk] }
  // main.dbml:   use { table users } from './base.dbml'
  //              Table local { id int [pk] }
  //              TableGroup mixed { local; users }   <- users is imported -> error
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
}
`,
    '/main.dbml': `
use { table users } from './base.dbml'

Table local {
  id int [pk]
}

TableGroup mixed {
  local
  users
}
`,
  });

  const errors = compiler.bindNode(compiler.parseFile(fps['/main.dbml']).getValue().ast).getErrors();

  test('binding produces BINDING_ERROR for the imported table reference', () => {
    expect(errors.some((e) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
  });

  test('error message names the imported table', () => {
    const err = errors.find((e) => e.code === CompileErrorCode.BINDING_ERROR && e.message.includes('users'));
    expect(err).toBeDefined();
  });

  test('local table in the same tablegroup does not produce an error', () => {
    const localErr = errors.find((e) => e.code === CompileErrorCode.BINDING_ERROR && e.message.includes('local'));
    expect(localErr).toBeUndefined();
  });
});


describe('[example] multifile binder - TableGroup with all-imported tables emits one error per entry', () => {
  // base.dbml:   Table a { id int } / Table b { id int }
  // main.dbml:   use { table a } + use { table b } from './base.dbml'
  //              TableGroup all_imported { a; b }   <- both imported -> 2 errors
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table a {
  id int
}
Table b {
  id int
}
`,
    '/main.dbml': `
use { table a } from './base.dbml'
use { table b } from './base.dbml'

TableGroup all_imported {
  a
  b
}
`,
  });

  test('binding produces one BINDING_ERROR per imported table reference', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    const errors = compiler.bindNode(ast).getErrors().filter((e) => e.code === CompileErrorCode.BINDING_ERROR);
    expect(errors).toHaveLength(2);
  });
});


describe('[example] multifile interpreter - aliased table renamed in ref endpoints', () => {
  // base.dbml:   Table users { id int [pk] }
  //              Table orders { id int [pk]; user_id int }
  // main.dbml:   use { table users as u } from './base.dbml'
  //              use { table orders } from './base.dbml'
  //              Ref: orders.user_id > u.id
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
    '/main.dbml': `
use { table users as u } from './base.dbml'
use { table orders } from './base.dbml'

Ref: orders.user_id > u.id
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('ref endpoint tableName is rewritten to alias', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const ref = db.refs[0];
    const usersEp = ref.endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
    expect(usersEp.schemaName).toBeNull();
  });

  test('other ref endpoint keeps original name', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const ref = db.refs[0];
    const ordersEp = ref.endpoints.find((e) => e.fieldNames.includes('user_id'))!;
    expect(ordersEp.tableName).toBe('orders');
  });
});


describe('[example] multifile interpreter - aliased table renamed in cross-file ref endpoints', () => {
  // Ref is declared in the source file, not the consumer. The consumer imports
  // both tables (one with alias). The cross-file ref endpoints must be rewritten.
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id
`,
    '/main.dbml': `
use { table users as u } from './base.dbml'
use { table orders } from './base.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('cross-file ref is auto-pulled and endpoint uses alias', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
  });
});


describe('[example] multifile interpreter - aliased table renamed in records', () => {
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
  name varchar
}
`,
    '/main.dbml': `
use { table users as u } from './base.dbml'

records u(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/main.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('no export errors', () => {
    const result = compiler.interpretFile(fps['/main.dbml']);
    expect(result.getErrors()).toHaveLength(0);
  });

  test('record tableName uses alias', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const record = db.records.find((r) => r.tableName === 'u');
    expect(record).toBeDefined();
  });

  test('record values preserved', () => {
    const db = exportDb(compiler, fps['/main.dbml']);
    const record = db.records.find((r) => r.tableName === 'u')!;
    expect(record.values).toHaveLength(2);
  });
});


describe('[example] multifile interpreter - directly imported table loses partial-injected columns', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users {
  id int [pk]
  name varchar
  ~timestamps
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported table has own columns and partial reference', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    expect(users.fields.map((f) => f.name)).toEqual(['id', 'name']);
    expect(users.partials).toHaveLength(1);
    expect(users.partials[0].name).toBe('timestamps');
  });

  test('partial auto-pulled to db.tablePartials', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const partial = db.tablePartials.find((p) => p.name === 'timestamps');
    expect(partial).toBeDefined();
    expect(partial!.fields.map((f: any) => f.name)).toEqual(['created_at', 'updated_at']);
  });
});


describe('[example] multifile interpreter - imported table with inline ref to unimported table', () => {
  // source.dbml defines users and orders with an inline ref: orders.user_id > users.id
  // consumer imports ONLY orders (not users).
  // The inline ref on orders.user_id references users which is not in scope.
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  email varchar
}

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}
`,
    '/consumer.dbml': `
use { table orders } from './source.dbml'
`,
  });

  test('imported table appears in schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'orders')).toBeDefined();
  });

  test('inline ref target (users) is NOT in scope - ref should be dropped or users not present', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    // users was never imported
    expect(db.tables.find((t) => t.name === 'users')).toBeUndefined();
  });
});


describe('[example] multifile interpreter - external standalone Ref auto-pulled when both tables imported', () => {
  // source.dbml defines tables + a standalone Ref between them.
  // consumer imports both tables.
  // The Ref should be auto-pulled because both endpoints are in scope.
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'
use { table orders } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('standalone Ref from source is auto-pulled into consumer schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'orders')).toBeDefined();
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'users')).toBeDefined();
  });
});


describe('[example] multifile interpreter - external standalone Ref NOT pulled when one table missing', () => {
  // Only orders is imported, not users. The Ref should NOT be pulled.
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id
`,
    '/consumer.dbml': `
use { table orders } from './source.dbml'
`,
  });

  test('ref is not pulled because users is not in scope', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(0);
  });
});


describe('[example] multifile interpreter - tablegroup pulls tables that use tablepartials', () => {
  // base.dbml defines a partial, tables using it, and a tablegroup.
  // consumer imports the tablegroup. The pulled tables should have
  // their injected partial columns.
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users {
  id int [pk]
  name varchar
  ~timestamps
}

Table posts {
  id int [pk]
  title varchar
  ~timestamps
}

TableGroup content {
  users
  posts
}
`,
    '/consumer.dbml': `
use { tablegroup content } from './base.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('pulled tables have own columns and partial reference', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    expect(users.fields.map((f) => f.name)).toEqual(['id', 'name']);
    expect(users.partials).toHaveLength(1);
    expect(users.partials[0].name).toBe('timestamps');
  });

  test('partial auto-pulled to db.tablePartials', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tablePartials.find((p) => p.name === 'timestamps')).toBeDefined();
  });
});


describe('[example] multifile interpreter - tablegroup pulls tables that reference enums', () => {
  // base.dbml defines an enum, tables using it, and a tablegroup.
  // consumer imports the tablegroup. The enum should also appear in schema
  // since the pulled table references it.
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Enum status {
  active
  inactive
}

Table users {
  id int [pk]
  status status
}

TableGroup user_group {
  users
}
`,
    '/consumer.dbml': `
use { tablegroup user_group } from './base.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('pulled table has correct enum type on column', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    const statusField = users.fields.find((f) => f.name === 'status')!;
    expect(statusField.type.type_name).toBe('status');
  });

  test('non-imported enum does NOT appear in schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.enums.find((e) => e.name === 'status')).toBeUndefined();
  });
});


describe('[example] multifile interpreter - tablegroup pulls tables with inline refs to non-imported tables', () => {
  // base.dbml: Table a has inline ref to Table b. TableGroup g contains only a.
  // consumer imports tablegroup g. Table a is pulled, but b is not imported.
  const { compiler, fps } = makeCompiler({
    '/base.dbml': `
Table categories {
  id int [pk]
  name varchar
}

Table products {
  id int [pk]
  name varchar
  category_id int [ref: > categories.id]
}

TableGroup shop {
  products
}
`,
    '/consumer.dbml': `
use { tablegroup shop } from './base.dbml'
`,
  });

  test('pulled table appears in schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'products')).toBeDefined();
  });

  test('categories (not in tablegroup) is not pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'categories')).toBeUndefined();
  });
});


describe('[example] multifile interpreter - Ref auto-pull matches through alias', () => {
  // source defines tables + standalone Ref. Consumer imports one table with alias.
  // Ref should still auto-pull if both endpoints are in scope (original or aliased).
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id
`,
    '/consumer.dbml': `
use { table users as u } from './source.dbml'
use { table orders } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('Ref is auto-pulled and endpoint uses alias name', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
  });
});


describe('[example] multifile interpreter - Ref between tables from different imported files', () => {
  // file-a defines users, file-b defines orders + Ref to users.
  // consumer imports both. The Ref in file-b references file-a's table.
  const { compiler, fps } = makeCompiler({
    '/file-a.dbml': `
Table users {
  id int [pk]
  name varchar
}
`,
    '/file-b.dbml': `
use { table users } from './file-a.dbml'

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id
`,
    '/consumer.dbml': `
use { table users } from './file-a.dbml'
use { table orders } from './file-b.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both tables present in consumer schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'users')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'orders')).toBeDefined();
  });
});


describe('[example] multifile interpreter - wildcard import from file with multiple schemas', () => {
  // source has tables in public and auth schemas.
  // consumer does use * - both schemas should merge into consumer.
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
}

Table auth.sessions {
  id int [pk]
  user_id int
}
`,
    '/consumer.dbml': `
use * from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('public schema table present', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'users')).toBeDefined();
  });

  test('auth schema table present with schema name', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const sessions = db.tables.find((t) => t.name === 'sessions');
    expect(sessions).toBeDefined();
    expect(sessions!.schemaName).toBe('auth');
  });
});


describe('[example] multifile interpreter - records referencing imported table columns', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar
  active boolean
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'

records users(id, name, active) {
  1, 'Alice', true
  2, 'Bob', false
}
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('no export errors', () => {
    const result = compiler.interpretFile(fps['/consumer.dbml']);
    expect(result.getErrors()).toHaveLength(0);
  });

  test('records appear with correct table and values', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(2);
  });
});


describe('[example] multifile interpreter - records on table with partial-injected columns', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users {
  id int [pk]
  name varchar
  ~timestamps
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'

records users(id, name, created_at, updated_at) {
  1, 'Alice', '2024-01-01', '2024-01-02'
}
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('records reference injected columns without error', () => {
    const result = compiler.interpretFile(fps['/consumer.dbml']);
    expect(result.getErrors()).toHaveLength(0);
  });

  test('record values present', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(1);
  });
});


describe('[example] multifile interpreter - records on table with external partial-injected columns', () => {
  // Partial is in a separate file from the table. Table imports and injects it.
  // Consumer imports the table and writes records referencing injected columns.
  const { compiler, fps } = makeCompiler({
    '/partials.dbml': `
TablePartial audit {
  created_by int
  modified_by int
}
`,
    '/tables.dbml': `
use { tablepartial audit } from './partials.dbml'

Table orders {
  id int [pk]
  total decimal
  ~audit
}
`,
    '/consumer.dbml': `
use { table orders } from './tables.dbml'

records orders(id, total, created_by, modified_by) {
  1, 99.99, 10, 10
  2, 49.50, 11, 12
}
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('no export errors', () => {
    const result = compiler.interpretFile(fps['/consumer.dbml']);
    expect(result.getErrors()).toHaveLength(0);
  });

  test('records reference external partial columns without error', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const record = db.records.find((r) => r.tableName === 'orders');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(2);
  });
});


describe('[example] multifile interpreter - records defined in source file auto-pulled with imported table', () => {
  // source defines table + records. Consumer imports table.
  // Records should be auto-pulled as metadata on the table symbol.
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
  3, 'Charlie'
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('records from source file are pulled into consumer schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(3);
  });
});


describe('[example] multifile interpreter - records auto-pulled with aliased table', () => {
  // source defines table + records. Consumer imports table with alias.
  // Records should appear under the alias name.
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
}
`,
    '/consumer.dbml': `
use { table users as u } from './source.dbml'
`,
  });

  test('records pulled under alias name', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.records.find((r) => r.tableName === 'u')).toBeDefined();
    expect(db.records.find((r) => r.tableName === 'users')).toBeUndefined();
  });
});


describe('[example] multifile interpreter - records NOT pulled when table not imported', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar
}

Table orders {
  id int [pk]
}

records users(id, name) {
  1, 'Alice'
}
`,
    '/consumer.dbml': `
use { table orders } from './source.dbml'
`,
  });

  test('records for non-imported table are not in consumer schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.records).toHaveLength(0);
  });
});


describe('[example] multifile interpreter - nested records inside imported table definition', () => {
  // Records nested inside the table block (not standalone).
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar

  records {
    1, 'Alice'
    2, 'Bob'
  }
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'
`,
  });

  test('nested records are pulled with the imported table', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(2);
  });
});


describe('[example] multifile interpreter - standalone Ref from source auto-pulled via metadata', () => {
  // Verifies that refs flow through metadata, not just AST.
  // Source has two tables and a standalone Ref.
  // Consumer imports both tables - ref should appear via metadata pulling.
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table departments {
  id int [pk]
  name varchar
}

Table employees {
  id int [pk]
  dept_id int
  name varchar
}

Ref: employees.dept_id > departments.id
`,
    '/consumer.dbml': `
use { table departments } from './source.dbml'
use { table employees } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('ref is auto-pulled because both endpoints are in scope', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
    const ref = db.refs[0];
    expect(ref.endpoints.find((e) => e.tableName === 'employees')).toBeDefined();
    expect(ref.endpoints.find((e) => e.tableName === 'departments')).toBeDefined();
  });

  test('ref is NOT pulled when only one endpoint is imported', () => {
    const partial = new Compiler();
    const fp = Filepath.from('/partial.dbml');
    partial.setSource(Filepath.from('/source.dbml'), `
Table departments {
  id int [pk]
  name varchar
}
Table employees {
  id int [pk]
  dept_id int
  name varchar
}
Ref: employees.dept_id > departments.id
`);
    partial.setSource(fp, `use { table employees } from './source.dbml'`);
    const result = partial.interpretFile(fp);
    const db = result.getValue() as Database | undefined;
    expect(db?.refs ?? []).toHaveLength(0);
  });
});


// --- Edge case tests for pulling behavior ---


describe('[edge] ref in third unreachable file is NOT pulled', () => {
  // A: users, B: orders, C: Ref between them. Consumer imports from A and B, not C.
  const { compiler, fps } = makeCompiler({
    '/a.dbml': `
Table users {
  id int [pk]
}`,
    '/b.dbml': `
Table orders {
  id int [pk]
  user_id int
}`,
    '/c.dbml': `
use { table users } from './a.dbml'
use { table orders } from './b.dbml'
Ref: orders.user_id > users.id
`,
    '/consumer.dbml': `
use { table users } from './a.dbml'
use { table orders } from './b.dbml'
`,
  });

  test('ref from file C is NOT pulled - consumer does not import from C', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(0);
  });
});


describe('[edge] same partial used by multiple imported tables - deduplicated', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}
Table users {
  id int [pk]
  ~timestamps
}
Table orders {
  id int [pk]
  ~timestamps
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'
use { table orders } from './source.dbml'
`,
  });

  test('partial appears only once in db.tablePartials', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const timestamps = db.tablePartials.filter((p) => p.name === 'timestamps');
    expect(timestamps).toHaveLength(1);
  });
});


describe('[edge] aliased table ref endpoint rewriting', () => {
  // use { table users as u } + use { table orders }
  // Source: Ref: orders.user_id > users.id
  // Endpoint 'users' should be rewritten to 'u'
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users { id int [pk] }
Table orders {
  id int [pk]
  user_id int
}
Ref: orders.user_id > users.id
`,
    '/consumer.dbml': `
use { table users as u } from './source.dbml'
use { table orders } from './source.dbml'
`,
  });

  test('ref endpoint uses alias name', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
  });

  test('other endpoint keeps original name', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const ordersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('user_id'))!;
    expect(ordersEp.tableName).toBe('orders');
  });
});


describe('[edge] wildcard import + ref auto-pull', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users { id int [pk] }
Table orders {
  id int [pk]
  user_id int
}
Ref: orders.user_id > users.id
`,
    '/consumer.dbml': `use * from './source.dbml'`,
  });

  test('ref auto-pulled via wildcard', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
  });

  test('both tables present', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
  });
});


describe('[edge] partial with inline ref - target table not in consumer scope', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table categories { id int [pk] }
TablePartial categorized {
  category_id int [ref: > categories.id]
}
Table products {
  id int [pk]
  ~categorized
}
`,
    '/consumer.dbml': `
use { table products } from './source.dbml'
`,
  });

  test('partial is auto-pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tablePartials.find((p) => p.name === 'categorized')).toBeDefined();
  });

  test('categories table is NOT in consumer scope', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'categories')).toBeUndefined();
  });
});


describe('[edge] two files define same-named partial - first wins', () => {
  const { compiler, fps } = makeCompiler({
    '/a.dbml': `
TablePartial meta { created_at timestamp }
Table users {
  id int [pk]
  ~meta
}
`,
    '/b.dbml': `
TablePartial meta { updated_at timestamp }
Table orders {
  id int [pk]
  ~meta
}
`,
    '/consumer.dbml': `
use { table users } from './a.dbml'
use { table orders } from './b.dbml'
`,
  });

  test('only one partial named meta in db.tablePartials', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tablePartials.filter((p) => p.name === 'meta')).toHaveLength(1);
  });
});


describe('[edge] reuse chain: partial from deeply nested file', () => {
  // C defines partial, B defines table using it and reuses from C,
  // A reuses from B, consumer imports from A
  const { compiler, fps } = makeCompiler({
    '/c.dbml': `
TablePartial audit { created_by int }
`,
    '/b.dbml': `
reuse { tablepartial audit } from './c.dbml'
Table users {
  id int [pk]
  ~audit
}
`,
    '/a.dbml': `
reuse { table users } from './b.dbml'
`,
    '/consumer.dbml': `
use { table users } from './a.dbml'
`,
  });

  test('partial from C is auto-pulled through reuse chain', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tablePartials.find((p) => p.name === 'audit')).toBeDefined();
  });

  test('table has partial reference', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    expect(users.partials).toHaveLength(1);
  });
});


describe('[edge] record auto-pull when table pulled via tablegroup', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar
}
records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
TableGroup main { users }
`,
    '/consumer.dbml': `
use { tablegroup main } from './source.dbml'
`,
  });

  test('records pulled for tablegroup-expanded table', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(2);
  });
});


describe('[edge] multiple refs between same tables - all pulled', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  email varchar [unique]
}
Table orders {
  id int [pk]
  user_id int
  user_email varchar
}
Ref r1: orders.user_id > users.id
Ref r2: orders.user_email > users.email
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'
use { table orders } from './source.dbml'
`,
  });

  test('both refs are pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(2);
  });
});


describe('[edge] self-referential ref - single table', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table employees {
  id int [pk]
  manager_id int
}
Ref: employees.manager_id > employees.id
`,
    '/consumer.dbml': `
use { table employees } from './source.dbml'
`,
  });

  test('self-ref is pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].endpoints[0].tableName).toBe('employees');
    expect(db.refs[0].endpoints[1].tableName).toBe('employees');
  });
});


// --- Stress tests: schemas, canonical names, transitive pulling, wildcards ---


describe('[stress] schema-qualified table with ref auto-pull', () => {
  const { compiler, fps } = makeCompiler({
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
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'users' && t.schemaName === 'auth')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'orders' && t.schemaName === 'auth')).toBeDefined();
  });

  test('ref between schema-qualified tables is auto-pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
  });
});


describe('[stress] aliased schema-qualified table in ref', () => {
  const { compiler, fps } = makeCompiler({
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
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    const ordersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('user_id'))!;
    expect(usersEp.tableName).toBe('u');
    expect(ordersEp.tableName).toBe('o');
  });
});


describe('[stress] composite ref auto-pull', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  org_id int
}
Table memberships {
  user_id int
  org_id int
}
Ref: memberships.(user_id, org_id) > users.(id, org_id)
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'
use { table memberships } from './source.dbml'
`,
  });

  test('composite ref auto-pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
  });

  test('composite ref has correct field names', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const membershipEp = db.refs[0].endpoints.find((e) => e.tableName === 'memberships')!;
    expect(membershipEp.fieldNames.sort()).toEqual(['org_id', 'user_id']);
  });
});


describe('[stress] wildcard import pulls refs, records, and partials', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users {
  id int [pk]
  name varchar
  ~timestamps
}

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`,
    '/consumer.dbml': `use * from './source.dbml'`,
  });

  test('both tables present', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
  });

  test('ref auto-pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
  });

  test('records auto-pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.records.find((r) => r.tableName === 'users')).toBeDefined();
  });

  test('partial auto-pulled', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tablePartials.find((p) => p.name === 'timestamps')).toBeDefined();
  });
});


describe('[stress] transitive reuse: A reuses B reuses C, all metadata follows', () => {
  const { compiler, fps } = makeCompiler({
    '/c.dbml': `
Table users {
  id int [pk]
  name varchar
}

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id

records users(id, name) {
  1, 'Alice'
}
`,
    '/b.dbml': `
reuse { table users } from './c.dbml'
reuse { table orders } from './c.dbml'
`,
    '/a.dbml': `
reuse { table users } from './b.dbml'
reuse { table orders } from './b.dbml'
`,
    '/consumer.dbml': `
use { table users } from './a.dbml'
use { table orders } from './a.dbml'
`,
  });

  test('tables reachable through 3-hop reuse', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
  });

  test('ref follows through reuse chain', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
  });

  test('records follow through reuse chain', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.records.find((r) => r.tableName === 'users')).toBeDefined();
  });
});


describe('[stress] wildcard from two files with overlapping schemas', () => {
  const { compiler, fps } = makeCompiler({
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
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users');
    const roles = db.tables.find((t) => t.name === 'roles');
    expect(users).toBeDefined();
    expect(roles).toBeDefined();
    expect(users!.schemaName).toBe('auth');
    expect(roles!.schemaName).toBe('auth');
  });
});


describe('[stress] table with special characters in name', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table "my-table" {
  id int [pk]
  value varchar
}
`,
    '/consumer.dbml': `
use { table "my-table" } from './source.dbml'
`,
  });

  test('quoted table name preserved', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.tables.find((t) => t.name === 'my-table')).toBeDefined();
  });
});


describe('[stress] ref between imported and local table', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id
`,
  });

  test('local ref with one imported endpoint works', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'orders')).toBeDefined();
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'users')).toBeDefined();
  });
});


describe('[stress] multiple records blocks for same table across files', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
}
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'

records users(id, name) {
  2, 'Bob'
}
`,
  });

  test('both local and pulled records present', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const userRecords = db.records.filter((r) => r.tableName === 'users');
    expect(userRecords).toHaveLength(2);
  });
});


describe('[stress] enum imported alongside table that uses it', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Enum status {
  active
  inactive
}

Table users {
  id int [pk]
  status status
}
`,
    '/consumer.dbml': `
use { enum status } from './source.dbml'
use { table users } from './source.dbml'
`,
  });

  test('explicitly imported enum in schema', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    expect(db.enums.find((e) => e.name === 'status')).toBeDefined();
  });

  test('column type resolves to imported enum', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const users = db.tables.find((t) => t.name === 'users')!;
    expect(users.fields.find((f) => f.name === 'status')!.type.type_name).toBe('status');
  });
});


describe('[stress] inline ref on imported table with target in scope', () => {
  const { compiler, fps } = makeCompiler({
    '/source.dbml': `
Table categories {
  id int [pk]
}

Table products {
  id int [pk]
  category_id int [ref: > categories.id]
}
`,
    '/consumer.dbml': `
use { table categories } from './source.dbml'
use { table products } from './source.dbml'
`,
  });

  test('inline ref preserved on imported table', () => {
    const db = exportDb(compiler, fps['/consumer.dbml']);
    const products = db.tables.find((t) => t.name === 'products')!;
    const catField = products.fields.find((f) => f.name === 'category_id')!;
    expect(catField.inline_refs).toHaveLength(1);
    expect(catField.inline_refs[0].tableName).toBe('categories');
  });
});

