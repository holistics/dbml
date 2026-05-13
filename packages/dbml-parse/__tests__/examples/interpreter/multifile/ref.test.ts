import { describe, expect, test } from 'vitest';
import { Compiler } from '@/index';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import type { Database } from '@/core/types/schemaJson';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - indexes cross-file', () => {
  // tables.dbml: Table bookings { id, user_id, event_id, created_at
  //                indexes { (user_id, event_id) [unique, name: 'unique_booking']; created_at } }
  // main.dbml:   use { table bookings } from './tables.dbml'
  //              Table events { id int [pk]; name varchar }
  //              Ref: bookings.event_id > events.id
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported table retains both indexes', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const bookings = db.tables.find((t) => t.name === 'bookings')!;
    // expect: both composite and single-column index are preserved
    expect(bookings.indexes).toHaveLength(2);
  });

  test('composite index is unique and carries the declared name', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const bookings = db.tables.find((t) => t.name === 'bookings')!;
    const compositeIdx = bookings.indexes.find((i) => i.columns.length === 2)!;
    // expect: (user_id, event_id) [unique, name: 'unique_booking']
    expect(compositeIdx.unique).toBe(true);
    expect(compositeIdx.name).toBe('unique_booking');
    expect(compositeIdx.columns.map((c) => c.value)).toEqual(['user_id', 'event_id']);
  });

  test('single-column index is preserved', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const bookings = db.tables.find((t) => t.name === 'bookings')!;
    const singleIdx = bookings.indexes.find((i) => i.columns.length === 1)!;
    expect(singleIdx.columns[0].value).toBe('created_at');
  });
});


describe('[example] multifile interpreter - inline ref on imported table carried to consumer', () => {
  // source.dbml: Table accounts { id int [pk] }
  //              Table users { id int [pk]; account_id int [ref: > accounts.id] }
  // consumer.dbml: use { table accounts } + use { table users }
  // Inline refs on an imported table's columns must survive in the consumer's
  // exported schema (the inline ref is part of the table definition, not a
  // standalone Ref, so it travels with the table).
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('inline ref on users.account_id appears in exported schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
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
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('standalone Ref appears in exported schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
  });

  test('Ref endpoints point to the correct tables and columns', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
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
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('Ref cardinality: players endpoint is many (*), teams endpoint is one (1)', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const ref = db.refs[0];
    const playersEp = ref.endpoints.find((e) => e.tableName === 'players')!;
    const teamsEp = ref.endpoints.find((e) => e.tableName === 'teams')!;
    // '>' at players side means many (players side = '*', teams side = '1')
    expect(playersEp.relation).toBe('*');
    expect(teamsEp.relation).toBe('1');
  });

  test('Ref name is preserved', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs[0].name).toBe('many_to_one');
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
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    const bindErrors = compiler.bindNode(ast).getErrors();
    expect(bindErrors).toHaveLength(2);
    expect(bindErrors[0].diagnostic).toMatchInlineSnapshot(`"References with same endpoints exist"`);
    expect(bindErrors[1].diagnostic).toMatchInlineSnapshot(`"References with same endpoints exist"`);
  });
});


describe('[example] multifile interpreter - aliased table renamed in ref endpoints', () => {
  // base.dbml:   Table users { id int [pk] }
  //              Table orders { id int [pk]; user_id int }
  // main.dbml:   use { table users as u } from './base.dbml'
  //              use { table orders } from './base.dbml'
  //              Ref: orders.user_id > u.id
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('ref endpoint tableName is rewritten to alias', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const ref = db.refs[0];
    const usersEp = ref.endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
    expect(usersEp.schemaName).toBe('');
  });

  test('other ref endpoint keeps original name', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const ref = db.refs[0];
    const ordersEp = ref.endpoints.find((e) => e.fieldNames.includes('user_id'))!;
    expect(ordersEp.tableName).toBe('orders');
  });
});


describe('[example] multifile interpreter - aliased table renamed in cross-file ref endpoints', () => {
  // Ref is declared in the source file, not the consumer. The consumer imports
  // both tables (one with alias). The cross-file ref endpoints must be rewritten.
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('cross-file ref is auto-pulled and endpoint uses alias', () => {
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
  });
});


describe('[example] multifile interpreter - imported table with inline ref to unimported table', () => {
  // source.dbml defines users and orders with an inline ref: orders.user_id > users.id
  // consumer imports ONLY orders (not users).
  // The inline ref on orders.user_id references users which is not in scope.
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 'orders')).toBeDefined();
  });

  test('inline ref target (users) is NOT in scope - ref should be dropped or users not present', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    // users was never imported
    expect(db.tables.find((t) => t.name === 'users')).toBeUndefined();
  });
});


describe('[example] multifile interpreter - external standalone Ref auto-pulled when both tables imported', () => {
  // source.dbml defines tables + a standalone Ref between them.
  // consumer imports both tables.
  // The Ref should be auto-pulled because both endpoints are in scope.
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('standalone Ref from source is auto-pulled into consumer schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'orders')).toBeDefined();
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'users')).toBeDefined();
  });
});


describe('[example] multifile interpreter - external standalone Ref NOT pulled when one table missing', () => {
  // Only orders is imported, not users. The Ref should NOT be pulled.
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(0);
  });
});


describe('[example] multifile interpreter - Ref auto-pull matches through alias', () => {
  // source defines tables + standalone Ref. Consumer imports one table with alias.
  // Ref should still auto-pull if both endpoints are in scope (original or aliased).
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('Ref is auto-pulled and endpoint uses alias name', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
  });
});


describe('[example] multifile interpreter - Ref between tables from different imported files', () => {
  // file-a defines users, file-b defines orders + Ref to users.
  // consumer imports both. The Ref in file-b references file-a's table.
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both tables present in consumer schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 'users')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'orders')).toBeDefined();
  });
});


describe('[example] multifile interpreter - standalone Ref from source auto-pulled via metadata', () => {
  // Verifies that refs flow through metadata, not just AST.
  // Source has two tables and a standalone Ref.
  // Consumer imports both tables - ref should appear via metadata pulling.
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('ref is auto-pulled because both endpoints are in scope', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
    const ref = db.refs[0];
    expect(ref.endpoints.find((e) => e.tableName === 'employees')).toBeDefined();
    expect(ref.endpoints.find((e) => e.tableName === 'departments')).toBeDefined();
  });

  test('ref is NOT pulled when only one endpoint is imported', () => {
    const partialLayout = new MemoryProjectLayout();
    const fp = Filepath.from('/partial.dbml');
    partialLayout.setSource(Filepath.from('/source.dbml'), `
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
    partialLayout.setSource(fp, `use { table employees } from './source.dbml'`);
    const partial = new Compiler();
    partial.layout = partialLayout;
    const result = partial.interpretFile(fp);
    const db = result.getValue() as Database | undefined;
    expect(db?.refs ?? []).toHaveLength(0);
  });
});


describe('[edge] ref in third unreachable file is NOT pulled', () => {
  // A: users, B: orders, C: Ref between them. Consumer imports from A and B, not C.
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(0);
  });
});


describe('[edge] aliased table ref endpoint rewriting', () => {
  // use { table users as u } + use { table orders }
  // Source: Ref: orders.user_id > users.id
  // Endpoint 'users' should be rewritten to 'u'
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
    const usersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('id'))!;
    expect(usersEp.tableName).toBe('u');
  });

  test('other endpoint keeps original name', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const ordersEp = db.refs[0].endpoints.find((e) => e.fieldNames.includes('user_id'))!;
    expect(ordersEp.tableName).toBe('orders');
  });
});


describe('[edge] multiple refs between same tables - all pulled', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(2);
  });
});


describe('[edge] self-referential ref - single table', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].endpoints[0].tableName).toBe('employees');
    expect(db.refs[0].endpoints[1].tableName).toBe('employees');
  });
});


describe('[stress] composite ref auto-pull', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
  });

  test('composite ref has correct field names', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const membershipEp = db.refs[0].endpoints.find((e) => e.tableName === 'memberships')!;
    expect(membershipEp.fieldNames.sort()).toEqual(['org_id', 'user_id']);
  });
});


describe('[stress] ref between imported and local table', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'orders')).toBeDefined();
    expect(db.refs[0].endpoints.find((e) => e.tableName === 'users')).toBeDefined();
  });
});


describe('[stress] inline ref on imported table with target in scope', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    const products = db.tables.find((t) => t.name === 'products')!;
    const catField = products.fields.find((f) => f.name === 'category_id')!;
    expect(catField.inline_refs).toHaveLength(1);
    expect(catField.inline_refs[0].tableName).toBe('categories');
  });
});
