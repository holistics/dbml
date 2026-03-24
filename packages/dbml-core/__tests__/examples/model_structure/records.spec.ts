import Parser from '../../../src/parse/Parser';
import { test, beforeAll, describe, expect } from 'vitest';

const DBML = `
  Table users {
    id integer [pk]
    name varchar
  }

  Table posts {
    id integer [pk]
    content text
  }

  Records users(id, name) {
    1, "Alice"
    2, "Bob"
  }

  Records posts(id, content) {
    1, "Hello World"
  }
`;

describe('@dbml/core - model_structure - records', () => {
  let database: ReturnType<Parser['parse']>;

  beforeAll(() => {
    database = new Parser().parse(DBML, 'dbmlv2');
  });

  test('database.records contains all records', () => {
    expect(database.records.length).toBe(2);
  });

  test('table.records is populated after linking', () => {
    const usersTable = database.schemas[0].tables.find((t) => t.name === 'users');
    const postsTable = database.schemas[0].tables.find((t) => t.name === 'posts');

    expect(usersTable!.records.length).toBe(1);
    expect(postsTable!.records.length).toBe(1);
  });

  test('table.records holds the same object references as database.records', () => {
    const usersTable = database.schemas[0].tables.find((t) => t.name === 'users');

    expect(database.records).toContain(usersTable!.records[0]);
  });

  test('linked record has correct tableName and values', () => {
    const usersTable = database.schemas[0].tables.find((t) => t.name === 'users');
    const record = usersTable!.records[0];

    expect(record.tableName).toBe('users');
    expect(record.values.length).toBe(2);
  });

  test('linked record has tableId set to the table id', () => {
    const usersTable = database.schemas[0].tables.find((t) => t.name === 'users');
    expect(usersTable!.records[0].tableId).toBe(usersTable!.id);
  });

  test('table without records has empty records array', () => {
    const db = new Parser().parse(`
      Table empty_table {
        id integer [pk]
      }
    `, 'dbmlv2');

    expect(db.schemas[0].tables[0].records).toEqual([]);
  });

  describe('normalized model', () => {
    test('table has recordIds in normalized model', () => {
      const normalizedModel = database.normalize();
      const usersTable = database.schemas[0].tables.find((t) => t.name === 'users');
      const postsTable = database.schemas[0].tables.find((t) => t.name === 'posts');

      expect(normalizedModel.tables[usersTable!.id].recordIds).toEqual([usersTable!.records[0].id]);
      expect(normalizedModel.tables[postsTable!.id].recordIds).toEqual([postsTable!.records[0].id]);
    });

    test('normalized records contain tableId', () => {
      const normalizedModel = database.normalize();
      const usersTable = database.schemas[0].tables.find((t) => t.name === 'users');
      const recordId = usersTable!.records[0].id;

      expect(normalizedModel.records[recordId].tableId).toBe(usersTable!.id);
    });

    test('table without records has empty recordIds in normalized model', () => {
      const db = new Parser().parse(`
        Table empty_table {
          id integer [pk]
        }
      `, 'dbmlv2');

      const normalizedModel = db.normalize();
      const table = db.schemas[0].tables[0];
      expect(normalizedModel.tables[table.id].recordIds).toEqual([]);
    });
  });
});
