import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - aliased table renamed in records', () => {
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('no export errors', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('record tableName uses alias', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const record = db.records.find((r) => r.tableName === 'u');
    expect(record).toBeDefined();
  });

  test('record values preserved', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const record = db.records.find((r) => r.tableName === 'u')!;
    expect(record.values).toHaveLength(2);
  });
});


describe('[example] multifile interpreter - records referencing imported table columns', () => {
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('no export errors', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    expect(result.getErrors()).toHaveLength(0);
  });

  test('records appear with correct table and values', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(2);
  });
});


describe('[example] multifile interpreter - records on table with partial-injected columns', () => {
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
`,
    '/consumer.dbml': `
use { table users } from './source.dbml'

records users(id, name, created_at, updated_at) {
  1, 'Alice', '2024-01-01', '2024-01-02'
}
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('UNSUPPORTED error when importing table that uses out-of-scope partial', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    expect(result.getErrors().some((e) => e.code === CompileErrorCode.UNSUPPORTED)).toBe(true);
  });
});


describe('[example] multifile interpreter - records on table with external partial-injected columns', () => {
  // Partial is in a separate file from the table. Table imports and injects it.
  // Consumer imports the table and writes records referencing injected columns.
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('UNSUPPORTED error when importing table that uses out-of-scope partial', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    expect(result.getErrors().some((e) => e.code === CompileErrorCode.UNSUPPORTED)).toBe(true);
  });
});


describe('[example] multifile interpreter - records defined in source file auto-pulled with imported table', () => {
  // source defines table + records. Consumer imports table.
  // Records should be auto-pulled as metadata on the table symbol.
  const { compiler } = setupCompiler({
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
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('records from source file are pulled into consumer schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(3);
  });
});


describe('[example] multifile interpreter - records auto-pulled with aliased table', () => {
  // source defines table + records. Consumer imports table with alias.
  // Records should appear under the alias name.
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.records.find((r) => r.tableName === 'u')).toBeDefined();
    expect(db.records.find((r) => r.tableName === 'users')).toBeUndefined();
  });
});


describe('[example] multifile interpreter - records NOT pulled when table not imported', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.records).toHaveLength(0);
  });
});


describe('[example] multifile interpreter - nested records inside imported table definition', () => {
  // Records nested inside the table block (not standalone).
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    const record = db.records.find((r) => r.tableName === 'users');
    expect(record).toBeDefined();
    expect(record!.values).toHaveLength(2);
  });
});


describe('[stress] multiple records blocks for same table across files', () => {
  const { compiler } = setupCompiler({
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

  test('duplicate records blocks across files is an error', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    expect(result.getErrors().some((e) => e.code === CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE)).toBe(true);
  });
});
