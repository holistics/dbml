import Parser from '../../../src/parse/Parser';
import { Filepath } from '@dbml/parse';
import { describe, test, expect } from 'vitest';

function allTables (database: any) {
  return database.schemas.flatMap((s: any) => s.tables);
}

describe('@dbml/core', () => {
  describe('multifile', () => {
    test('setDbmlSource and parseDbmlProject with single file', () => {
      const parser = new Parser();
      const entry = Filepath.from('/main.dbml');
      parser.setDbmlSource(entry, `
        Table users {
          id integer [pk]
          name varchar
        }
      `);

      const database = parser.parseDbmlProject(entry);
      const tables = allTables(database);
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('users');
    });

    test('setDbmlSource and parseDbmlProject with multiple files', () => {
      const parser = new Parser();
      const main = Filepath.from('/main.dbml');
      const users = Filepath.from('/users.dbml');

      parser.setDbmlSource(users, `
        Table users {
          id integer [pk]
          name varchar
        }
      `);
      parser.setDbmlSource(main, `
        use { table users } from './users.dbml'

        Table posts {
          id integer [pk]
          user_id integer [ref: > users.id]
          title varchar
        }
      `);

      const database = parser.parseDbmlProject(main);
      const tables = allTables(database);
      expect(tables).toHaveLength(2);

      const tableNames = tables.map((t: any) => t.name).sort();
      expect(tableNames).toEqual(['posts', 'users']);
    });

    test('setDbmlSource with undefined removes the file', () => {
      const parser = new Parser();
      const entry = Filepath.from('/main.dbml');

      parser.setDbmlSource(entry, 'Table users { id integer [pk] }');
      let database = parser.parseDbmlProject(entry);
      expect(allTables(database)).toHaveLength(1);

      parser.setDbmlSource(entry, undefined);
      database = parser.parseDbmlProject(entry);
      expect(allTables(database)).toHaveLength(0);
    });

    test('parseDbmlProject throws on syntax errors', () => {
      const parser = new Parser();
      const entry = Filepath.from('/main.dbml');
      parser.setDbmlSource(entry, 'Table {{{ invalid');

      expect(() => parser.parseDbmlProject(entry)).toThrow();
    });

    test('multifile with enum across files', () => {
      const parser = new Parser();
      parser.setDbmlSource(Filepath.from('/types.dbml'), `
        Enum status {
          active
          inactive
        }
      `);
      parser.setDbmlSource(Filepath.from('/main.dbml'), `
        use { enum status } from './types.dbml'

        Table users {
          id integer [pk]
          status status
        }
      `);

      const database = parser.parseDbmlProject(Filepath.from('/main.dbml'));
      const tables = allTables(database);
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('users');
    });

    test('multifile with cross-file refs', () => {
      const parser = new Parser();
      parser.setDbmlSource(Filepath.from('/users.dbml'), `
        Table users {
          id integer [pk]
        }
      `);
      parser.setDbmlSource(Filepath.from('/main.dbml'), `
        use { table users } from './users.dbml'

        Table posts {
          id integer [pk]
          user_id integer [ref: > users.id]
        }

        Table comments {
          id integer [pk]
          post_id integer [ref: > posts.id]
          user_id integer [ref: > users.id]
        }
      `);

      const database = parser.parseDbmlProject(Filepath.from('/main.dbml'));
      const tables = allTables(database);
      expect(tables).toHaveLength(3);

      const refs = database.schemas.flatMap((s: any) => s.refs);
      expect(refs.length).toBeGreaterThanOrEqual(3);
    });

    test('deleteDbmlSource removes a single file', () => {
      const parser = new Parser();
      const main = Filepath.from('/main.dbml');
      const users = Filepath.from('/users.dbml');

      parser.setDbmlSource(users, `
        Table users {
          id integer [pk]
        }
      `);
      parser.setDbmlSource(main, `
        use { table users } from './users.dbml'

        Table posts {
          id integer [pk]
          user_id integer [ref: > users.id]
        }
      `);

      expect(allTables(parser.parseDbmlProject(main))).toHaveLength(2);

      parser.deleteDbmlSource(users);
      // After deleting users.dbml, parsing main should fail because the import can't resolve
      expect(() => parser.parseDbmlProject(main)).toThrow();
    });

    test('clearDbmlSource removes all files', () => {
      const parser = new Parser();
      const entry = Filepath.from('/main.dbml');

      parser.setDbmlSource(entry, 'Table users { id integer [pk] }');
      expect(allTables(parser.parseDbmlProject(entry))).toHaveLength(1);

      parser.clearDbmlSource();
      // After clearing all sources, parsing should return empty or throw
      const database = parser.parseDbmlProject(entry);
      expect(allTables(database)).toHaveLength(0);
    });

    test('updating source invalidates cache', () => {
      const parser = new Parser();
      const entry = Filepath.from('/main.dbml');

      parser.setDbmlSource(entry, `
        Table users {
          id integer [pk]
        }
      `);
      expect(allTables(parser.parseDbmlProject(entry))).toHaveLength(1);

      parser.setDbmlSource(entry, `
        Table users {
          id integer [pk]
        }
        Table posts {
          id integer [pk]
        }
      `);
      expect(allTables(parser.parseDbmlProject(entry))).toHaveLength(2);
    });
  });
});
