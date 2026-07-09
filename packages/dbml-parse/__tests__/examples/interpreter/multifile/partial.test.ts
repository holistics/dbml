import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { fp, setupCompiler } from './utils';

describe('[example] multifile interpreter - directly imported table loses partial-injected columns', () => {
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
`,
  });

  test('no binding errors', () => {
    const ast = compiler.parseFile(fp('/consumer.dbml')).getValue().ast;
    expect(compiler.bindNode(ast).getErrors()).toHaveLength(0);
  });

  test('imported table has own columns and partial reference', () => {
    const db = compiler.interpretFile(fp('/consumer.dbml')).getValue()! as any;
    const users = db.tables.find((t: any) => t.name === 'users')!;
    expect(users.fields.map((f: any) => f.name)).toEqual(['id', 'name']);
    expect(users.partials).toHaveLength(1);
    expect(users.partials[0].name).toBe('timestamps');
  });

  test('UNSUPPORTED error when importing table that uses out-of-scope partial', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    const errors = result.getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.UNSUPPORTED)).toBe(true);
  });
});


describe('[edge] same partial used by multiple imported tables - deduplicated', () => {
  const { compiler } = setupCompiler({
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

  test('UNSUPPORTED error for each imported table that uses out-of-scope partial', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    const errors = result.getErrors().filter((e) => e.code === CompileErrorCode.UNSUPPORTED);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});


describe('[edge] partial with inline ref - target table not in consumer scope', () => {
  const { compiler } = setupCompiler({
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

  test('UNSUPPORTED error when importing table that uses out-of-scope partial', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    const errors = result.getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.UNSUPPORTED)).toBe(true);
  });

  test('categories table is NOT in consumer scope', () => {
    const db = compiler.interpretFile(fp('/consumer.dbml')).getValue()! as any;
    expect(db.tables.find((t: any) => t.name === 'categories')).toBeUndefined();
  });
});


describe('[edge] two files define same-named partial - first wins', () => {
  const { compiler } = setupCompiler({
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

  test('UNSUPPORTED error for each imported table that uses out-of-scope partial', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    const errors = result.getErrors().filter((e) => e.code === CompileErrorCode.UNSUPPORTED);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});


describe('[edge] reuse chain: partial from deeply nested file', () => {
  // C defines partial, B defines table using it and reuses from C,
  // A reuses from B, consumer imports from A
  const { compiler } = setupCompiler({
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

  test('UNSUPPORTED error when partial from C is not in consumer scope', () => {
    const result = compiler.interpretFile(fp('/consumer.dbml'));
    const errors = result.getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.UNSUPPORTED)).toBe(true);
  });

  test('table has partial reference', () => {
    const db = compiler.interpretFile(fp('/consumer.dbml')).getValue()! as any;
    const users = db.tables.find((t: any) => t.name === 'users')!;
    expect(users.partials).toHaveLength(1);
  });
});
