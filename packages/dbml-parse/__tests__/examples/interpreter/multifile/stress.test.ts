import { describe, expect, test } from 'vitest';
import { fp, getDatabase, setupCompiler } from './utils';

describe('[stress] transitive reuse: A reuses B reuses C, all metadata follows', () => {
  const { compiler } = setupCompiler({
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
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
  });

  test('ref follows through reuse chain', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.refs).toHaveLength(1);
  });

  test('records follow through reuse chain', () => {
    const db = getDatabase(compiler, '/consumer.dbml');
    expect(db.records.find((r) => r.tableName === 'users')).toBeDefined();
  });
});
