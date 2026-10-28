import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { filepath, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - imported tablegroup', () => {
  // base.dbml:   Table users { id int [pk]; email varchar }
  //              Table posts { id int [pk]; user_id int }
  //              TableGroup content { users; posts }
  // main.dbml:   use { tablegroup content } from './base.dbml'
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(filepath('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported tablegroup appears in exported schema', () => {
    const db = getDatabase(compiler, '/main.dbml');
    // expect: "content" tablegroup is included from base.dbml
    expect(db.tableGroups.find((group) => group.name === 'content')).toBeDefined();
  });

  test('tablegroup members list both tables', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const tg = db.tableGroups.find((group) => group.name === 'content')!;
    const memberNames = tg.tables.map((token) => token.name);
    // expect: users and posts are the declared members
    expect(memberNames).toContain('users');
    expect(memberNames).toContain('posts');
  });
});

describe('[example] multifile interpreter - TableGroup: member table data preserved', () => {
  // Importing a tablegroup auto-expands member tables, which must appear in the exported schema with their full field and index definitions intact
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(filepath('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both member tables appear in exported schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const names = db.tables.map((token) => token.name);
    expect(names).toContain('users');
    expect(names).toContain('posts');
  });

  test('users table retains its fields', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((token) => token.name === 'users')!;
    const fieldNames = users.fields.map((field) => field.name);
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('email');
  });

  test('users table retains its unique index on email', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((token) => token.name === 'users')!;
    const emailIndex = users.indexes.find((index) => index.columns.some((column) => column.value === 'email'))!;
    expect(emailIndex).toBeDefined();
    expect(emailIndex.unique).toBe(true);
  });

  test('imported tablegroup appears in db.tableGroups', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tableGroups.find((group) => group.name === 'social')).toBeDefined();
  });
});

describe('[example] multifile interpreter - tablegroup pulls tables that use tablepartials', () => {
  // base.dbml defines a partial, tables using it, and a tablegroup
  // consumer imports the tablegroup, pulled tables should have their injected partial columns
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(filepath('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('pulled tables have own columns and partial reference', () => {
    const db = compiler.interpretFile(filepath('/consumer.dbml')).getValue()! as any;
    const users = db.tables.find((table: any) => table.name === 'users')!;
    expect(users.fields.map((field: any) => field.name)).toEqual(['id', 'name']);
    expect(users.partials).toHaveLength(1);
    expect(users.partials[0].name).toBe('timestamps');
  });

  test('UNSUPPORTED error when importing tablegroup with tables that use out-of-scope partial', () => {
    const result = compiler.interpretFile(filepath('/consumer.dbml'));
    const errors = result.getErrors();
    expect(errors.some((error) => error.code === CompileErrorCode.UNSUPPORTED)).toBe(true);
  });
});

describe('[example] multifile interpreter - tablegroup pulls tables with inline refs to non-imported tables', () => {
  // base.dbml: Table a has inline ref to Table b, TableGroup g contains only a
  // consumer imports tablegroup g, Table a is pulled but b is not imported
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((token) => token.name === 'products')).toBeDefined();
  });

  test('categories (not in tablegroup) is not pulled', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((token) => token.name === 'categories')).toBeUndefined();
  });
});

describe('[edge] record auto-pull when table pulled via tablegroup', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    const record = db.records.find((recordItem) => recordItem.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(2);
  });
});
