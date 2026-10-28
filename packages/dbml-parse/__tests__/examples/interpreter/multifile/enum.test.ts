import { describe, expect, test } from 'vitest';
import { filepath, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - enum across files', () => {
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(filepath('/main.dbml')).getValue().ast;
    // expect: zero binding errors - job_status resolves across file boundary
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported enum appears in exported schema', () => {
    const db = getDatabase(compiler, '/main.dbml');
    // expect: job_status enum is included as an external in the consumer's schema
    const enumItem = db.enums.find((error) => error.name === 'job_status');
    expect(enumItem).toBeDefined();
  });

  test('imported enum values are preserved', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const enumItem = db.enums.find((error) => error.name === 'job_status')!;
    // expect: all three enum values present, order preserved
    expect(enumItem.values.map((value) => value.name)).toEqual(['pending', 'running', 'done']);
  });

  test('column that uses the imported enum has correct type_name', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const jobs = db.tables.find((token) => token.name === 'jobs')!;
    const statusField = jobs.fields.find((field) => field.name === 'status')!;
    // expect: field type resolves to the imported enum name
    expect(statusField.type.schemaName).toBeNull();
    expect(statusField.type.type_name).toBe('job_status');
  });
});

describe('[example] multifile interpreter - enum alias', () => {
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(filepath('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('alias name appears in exported schema (original name stripped)', () => {
    const db = getDatabase(compiler, '/main.dbml');
    // expect: exported under the alias "Status", not "job_status"
    expect(db.enums.find((error) => error.name === 'Status')).toBeDefined();
    expect(db.enums.find((error) => error.name === 'job_status')).toBeUndefined();
  });

  test('enum values are preserved under the alias', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const enumItem = db.enums.find((error) => error.name === 'Status')!;
    expect(enumItem.values.map((value) => value.name)).toEqual(['pending', 'running', 'done']);
  });

  test('column type references the alias name', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const jobs = db.tables.find((token) => token.name === 'jobs')!;
    const statusField = jobs.fields.find((field) => field.name === 'status')!;
    // expect: column type is "Status", the consumer-side alias
    expect(statusField.type.type_name).toBe('Status');
  });
});

describe('[example] multifile interpreter - enum declared with an inline alias', () => {
  const types = `
Enum users.status as S {
  active
  inactive
}

Table jobs {
  id int [pk]
  status S
}
`;

  test('pulled table column resolves the alias to the original enum', () => {
    const { compiler } = setupCompiler({
      '/types.dbml': types,
      '/main.dbml': `
use { table jobs } from './types.dbml'
`,
    });
    const db = getDatabase(compiler, '/main.dbml');
    const jobs = db.tables.find((token) => token.name === 'jobs')!;
    const statusField = jobs.fields.find((field) => field.name === 'status')!;
    // expect: the column type is the original enum, not the alias
    expect(statusField.type.schemaName).toBe('users');
    expect(statusField.type.type_name).toBe('status');
  });

  test('enum imported by its full name keeps the original name', () => {
    const { compiler } = setupCompiler({
      '/types.dbml': types,
      '/main.dbml': `
use { enum users.status } from './types.dbml'

Table tasks {
  status users.status
}
`,
    });
    const db = getDatabase(compiler, '/main.dbml');
    const tasks = db.tables.find((token) => token.name === 'tasks')!;
    const statusField = tasks.fields.find((field) => field.name === 'status')!;
    expect(statusField.type.schemaName).toBe('users');
    expect(statusField.type.type_name).toBe('status');
  });

  test('enum imported by full name resolves correctly even when alias is also in scope', () => {
    const { compiler } = setupCompiler({
      '/types.dbml': types,
      '/main.dbml': `
use { enum users.status } from './types.dbml'
use { enum S } from './types.dbml'

Table tasks {
  by_name users.status
  by_alias S
}
`,
    });
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.enums.find((error) => error.name === 'S')).toBeDefined();
    const tasks = db.tables.find((token) => token.name === 'tasks')!;
    const byName = tasks.fields.find((field) => field.name === 'by_name')!;
    const byAlias = tasks.fields.find((field) => field.name === 'by_alias')!;
    // both reference the same enum, canonical name is consistent
    expect(byName.type.schemaName).toBeNull();
    expect(byName.type.type_name).toBe('S');
    expect(byAlias.type.schemaName).toBeNull();
    expect(byAlias.type.type_name).toBe('S');
  });

  test('enum imported with a new alias behaves like a renamed import', () => {
    const { compiler } = setupCompiler({
      '/types.dbml': types,
      '/main.dbml': `
use { enum users.status as X } from './types.dbml'

Table tasks {
  status X
}
`,
    });
    const db = getDatabase(compiler, '/main.dbml');
    expect(db.enums.find((error) => error.name === 'X')).toBeDefined();
    const tasks = db.tables.find((token) => token.name === 'tasks')!;
    const statusField = tasks.fields.find((field) => field.name === 'status')!;
    expect(statusField.type.schemaName).toBeNull();
    expect(statusField.type.type_name).toBe('X');
  });

  test('enum imported by its alias behaves like a renamed import', () => {
    const { compiler } = setupCompiler({
      '/types.dbml': types,
      '/main.dbml': `
use { enum S } from './types.dbml'

Table tasks {
  status S
}
`,
    });
    const db = getDatabase(compiler, '/main.dbml');
    // expect: same as `use { enum users.status as S }`, so the consumer sees the name S
    expect(db.enums.find((error) => error.name === 'S')).toBeDefined();
    const tasks = db.tables.find((token) => token.name === 'tasks')!;
    expect(tasks.fields.find((field) => field.name === 'status')!.type.type_name).toBe('S');
  });
});

describe('[example] multifile interpreter - tablegroup pulls tables that reference enums', () => {
  // base.dbml defines an enum, tables using it, and a tablegroup
  // consumer imports the tablegroup and the enum should also appear in schema since the pulled table references it
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(filepath('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('pulled table has correct enum type on column', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((token) => token.name === 'users')!;
    const statusField = users.fields.find((field) => field.name === 'status')!;
    expect(statusField.type.type_name).toBe('status');
  });

  test('non-imported enum does NOT appear in schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.enums.find((error) => error.name === 'status')).toBeUndefined();
  });
});

describe('[stress] enum imported alongside table that uses it', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.enums.find((error) => error.name === 'status')).toBeDefined();
  });

  test('column type resolves to imported enum', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((token) => token.name === 'users')!;
    expect(users.fields.find((field) => field.name === 'status')!.type.type_name).toBe('status');
  });
});
