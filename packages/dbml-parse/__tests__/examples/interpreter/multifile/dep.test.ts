import { describe, expect, test } from 'vitest';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[example] multifile interpreter - cross-file standalone Dep with column-level endpoints', () => {
  // Dep is declared in the consumer, both endpoint tables come from the import.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table raw_orders {
  id int [pk]
  user_id int
}

Table stg_orders {
  id int [pk]
  user_id int
}
`,
    '/consumer.dbml': `
use { table raw_orders } from './base.dbml'
use { table stg_orders } from './base.dbml'

Dep: raw_orders.user_id -> stg_orders.user_id
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('standalone Dep appears in exported schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.deps).toHaveLength(1);
  });

  test('edge endpoints point to the correct tables and columns', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const edge = db.deps[0].edges[0];
    expect(edge.upstream.tableName).toBe('raw_orders');
    expect(edge.upstream.fieldNames).toEqual(['user_id']);
    expect(edge.downstream.tableName).toBe('stg_orders');
    expect(edge.downstream.fieldNames).toEqual(['user_id']);
  });
});


describe('[example] multifile interpreter - cross-file standalone Dep with bare-table endpoints', () => {
  // Bare-table endpoints (no .col). Verifies my 11.12 nodeRefereeOfDepEndpoint
  // and 11.18 extractTableFromDepEndpoint work across files.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table raw_orders {
  id int [pk]
}

Table stg_orders {
  id int [pk]
}
`,
    '/consumer.dbml': `
use { table raw_orders } from './base.dbml'
use { table stg_orders } from './base.dbml'

Dep: raw_orders -> stg_orders
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('bare-table Dep appears in exported schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.deps).toHaveLength(1);
    const edge = db.deps[0].edges[0];
    expect(edge.upstream.tableName).toBe('raw_orders');
    expect(edge.upstream.fieldNames ?? []).toHaveLength(0);
    expect(edge.downstream.tableName).toBe('stg_orders');
    expect(edge.downstream.fieldNames ?? []).toHaveLength(0);
  });
});


describe('[example] multifile interpreter - <- reverse-direction Dep normalizes across files', () => {
  // Consumer writes `Dep: stg_orders <- raw_orders`. Interpreter should swap so
  // canonical shape is upstream=raw_orders, downstream=stg_orders.
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table raw_orders {
  id int [pk]
}

Table stg_orders {
  id int [pk]
}
`,
    '/consumer.dbml': `
use { table raw_orders } from './base.dbml'
use { table stg_orders } from './base.dbml'

Dep: stg_orders <- raw_orders
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('upstream/downstream are swapped to canonical direction', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const edge = db.deps[0].edges[0];
    expect(edge.upstream.tableName).toBe('raw_orders');
    expect(edge.downstream.tableName).toBe('stg_orders');
  });
});


describe('[example] multifile interpreter - inline dep on imported column carried to consumer', () => {
  // Inline `[dep: -> ...]` on a column of an imported table must survive in the
  // consumer's exported schema.
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table accounts {
  id int [pk]
}

Table users {
  id int [pk]
  account_id int [dep: -> accounts.id]
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

  test('inline dep on users.account_id appears in exported schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    const users = db.tables.find((t) => t.name === 'users')!;
    const accountIdField = users.fields.find((f) => f.name === 'account_id')!;
    expect(accountIdField.inline_deps).toHaveLength(1);
    expect(accountIdField.inline_deps[0].direction).toBe('->');
    expect(accountIdField.inline_deps[0].tableName).toBe('accounts');
    expect(accountIdField.inline_deps[0].fieldNames).toContain('id');
  });
});


describe('[example] multifile interpreter - inline dep on imported table header pulled to db.deps', () => {
  // Inline `[dep: <- source]` on a Table header creates a table-level Dep that
  // lands in db.deps[].
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table raw_orders {
  id int [pk]
}

Table fct_orders [dep: <- raw_orders] {
  id int [pk]
}
`,
    '/consumer.dbml': `
use { table raw_orders } from './source.dbml'
use { table fct_orders } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('inline-header Dep appears in db.deps with correct upstream/downstream', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.deps).toHaveLength(1);
    const edge = db.deps[0].edges[0];
    expect(edge.upstream.tableName).toBe('raw_orders');
    expect(edge.downstream.tableName).toBe('fct_orders');
  });
});


describe('[example] multifile interpreter - standalone Dep between two imported tables auto-pulled', () => {
  // Source declares Dep; consumer imports both tables. Dep should auto-pull
  // (parallel to Ref auto-pull behavior).
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table raw_orders {
  id int [pk]
}

Table stg_orders {
  id int [pk]
}

Dep: raw_orders -> stg_orders
`,
    '/consumer.dbml': `
use { table raw_orders } from './source.dbml'
use { table stg_orders } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('Dep auto-pulled into consumer schema', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.deps).toHaveLength(1);
    const edge = db.deps[0].edges[0];
    expect(edge.upstream.tableName).toBe('raw_orders');
    expect(edge.downstream.tableName).toBe('stg_orders');
  });
});


describe('[example] multifile interpreter - Dep NOT pulled when one endpoint missing', () => {
  // Only one table imported; the Dep should be filtered out.
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table raw_orders {
  id int [pk]
}

Table stg_orders {
  id int [pk]
}

Dep: raw_orders -> stg_orders
`,
    '/consumer.dbml': `
use { table stg_orders } from './source.dbml'
`,
  });

  test('Dep is not pulled because raw_orders is out of scope', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.deps).toHaveLength(0);
  });
});


describe('[example] multifile interpreter - Dep with custom + note auto-pulled across files', () => {
  // Custom attrs and note attached to a Dep block must survive auto-pull.
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table raw_orders {
  id int [pk]
}

Table fct_orders {
  id int [pk]
}

Dep {
  raw_orders -> fct_orders

  note: 'Pipeline from raw to fact'
  materialized: table
  owner: 'data-team'
}
`,
    '/consumer.dbml': `
use { table raw_orders } from './source.dbml'
use { table fct_orders } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('Dep carries note + custom across files', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.deps).toHaveLength(1);
    const dep = db.deps[0];
    expect(dep.note?.value).toBe('Pipeline from raw to fact');
    expect(dep.custom).toEqual({
      materialized: 'table',
      owner: 'data-team',
    });
  });
});


describe('[example] multifile interpreter - aliased table referenced in cross-file Dep endpoints', () => {
  // Source declares Dep; consumer imports one table with alias.
  // The pulled Dep's endpoints must be rewritten to use the alias.
  const { compiler } = setupCompiler({
    '/source.dbml': `
Table raw_orders {
  id int [pk]
}

Table stg_orders {
  id int [pk]
}

Dep: raw_orders -> stg_orders
`,
    '/consumer.dbml': `
use { table raw_orders as raw } from './source.dbml'
use { table stg_orders } from './source.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('upstream endpoint uses alias name', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.deps).toHaveLength(1);
    const edge = db.deps[0].edges[0];
    expect(edge.upstream.tableName).toBe('raw');
    expect(edge.downstream.tableName).toBe('stg_orders');
  });
});


describe('[example] multifile interpreter - Dep between tables from different imported files', () => {
  // file-a defines raw_orders; file-b defines stg_orders + Dep targeting raw_orders.
  // Consumer imports both; the Dep in file-b must auto-pull.
  const { compiler } = setupCompiler({
    '/file-a.dbml': `
Table raw_orders {
  id int [pk]
}
`,
    '/file-b.dbml': `
use { table raw_orders } from './file-a.dbml'

Table stg_orders {
  id int [pk]
}

Dep: raw_orders -> stg_orders
`,
    '/consumer.dbml': `
use { table raw_orders } from './file-a.dbml'
use { table stg_orders } from './file-b.dbml'
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('both tables present and Dep auto-pulled', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.find((t) => t.name === 'raw_orders')).toBeDefined();
    expect(db.tables.find((t) => t.name === 'stg_orders')).toBeDefined();
    expect(db.deps).toHaveLength(1);
  });
});
