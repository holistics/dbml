import { describe, expect, test } from 'vitest';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - mixed selective + wildcard from same file', () => {
  // Selective + wildcard from the same file exposes the same `users` table twice via two distinct UseSymbol wrappers
  // schemaModule.symbolMembers dedupes by (originalSymbol, locally-visible name), so the consumer sees a single entry per name
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/main.dbml');
    const names = db.tables.map((t) => t.name).sort();
    expect(names).toEqual(['memberships', 'roles', 'users']);
  });
});

describe('[example] multifile interpreter - wildcard import from file with multiple schemas', () => {
  // source has tables in public and auth schemas
  // consumer does use *, both schemas should merge into consumer
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('public schema table present', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 'users')).toBeDefined();
  });

  test('auth schema table present with schema name', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const sessions = db.tables.find((t) => t.name === 'sessions');
    expect(sessions).toBeDefined();
    expect(sessions!.schemaName).toBe('auth');
  });
});

describe('[edge] wildcard import + ref auto-pull', () => {
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table users { id int [pk] }
Table orders {
  id int [pk]
  user_id int
}
Ref: orders.user_id > users.id
`,
    '/consumer.dbml': 'use * from \'./source.dbml\'',
  });

  test('ref auto-pulled via wildcard', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
  });

  test('both tables present', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
  });
});

describe('[stress] wildcard import pulls refs, records, and partials', () => {
  const { compiler } = setupCompiler({
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
    '/consumer.dbml': 'use * from \'./source.dbml\'',
  });

  test('both tables present', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
  });

  test('ref pulled', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
  });

  test('records pulled', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.records.find((r) => r.tableName === 'users')).toBeDefined();
  });

  test('partial pulled', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tablePartials.find((p) => p.name === 'timestamps')).toBeDefined();
  });
});

describe('[stress] table with special characters in name', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 'my-table')).toBeDefined();
  });
});

describe('[bug] wildcard import - aliased table: both alias and original name should resolve', () => {
  // file a: `Table users as u` exports symbol `users` under name `u` (alias)
  // file b: `use * from './a'` should make both `u` (alias) and `users` (original) resolvable
  const { compiler } = setupCompiler({
    '/a.dbml': `
Table users as u {
  id int [pk]
}
`,
    '/b.dbml': `
use * from './a.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}
`,
  });

  test('no binding errors when referencing original name `users` via wildcard', () => {
    const ast = compiler.parseFile(fp('/b.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('`users.id` reference resolves without errors in consumer', () => {
    // Table is interpreted under its alias `u`, but the original name `users` must bind correctly
    const result = compiler.interpretFile(fp('/b.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('schema-qualified aliased table: original name resolves via schema prefix', () => {
    // `Table auth.users as u` → wildcard should expose `users` in auth schema, resolvable as `auth.users`
    const { compiler: c3 } = setupCompiler({
      '/a.dbml': `
Table auth.users as u {
  id int [pk]
}
`,
      '/b.dbml': `
use * from './a.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > auth.users.id]
}
`,
    });
    const result = c3.interpretFile(fp('/b.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('schema-qualified original name is NOT visible in the public schema', () => {
    // `Table auth.users as u` original name `users` belongs to `auth`, not to public
    const { compiler: c4 } = setupCompiler({
      '/a.dbml': `
Table auth.users as u {
  id int [pk]
}
`,
      '/b.dbml': `
use * from './a.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}
`,
    });
    // `users` (without schema) would incorrectly resolve if original name leaked into public
    const ast = c4.parseFile(fp('/b.dbml')).getValue().ast;
    expect(c4.bindNode(ast).getErrors().length).toBeGreaterThan(0);
  });

  test('`u` alias is also resolvable in consumer', () => {
    const { compiler: c2 } = setupCompiler({
      '/a.dbml': `
Table users as u {
  id int [pk]
}
`,
      '/b.dbml': `
use * from './a.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > u.id]
}
`,
    });
    const ast = c2.parseFile(fp('/b.dbml')).getValue().ast;
    expect(c2.bindNode(ast).getErrors()).toHaveLength(0);
  });
});
