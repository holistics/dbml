import { describe, expect, test } from 'vitest';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - enum across files', () => {
  // types.dbml:  Enum job_status { pending running done }
  // main.dbml:   use { enum job_status } from './types.dbml'
  //              Table jobs { id int [pk]; status job_status }
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
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    // expect: zero binding errors - job_status resolves across file boundary
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported enum appears in exported schema', () => {
    const db = getDatabase(compiler, '/main.dbml');
    // expect: job_status enum is included as an external in the consumer's schema
    const e = db.enums.find((e) => e.name === 'job_status');
    expect(e).toBeDefined();
  });

  test('imported enum values are preserved', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const e = db.enums.find((e) => e.name === 'job_status')!;
    // expect: all three enum values present, order preserved
    expect(e.values.map((v) => v.name)).toEqual(['pending', 'running', 'done']);
  });

  test('column that uses the imported enum has correct type_name', () => {
    const db = getDatabase(compiler, '/main.dbml');
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
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('alias name appears in exported schema (original name stripped)', () => {
    const db = getDatabase(compiler, '/main.dbml');
    // expect: exported under the alias "Status", not "job_status"
    expect(db.enums.find((e) => e.name === 'Status')).toBeDefined();
    expect(db.enums.find((e) => e.name === 'job_status')).toBeUndefined();
  });

  test('enum values are preserved under the alias', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const e = db.enums.find((e) => e.name === 'Status')!;
    expect(e.values.map((v) => v.name)).toEqual(['pending', 'running', 'done']);
  });

  test('column type references the alias name', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const jobs = db.tables.find((t) => t.name === 'jobs')!;
    const statusField = jobs.fields.find((f) => f.name === 'status')!;
    // expect: column type is "Status", the consumer-side alias
    expect(statusField.type.type_name).toBe('Status');
  });
});


describe('[example] multifile interpreter - tablegroup pulls tables that reference enums', () => {
  // base.dbml defines an enum, tables using it, and a tablegroup.
  // consumer imports the tablegroup. The enum should also appear in schema
  // since the pulled table references it.
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('pulled table has correct enum type on column', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((t) => t.name === 'users')!;
    const statusField = users.fields.find((f) => f.name === 'status')!;
    expect(statusField.type.type_name).toBe('status');
  });

  test('non-imported enum does NOT appear in schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.enums.find((e) => e.name === 'status')).toBeUndefined();
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
    expect(db.enums.find((e) => e.name === 'status')).toBeDefined();
  });

  test('column type resolves to imported enum', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((t) => t.name === 'users')!;
    expect(users.fields.find((f) => f.name === 'status')!.type.type_name).toBe('status');
  });
});
