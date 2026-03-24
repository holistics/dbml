import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import { MemoryProjectLayout } from '@/compiler/projectLayout';
import { CompileErrorCode } from '@/core/errors';
import type { Model, Database } from '@/core/interpreter/types';
import { ExternalSymbol } from '@/core/validator/symbol/symbols';

function createCompiler (files: Record<string, string>): Compiler {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[Filepath.from(path).intern()] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries));
}

describe('[example] multi-file compilation', () => {
  describe('validation', () => {
    test('should validate use with selective imports', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
            name varchar
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should validate use with whole-file import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use * from './common.dbml'
          Table orders {
            id int [pk]
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should report error on duplicate symbol from use', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table users {
            id int [pk]
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should validate enum import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { enum status } from './common.dbml'
          Table users {
            id int [pk]
            status status
          }
        `,
        '/common.dbml': `
          Enum status {
            active
            inactive
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should validate tablepartial import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { tablepartial timestamps } from './common.dbml'
          Table users {
            id int [pk]
            ~timestamps
          }
        `,
        '/common.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should report error for invalid use specifier kind', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { ref my_ref } from './common.dbml'
        `,
        '/common.dbml': '',
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should allow duplicate whole-file import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use * from './common.dbml'
          use * from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should allow selective use after whole-file use of same path', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use * from './common.dbml'
          use { table users } from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should allow duplicate selective use of same symbol', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          use { table users } from './common.dbml'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should validate schema import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { schema public } from './common.dbml'
          Table public.orders { id int }
        `,
        '/common.dbml': `
          Table public.users { id int }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should validate tablegroup import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { tablegroup user_tables } from './common.dbml'
        `,
        '/common.dbml': `
          Table users { id int }
          TableGroup user_tables {
            users
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should validate note import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { note my_note } from './common.dbml'
        `,
        '/common.dbml': `
          Note my_note {
            'This is a shared note'
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should not report errors for dependency file in entry file errors', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './bad.dbml'
          Table orders { id int }
        `,
        '/bad.dbml': 'Table users { id int [pk',
      });

      // bad.dbml has parse errors, but main.dbml's fileErrors should not include them
      const mainErrors = compiler.fileErrors(Filepath.from('/main.dbml'));
      const badErrors = compiler.fileErrors(Filepath.from('/bad.dbml'));
      expect(badErrors.length).toBeGreaterThan(0);
      // main.dbml errors should only be about main.dbml itself
      mainErrors.forEach((e) => {
        expect(e.start).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('binding', () => {
    test('should resolve cross-file table reference in ref', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
            name varchar
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should resolve cross-file enum type in column', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { enum user_status } from './enums.dbml'
          Table users {
            id int [pk]
            status user_status
          }
        `,
        '/enums.dbml': `
          Enum user_status {
            active
            inactive
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should resolve inline ref to imported table', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int [ref: > users.id]
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should resolve ref with whole-file import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use * from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should report binding error for ref to non-imported table', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should resolve tablepartial injection from imported file', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { tablepartial timestamps } from './partials.dbml'
          Table users {
            id int [pk]
            ~timestamps
          }
        `,
        '/partials.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should resolve schema-qualified table import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.orders {
            id int [pk]
            user_id int [ref: > auth.users.id]
          }
        `,
        '/auth.dbml': `
          Table auth.users {
            id int [pk]
          }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should not leak symbols from dependency into dependent without use', () => {
      const compiler = createCompiler({
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A {
            id int [pk]
            c_id int [ref: > C.id]
          }
        `,
        '/b.dbml': `
          use { table C } from './c.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': 'Table C { id int [pk] }',
      });

      const errors = compiler.fileErrors(Filepath.from('/a.dbml'));
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should resolve symbols from multiple selective imports from same file', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users, enum status } from './common.dbml'
          Table orders {
            id int [pk]
            status status
          }
          Ref: orders.id > users.id
        `,
        '/common.dbml': `
          Table users { id int [pk] }
          Enum status { active\ninactive }
        `,
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });
  });

  describe('interpretation', () => {
    test('should return Model with single database for single file', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(1);
      expect(model.database[0].tables).toHaveLength(1);
      expect(model.database[0].tables[0].name).toBe('users');
    });

    test('should collect databases from imported files', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);

      const allTables = model.database.flatMap((db) => db.tables.map((t) => t.name));
      expect(allTables).toContain('orders');
      expect(allTables).toContain('users');
    });

    test('should collect databases from whole-file import', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use * from './common.dbml'
          Table orders {
            id int [pk]
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
    });

    test('should handle diamond dependency without duplicates', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './a.dbml'
          use { table orders } from './b.dbml'
          Table main_table {
            id int [pk]
          }
        `,
        '/a.dbml': `
          use { enum status } from './shared.dbml'
          Table users {
            id int [pk]
          }
        `,
        '/b.dbml': `
          use { enum status } from './shared.dbml'
          Table orders {
            id int [pk]
          }
        `,
        '/shared.dbml': `
          Enum status {
            active
            inactive
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();

      // No duplicate Database objects (reference equality)
      const uniqueDbs = new Set(model.database);
      expect(uniqueDbs.size).toBe(model.database.length);

      const allTables = model.database.flatMap((db) => db.tables.map((t) => t.name));
      expect(allTables).toContain('main_table');
      expect(allTables).toContain('users');
      expect(allTables).toContain('orders');
    });

    test('should handle circular use without infinite recursion', () => {
      const compiler = createCompiler({
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A {
            id int [pk]
          }
        `,
        '/b.dbml': `
          use { table A } from './a.dbml'
          Table B {
            id int [pk]
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/a.dbml')).getValue();
      expect(model.database.length).toBeGreaterThanOrEqual(2);

      const allTables = model.database.flatMap((db) => db.tables.map((t) => t.name));
      expect(allTables).toContain('A');
      expect(allTables).toContain('B');
    });

    test('should produce correct refs across files', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
            name varchar
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      const mainDb = model.database[0];
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.refs[0].endpoints[0].tableName).toBe('orders');
      expect(mainDb.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('should interpret each file independently in the model', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
          Table products {
            id int [pk]
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);

      // common.dbml's database should contain both users and products
      const commonDb = model.database.find((db) => db.tables.some((t) => t.name === 'products'));
      expect(commonDb).toBeDefined();
      expect(commonDb!.tables).toHaveLength(2);
    });

    test('entry file database should be first in array', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database[0].tables[0].name).toBe('orders');
    });

    test('should interpret enums from imported file', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { enum status } from './enums.dbml'
          Table users {
            id int
            status status
          }
        `,
        '/enums.dbml': `
          Enum status { active\ninactive\nsuspended }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      const enumDb = model.database.find((db) => db.enums.length > 0);
      expect(enumDb).toBeDefined();
      expect(enumDb!.enums[0].name).toBe('status');
      expect(enumDb!.enums[0].values).toHaveLength(3);
    });

    test('should interpret tablegroup with pulled member tables', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { tablegroup user_tables } from './groups.dbml'
        `,
        '/groups.dbml': `
          Table users { id int }
          Table profiles { id int }
          TableGroup user_tables {
            users
            profiles
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database.length).toBeGreaterThanOrEqual(1);
    });

    test('should produce empty database for file with only use statements', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
      // main has no tables of its own
      expect(model.database[0].tables).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('should handle empty file', () => {
      const compiler = createCompiler({
        '/main.dbml': '',
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(1);
      expect(model.database[0].tables).toHaveLength(0);
    });

    test('should handle file with only use statement', () => {
      const compiler = createCompiler({
        '/main.dbml': "use * from './common.dbml'",
        '/common.dbml': `
          Table users {
            id int [pk]
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
    });

    test('should handle file with parse errors', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          Table users {
            id int [pk
        `,
      });

      const report = compiler.interpretFile(Filepath.from('/main.dbml'));
      expect(report.getErrors().length).toBeGreaterThan(0);
      expect(report.getValue().database).toHaveLength(1);
    });

    test('should handle missing dependency file gracefully', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './missing.dbml'
          Table orders {
            id int [pk]
          }
        `,
      });

      const report = compiler.interpretFile(Filepath.from('/main.dbml'));
      // Should still return a model (with errors)
      expect(report.getValue().database).toBeDefined();
    });

    test('should handle dependency file with errors', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users } from './bad.dbml'
          Table orders {
            id int [pk]
          }
        `,
        '/bad.dbml': `
          Table users {
            id int [pk
        `,
      });

      const report = compiler.interpretFile(Filepath.from('/main.dbml'));
      expect(report.getValue().database).toBeDefined();
    });

    test('should handle deep dependency chain', () => {
      const compiler = createCompiler({
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          use { table C } from './c.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': `
          Table C { id int [pk] }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/a.dbml')).getValue();
      expect(model.database).toHaveLength(3);

      const allTables = model.database.flatMap((db) => db.tables.map((t) => t.name));
      expect(allTables).toContain('A');
      expect(allTables).toContain('B');
      expect(allTables).toContain('C');
    });

    test('should handle multiple imports from same file', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table users, enum status } from './common.dbml'
          Table orders {
            id int [pk]
          }
        `,
        '/common.dbml': `
          Table users {
            id int [pk]
          }
          Enum status {
            active
            inactive
          }
        `,
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      // Same file imported once = 2 databases (main + common)
      expect(model.database).toHaveLength(2);
    });

    test('should not propagate transitive use visibility', () => {
      const compiler = createCompiler({
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A {
            id int [pk]
            b_id int [ref: > B.id]
          }
        `,
        '/b.dbml': `
          use { table C } from './c.dbml'
          Table B {
            id int [pk]
          }
        `,
        '/c.dbml': `
          Table C { id int [pk] }
        `,
      });

      // a.dbml should NOT be able to reference C directly (no transitive use)
      const compilerWithTransitiveRef = createCompiler({
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A {
            id int [pk]
            c_id int [ref: > C.id]
          }
        `,
        '/b.dbml': `
          use { table C } from './c.dbml'
          Table B {
            id int [pk]
          }
        `,
        '/c.dbml': `
          Table C { id int [pk] }
        `,
      });

      const errors = compilerWithTransitiveRef.fileErrors(Filepath.from('/a.dbml'));
      // Should have errors because C is not directly imported
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should handle file that imports itself', () => {
      const compiler = createCompiler({
        '/self.dbml': `
          use { table X } from './self.dbml'
          Table X { id int }
        `,
      });

      // Should not infinite loop; may have errors
      const report = compiler.interpretFile(Filepath.from('/self.dbml'));
      expect(report.getValue().database).toBeDefined();
    });

    test('should handle 3-way circular dependency', () => {
      const compiler = createCompiler({
        '/a.dbml': "use { table B } from './b.dbml'\nTable A { id int }",
        '/b.dbml': "use { table C } from './c.dbml'\nTable B { id int }",
        '/c.dbml': "use { table A } from './a.dbml'\nTable C { id int }",
      });

      const model = compiler.interpretFile(Filepath.from('/a.dbml')).getValue();
      expect(model.database).toHaveLength(3);
    });

    test('should handle file with no declarations only comments', () => {
      const compiler = createCompiler({
        '/main.dbml': "// just a comment\n// another comment",
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(1);
      expect(model.database[0].tables).toHaveLength(0);
    });

    test('should handle use with relative path going up directories', () => {
      const compiler = createCompiler({
        '/sub/main.dbml': "use { table users } from '../common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });

      const errors = compiler.fileErrors(Filepath.from('/sub/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should handle many files importing from one shared file', () => {
      const compiler = createCompiler({
        '/main.dbml': `
          use { table A } from './a.dbml'
          use { table B } from './b.dbml'
          use { table C } from './c.dbml'
          Table Main { id int }
        `,
        '/a.dbml': "use { enum status } from './shared.dbml'\nTable A { id int }",
        '/b.dbml': "use { enum status } from './shared.dbml'\nTable B { id int }",
        '/c.dbml': "use { enum status } from './shared.dbml'\nTable C { id int }",
        '/shared.dbml': 'Enum status { active\ninactive }',
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      // main + a + b + c + shared = 5
      expect(model.database).toHaveLength(5);
      const uniqueDbs = new Set(model.database);
      expect(uniqueDbs.size).toBe(5);
    });
  });

  describe('extensionless import paths', () => {
    test('should resolve extensionless path by appending .dbml', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
    });

    test('should resolve extensionless whole-file import', () => {
      const compiler = createCompiler({
        '/main.dbml': "use * from './common'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should resolve cross-file refs with extensionless path', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common'\nTable orders {\n  id int\n  user_id int\n}\nRef: orders.user_id > users.id",
        '/common.dbml': 'Table users {\n  id int [pk]\n}',
      });

      const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
      expect(errors).toHaveLength(0);
    });

    test('should treat ./common and ./common.dbml as the same file', () => {
      const compiler = createCompiler({
        '/a.dbml': "use { table shared } from './shared'\nTable A { id int }",
        '/b.dbml': "use { table shared } from './shared.dbml'\nTable B { id int }",
        '/main.dbml': "use { table A } from './a'\nuse { table B } from './b'\nTable Main { id int }",
        '/shared.dbml': 'Table shared { id int }',
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      // shared.dbml should appear only once even though referenced with and without extension
      const uniqueDbs = new Set(model.database);
      expect(uniqueDbs.size).toBe(model.database.length);
    });

    test('should work with explicit .dbml extension as before', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });

      const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
    });
  });

  describe('cache invalidation', () => {
    test('should reflect changes when dependency file is updated via setSource', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });

      const model1 = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model1.database).toHaveLength(2);

      // Update common.dbml to add a new table
      compiler.setSource('Table users { id int }\nTable products { id int }', Filepath.from('/common.dbml'));

      const model2 = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      const commonDb = model2.database.find((db) => db.tables.some((t) => t.name === 'products'));
      expect(commonDb).toBeDefined();
      expect(commonDb!.tables).toHaveLength(2);
    });

    test('should reflect changes when dependency file is deleted', () => {
      const compiler = createCompiler({
        '/main.dbml': "use { table users } from './common.dbml'\nTable orders { id int }",
        '/common.dbml': 'Table users { id int }',
      });

      const model1 = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model1.database).toHaveLength(2);

      compiler.deleteSource(Filepath.from('/common.dbml'));

      const model2 = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
      // common.dbml is now empty string, produces empty db
      expect(model2.database.length).toBeGreaterThanOrEqual(1);
    });
  });
});
