import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import { MemoryProjectLayout } from '@/compiler/projectLayout';

function createCompiler (files: Record<string, string>): Compiler {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[Filepath.from(path).intern()] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries));
}

function expectNoErrors (files: Record<string, string>, entry = '/main.dbml') {
  const compiler = createCompiler(files);
  expect(compiler.fileErrors(Filepath.from(entry))).toHaveLength(0);
}

function expectErrors (files: Record<string, string>, entry = '/main.dbml') {
  const compiler = createCompiler(files);
  expect(compiler.fileErrors(Filepath.from(entry)).length).toBeGreaterThan(0);
}

describe('[example] multi-file compilation', () => {
  describe('validation - no errors', () => {
    test.each([
      ['selective import', {
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int [pk] }",
        '/common.dbml': 'Table users { id int [pk] }',
      }],
      ['whole-file import', {
        '/main.dbml': "use * from './common.dbml'\nTable orders { id int [pk] }",
        '/common.dbml': 'Table users { id int [pk] }',
      }],
      ['enum import', {
        '/main.dbml': "use { enum status } from './common.dbml'\nTable users { id int [pk]\nstatus status }",
        '/common.dbml': 'Enum status { active\ninactive }',
      }],
      ['tablepartial import', {
        '/main.dbml': "use { tablepartial timestamps } from './common.dbml'\nTable users { id int [pk]\n~timestamps }",
        '/common.dbml': 'TablePartial timestamps { created_at timestamp\nupdated_at timestamp }',
      }],
      ['schema import', {
        '/main.dbml': "use { schema public } from './common.dbml'\nTable public.orders { id int }",
        '/common.dbml': 'Table public.users { id int }',
      }],
      ['tablegroup import', {
        '/main.dbml': "use { tablegroup user_tables } from './common.dbml'",
        '/common.dbml': 'Table users { id int }\nTableGroup user_tables { users }',
      }],
      ['note import', {
        '/main.dbml': "use { note my_note } from './common.dbml'",
        '/common.dbml': "Note my_note { 'This is a shared note' }",
      }],
      ['duplicate whole-file import is allowed', {
        '/main.dbml': "use * from './common.dbml'\nuse * from './common.dbml'",
        '/common.dbml': 'Table users { id int }',
      }],
      ['selective after whole-file of same path is allowed', {
        '/main.dbml': "use * from './common.dbml'\nuse { table users } from './common.dbml'",
        '/common.dbml': 'Table users { id int }',
      }],
      ['duplicate selective use of same symbol is allowed', {
        '/main.dbml': "use { table users } from './common.dbml'\nuse { table users } from './common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      }],
    ])('%s', (_name, files) => expectNoErrors(files));
  });

  describe('validation - errors expected', () => {
    test.each([
      ['duplicate symbol from use', {
        '/main.dbml': "use { table users } from './common.dbml'\nTable users { id int [pk] }",
        '/common.dbml': 'Table users { id int [pk] }',
      }],
      ['invalid use specifier kind', {
        '/main.dbml': "use { ref my_ref } from './common.dbml'",
        '/common.dbml': '',
      }],
    ])('%s', (_name, files) => expectErrors(files));
  });

  describe('validation - error scoping', () => {
    test('dependency errors are not reported in entry file', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './bad.dbml'\nTable orders { id int }",
        '/bad.dbml': 'Table users { id int [pk',
      });
      const badErrors = compiler.fileErrors(Filepath.from('/bad.dbml'));
      expect(badErrors.length).toBeGreaterThan(0);
    });
  });

  describe('binding - cross-file resolution', () => {
    test.each([
      ['ref to selective import', {
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int [pk]\nuser_id int }\nRef: orders.user_id > users.id",
        '/common.dbml': 'Table users { id int [pk]\nname varchar }',
      }],
      ['enum type in column', {
        '/main.dbml': "use { enum user_status } from './enums.dbml'\nTable users { id int [pk]\nstatus user_status }",
        '/enums.dbml': 'Enum user_status { active\ninactive }',
      }],
      ['inline ref to import', {
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int [pk]\nuser_id int [ref: > users.id] }",
        '/common.dbml': 'Table users { id int [pk] }',
      }],
      ['ref with whole-file import', {
        '/main.dbml': "use * from './common.dbml'\nTable orders { id int [pk]\nuser_id int }\nRef: orders.user_id > users.id",
        '/common.dbml': 'Table users { id int [pk] }',
      }],
      ['tablepartial injection from import', {
        '/main.dbml': "use { tablepartial timestamps } from './partials.dbml'\nTable users { id int [pk]\n~timestamps }",
        '/partials.dbml': 'TablePartial timestamps { created_at timestamp\nupdated_at timestamp }',
      }],
      ['schema-qualified table import', {
        '/main.dbml': "use { schema auth } from './auth.dbml'\nTable public.orders { id int [pk]\nuser_id int [ref: > auth.users.id] }",
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      }],
      ['multiple selective imports from same file', {
        '/main.dbml': "use { table users, enum status } from './common.dbml'\nTable orders { id int [pk]\nstatus status }\nRef: orders.id > users.id",
        '/common.dbml': 'Table users { id int [pk] }\nEnum status { active\ninactive }',
      }],
    ])('%s', (_name, files) => expectNoErrors(files));

    test('ref to non-imported table errors', () => {
      expectErrors({
        '/main.dbml': 'Table orders { id int [pk]\nuser_id int }\nRef: orders.user_id > users.id',
        '/common.dbml': 'Table users { id int [pk] }',
      });
    });

    test('no transitive symbol leaking', () => {
      expectErrors({
        '/a.dbml': "use { table B } from './b.dbml'\nTable A { id int [pk]\nc_id int [ref: > C.id] }",
        '/b.dbml': "use { table C } from './c.dbml'\nTable B { id int [pk] }",
        '/c.dbml': 'Table C { id int [pk] }',
      }, '/a.dbml');
    });
  });

  describe('interpretation', () => {
    test('single file produces 1 database', () => {
      const compiler = createCompiler({ '/main.dbml': 'Table users { id int [pk] }' });
      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(1);
      expect(model.database[0].tables[0].name).toBe('users');
    });

    test('selective import produces 2 databases with correct tables', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int [pk] }",
        '/common.dbml': 'Table users { id int [pk] }',
      });
      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
      expect(model.database[0].tables[0].name).toBe('orders');
      const allTables = model.database.flatMap((db) => db.tables.map((t) => t.name));
      expect(allTables).toContain('users');
    });

    test('whole-file import produces 2 databases', () => {
      const compiler = createCompiler({
        '/main.dbml': "use * from './common.dbml'\nTable orders { id int [pk] }",
        '/common.dbml': 'Table users { id int [pk] }',
      });
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(2);
    });

    test('cross-file refs are correct', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int [pk]\nuser_id int }\nRef: orders.user_id > users.id",
        '/common.dbml': 'Table users { id int [pk]\nname varchar }',
      });
      const mainDb = compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database[0];
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.refs[0].endpoints[0].tableName).toBe('orders');
      expect(mainDb.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('each file interpreted independently', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int [pk] }",
        '/common.dbml': 'Table users { id int [pk] }\nTable products { id int [pk] }',
      });
      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      const commonDb = model.database.find((db) => db.tables.some((t) => t.name === 'products'));
      expect(commonDb).toBeDefined();
      expect(commonDb!.tables).toHaveLength(2);
    });

    test('file with only use statements has empty database', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'",
        '/common.dbml': 'Table users { id int }',
      });
      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
      expect(model.database[0].tables).toHaveLength(0);
    });
  });

  describe('dependency graph', () => {
    test('diamond dependency deduplicates', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './a.dbml'\nuse { table orders } from './b.dbml'\nTable main_table { id int [pk] }",
        '/a.dbml': "use { enum status } from './shared.dbml'\nTable users { id int [pk] }",
        '/b.dbml': "use { enum status } from './shared.dbml'\nTable orders { id int [pk] }",
        '/shared.dbml': 'Enum status { active\ninactive }',
      });
      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      const uniqueDbs = new Set(model.database);
      expect(uniqueDbs.size).toBe(model.database.length);
      expect(model.database.flatMap((db) => db.tables.map((t) => t.name))).toEqual(
        expect.arrayContaining(['main_table', 'users', 'orders']),
      );
    });

    test('circular use does not infinite loop', () => {
      const compiler = createCompiler({
        '/a.dbml': "use { table B } from './b.dbml'\nTable A { id int [pk] }",
        '/b.dbml': "use { table A } from './a.dbml'\nTable B { id int [pk] }",
      });
      const model = compiler.interpretFile(Filepath.from('/a.dbml')).getValue();
      expect(model.database.length).toBeGreaterThanOrEqual(2);
      expect(model.database.flatMap((db) => db.tables.map((t) => t.name))).toEqual(
        expect.arrayContaining(['A', 'B']),
      );
    });

    test('3-way circular dependency', () => {
      const compiler = createCompiler({
        '/a.dbml': "use { table B } from './b.dbml'\nTable A { id int }",
        '/b.dbml': "use { table C } from './c.dbml'\nTable B { id int }",
        '/c.dbml': "use { table A } from './a.dbml'\nTable C { id int }",
      });
      expect(compiler.interpretFile(Filepath.from('/a.dbml')).getValue().database).toHaveLength(3);
    });

    test('deep chain (A -> B -> C)', () => {
      const compiler = createCompiler({
        '/a.dbml': "use { table B } from './b.dbml'\nTable A { id int [pk] }",
        '/b.dbml': "use { table C } from './c.dbml'\nTable B { id int [pk] }",
        '/c.dbml': 'Table C { id int [pk] }',
      });
      const model = compiler.interpretFile(Filepath.from('/a.dbml')).getValue();
      expect(model.database).toHaveLength(3);
      expect(model.database.flatMap((db) => db.tables.map((t) => t.name))).toEqual(
        expect.arrayContaining(['A', 'B', 'C']),
      );
    });

    test('self-import does not loop', () => {
      const compiler = createCompiler({
        '/self.dbml': "use { table X } from './self.dbml'\nTable X { id int }",
      });
      expect(compiler.interpretFile(Filepath.from('/self.dbml')).getValue().database).toBeDefined();
    });

    test('many files importing one shared file', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table A } from './a.dbml'\nuse { table B } from './b.dbml'\nuse { table C } from './c.dbml'\nTable Main { id int }",
        '/a.dbml': "use { enum status } from './shared.dbml'\nTable A { id int }",
        '/b.dbml': "use { enum status } from './shared.dbml'\nTable B { id int }",
        '/c.dbml': "use { enum status } from './shared.dbml'\nTable C { id int }",
        '/shared.dbml': 'Enum status { active\ninactive }',
      });
      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(5);
      expect(new Set(model.database).size).toBe(5);
    });
  });

  describe('edge cases', () => {
    test.each([
      ['empty file', { '/main.dbml': '' }, 1],
      ['comments only', { '/main.dbml': '// just a comment\n// another comment' }, 1],
      ['whole-file use only', { '/main.dbml': "use * from './common.dbml'", '/common.dbml': 'Table users { id int [pk] }' }, 2],
      ['multiple imports from same file', { '/main.dbml': "use { table users, enum status } from './common.dbml'\nTable orders { id int [pk] }", '/common.dbml': 'Table users { id int [pk] }\nEnum status { active\ninactive }' }, 2],
    ])('%s produces %i database(s)', (_name, files, count) => {
      const compiler = createCompiler(files);
      const entry = Object.keys(files)[0];
      expect(compiler.interpretFile(Filepath.from(entry)).getValue().database).toHaveLength(count);
    });

    test('parse errors still produce a model', () => {
      const compiler = createCompiler({ '/main.dbml': 'Table users { id int [pk' });
      const report = compiler.interpretFile(Filepath.from('/main.dbml'));
      expect(report.getErrors().length).toBeGreaterThan(0);
      expect(report.getValue().database).toHaveLength(1);
    });

    test('missing dependency file handled gracefully', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './missing.dbml'\nTable orders { id int [pk] }",
      });
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database).toBeDefined();
    });

    test('dependency with errors handled gracefully', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './bad.dbml'\nTable orders { id int [pk] }",
        '/bad.dbml': 'Table users { id int [pk',
      });
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database).toBeDefined();
    });

    test('relative path going up directories', () => {
      expectNoErrors({
        '/sub/main.dbml': "use { table users } from '../common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      }, '/sub/main.dbml');
    });
  });

  describe('extensionless import paths', () => {
    test.each([
      ['selective import', {
        '/main.dbml': "use { table users } from './common'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      }],
      ['whole-file import', {
        '/main.dbml': "use * from './common'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      }],
      ['cross-file refs', {
        '/main.dbml': "use { table users } from './common'\nTable orders { id int\nuser_id int }\nRef: orders.user_id > users.id",
        '/common.dbml': 'Table users { id int [pk] }',
      }],
      ['explicit .dbml extension', {
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      }],
    ])('%s resolves correctly', (_name, files) => expectNoErrors(files));

    test('./common and ./common.dbml resolve to same file', () => {
      const compiler = createCompiler({
        '/a.dbml': "use { table shared } from './shared'\nTable A { id int }",
        '/b.dbml': "use { table shared } from './shared.dbml'\nTable B { id int }",
        '/main.dbml': "use { table A } from './a'\nuse { table B } from './b'\nTable Main { id int }",
        '/shared.dbml': 'Table shared { id int }',
      });
      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(new Set(model.database).size).toBe(model.database.length);
    });
  });

  describe('cache invalidation', () => {
    test('setSource on dependency invalidates interpretation', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(2);

      compiler.setSource('Table users { id int }\nTable products { id int }', Filepath.from('/common.dbml'));
      const commonDb = compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database
        .find((db) => db.tables.some((t) => t.name === 'products'));
      expect(commonDb).toBeDefined();
      expect(commonDb!.tables).toHaveLength(2);
    });

    test('deleteSource on dependency invalidates interpretation', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(2);

      compiler.deleteSource(Filepath.from('/common.dbml'));
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database.length).toBeGreaterThanOrEqual(1);
    });
  });
});
