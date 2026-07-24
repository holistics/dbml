import Database from '../../../src/model_structure/database';
import { test, expect, describe } from 'vitest';

// Self-reference rule: a table may depend on itself (A -> A), a column may feed
// another column of its table (a.x -> a.y) or its own table (a.x -> a);
// only a column depending on itself (a.x -> a.x) is an error.
const rawDb = (edges: { up: string[]; down: string[] }[]) => ({
  schemas: [],
  aliases: [],
  tables: [
    {
      name: 'a',
      schemaName: 'public',
      fields: [
        { name: 'x', type: { type_name: 'int' } },
        { name: 'y', type: { type_name: 'int' } },
      ],
    },
  ],
  refs: [],
  enums: [],
  tableGroups: [],
  notes: [],
  records: [],
  tablePartials: [],
  deps: [
    {
      name: null,
      schemaName: 'public',
      edges: edges.map(({ up, down }) => ({
        upstream: { schemaName: null, tableName: 'a', fieldNames: up },
        downstream: { schemaName: null, tableName: 'a', fieldNames: down },
      })),
    },
  ],
});

describe('@dbml/core - Dep self-reference rule', () => {
  test('a table may depend on itself (A -> A)', () => {
    const database = new Database(rawDb([{ up: [], down: [] }]) as any);
    expect(database.schemas[0].deps[0].edges).toHaveLength(1);
  });

  test('a column may feed another column of the same table (a.x -> a.y)', () => {
    const database = new Database(rawDb([{ up: ['x'], down: ['y'] }]) as any);
    expect(database.schemas[0].deps[0].edges).toHaveLength(1);
  });

  test('a column may feed its own table (a.x -> a)', () => {
    const database = new Database(rawDb([{ up: ['x'], down: [] }]) as any);
    expect(database.schemas[0].deps[0].edges).toHaveLength(1);
  });

  test('a column cannot depend on itself (a.x -> a.x)', () => {
    expect(() => new Database(rawDb([{ up: ['x'], down: ['x'] }]) as any)).toThrow(/Self-loop/);
  });
});
