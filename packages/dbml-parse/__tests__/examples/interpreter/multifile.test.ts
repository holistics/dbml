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

// ─── enum imported from another file ─────────────────────────────────────────

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

// ─── enum imported under an alias ────────────────────────────────────────────

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

// ─── table with composite indexes imported cross-file ────────────────────────

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

// ─── schema-qualified table imported with alias ───────────────────────────────

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

// ─── tablegroup import pulls member tables ────────────────────────────────────

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
    const memberNames = tg.tables.map((t) => t.tableName ?? t.name);
    // expect: users and posts are the declared members
    expect(memberNames).toContain('users');
    expect(memberNames).toContain('posts');
  });
});

// ─── alias strips schema prefix (auth.users imported as u) ───────────────────

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
