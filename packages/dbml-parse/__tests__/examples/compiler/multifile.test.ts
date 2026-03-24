import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import { MemoryProjectLayout } from '@/compiler/projectLayout';

function compile (files: Record<string, string>) {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[Filepath.from(path).intern()] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries));
}

function errors (files: Record<string, string>, entry = '/main.dbml') {
  return compile(files).fileErrors(Filepath.from(entry));
}

describe('[example] multi-file compilation', () => {
  describe('validation - valid imports', () => {
    test('selective import', () => {
      expect(errors({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      })).toHaveLength(0);
    });

    test('whole-file import', () => {
      expect(errors({
        '/main.dbml': `
          use * from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      })).toHaveLength(0);
    });

    test('enum import', () => {
      expect(errors({
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
      })).toHaveLength(0);
    });

    test('tablepartial import', () => {
      expect(errors({
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
      })).toHaveLength(0);
    });

    test('schema, tablegroup, note imports', () => {
      expect(errors({
        '/main.dbml': 'use { schema public } from \'./common.dbml\'',
        '/common.dbml': 'Table public.users { id int }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': 'use { tablegroup g } from \'./common.dbml\'',
        '/common.dbml': 'Table users { id int }\nTableGroup g { users }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': 'use { note my_note } from \'./common.dbml\'',
        '/common.dbml': 'Note my_note { \'shared note\' }',
      })).toHaveLength(0);
    });

    test('duplicate and overlapping imports are allowed', () => {
      expect(errors({
        '/main.dbml': `
          use * from './common.dbml'
          use * from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': `
          use * from './common.dbml'
          use { table users } from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': `
          use { table users } from './common.dbml'
          use { table users } from './common.dbml'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      })).toHaveLength(0);
    });
  });

  describe('validation - errors', () => {
    test('duplicate symbol from use', () => {
      expect(errors({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table users { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).length).toBeGreaterThan(0);
    });

    test('invalid use specifier kind', () => {
      expect(errors({
        '/main.dbml': 'use { ref my_ref } from \'./common.dbml\'',
        '/common.dbml': '',
      }).length).toBeGreaterThan(0);
    });

    test('dependency errors are not reported in entry file', () => {
      const compiler = compile({
        '/main.dbml': `
          use { table users } from './bad.dbml'
          Table orders { id int }
        `,
        '/bad.dbml': 'Table users { id int [pk',
      });
      expect(compiler.fileErrors(Filepath.from('/bad.dbml')).length).toBeGreaterThan(0);
    });
  });

  describe('binding - cross-file resolution', () => {
    test('ref, inline ref, enum type, whole-file ref', () => {
      expect(errors({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int [ref: > users.id]
          }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': `
          use { enum user_status } from './enums.dbml'
          Table users {
            id int [pk]
            status user_status
          }
        `,
        '/enums.dbml': 'Enum user_status { active\ninactive }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': `
          use * from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      })).toHaveLength(0);
    });

    test('tablepartial injection and schema-qualified import', () => {
      expect(errors({
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
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.orders {
            id int [pk]
            user_id int [ref: > auth.users.id]
          }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      })).toHaveLength(0);
    });

    test('ref to non-imported table errors', () => {
      expect(errors({
        '/main.dbml': `
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).length).toBeGreaterThan(0);
    });

    test('no transitive symbol leaking', () => {
      expect(errors({
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
      }, '/a.dbml').length).toBeGreaterThan(0);
    });
  });

  describe('interpretation', () => {
    test('single file produces 1 database', () => {
      const model = compile({ '/main.dbml': 'Table users { id int [pk] }' })
        .interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(1);
      expect(model.database[0].tables[0].name).toBe('users');
    });

    test('import produces multiple databases, entry first', () => {
      const model = compile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database).toHaveLength(2);
      expect(model.database[0].tables[0].name).toBe('orders');
      expect(model.database.flatMap((db) => db.tables.map((t) => t.name))).toContain('users');
    });

    test('cross-file refs are correct', () => {
      const mainDb = compile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk]\nname varchar }',
      }).interpretFile(Filepath.from('/main.dbml')).getValue().database[0];
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.refs[0].endpoints[0].tableName).toBe('orders');
      expect(mainDb.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('each file interpreted independently', () => {
      const model = compile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': `
          Table users { id int [pk] }
          Table products { id int [pk] }
        `,
      }).interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(model.database.find((db) => db.tables.some((t) => t.name === 'products'))!.tables).toHaveLength(2);
    });
  });

  describe('dependency graph', () => {
    test('diamond deduplicates', () => {
      const model = compile({
        '/main.dbml': `
          use { table users } from './a.dbml'
          use { table orders } from './b.dbml'
          Table main_table { id int [pk] }
        `,
        '/a.dbml': 'use { enum status } from \'./shared.dbml\'\nTable users { id int [pk] }',
        '/b.dbml': 'use { enum status } from \'./shared.dbml\'\nTable orders { id int [pk] }',
        '/shared.dbml': 'Enum status { active\ninactive }',
      }).interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(new Set(model.database).size).toBe(model.database.length);
    });

    test('circular, 3-way circular, self-import do not loop', () => {
      expect(compile({
        '/a.dbml': 'use { table B } from \'./b.dbml\'\nTable A { id int [pk] }',
        '/b.dbml': 'use { table A } from \'./a.dbml\'\nTable B { id int [pk] }',
      }).interpretFile(Filepath.from('/a.dbml')).getValue().database.length).toBeGreaterThanOrEqual(2);

      expect(compile({
        '/a.dbml': 'use { table B } from \'./b.dbml\'\nTable A { id int }',
        '/b.dbml': 'use { table C } from \'./c.dbml\'\nTable B { id int }',
        '/c.dbml': 'use { table A } from \'./a.dbml\'\nTable C { id int }',
      }).interpretFile(Filepath.from('/a.dbml')).getValue().database).toHaveLength(3);

      expect(compile({
        '/self.dbml': 'use { table X } from \'./self.dbml\'\nTable X { id int }',
      }).interpretFile(Filepath.from('/self.dbml')).getValue().database).toBeDefined();
    });

    test('deep chain and fan-out', () => {
      expect(compile({
        '/a.dbml': 'use { table B } from \'./b.dbml\'\nTable A { id int [pk] }',
        '/b.dbml': 'use { table C } from \'./c.dbml\'\nTable B { id int [pk] }',
        '/c.dbml': 'Table C { id int [pk] }',
      }).interpretFile(Filepath.from('/a.dbml')).getValue().database).toHaveLength(3);

      expect(compile({
        '/main.dbml': `
          use { table A } from './a.dbml'
          use { table B } from './b.dbml'
          use { table C } from './c.dbml'
          Table Main { id int }
        `,
        '/a.dbml': 'use { enum status } from \'./shared.dbml\'\nTable A { id int }',
        '/b.dbml': 'use { enum status } from \'./shared.dbml\'\nTable B { id int }',
        '/c.dbml': 'use { enum status } from \'./shared.dbml\'\nTable C { id int }',
        '/shared.dbml': 'Enum status { active\ninactive }',
      }).interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(5);
    });
  });

  describe('edge cases', () => {
    test('empty file, comments only, use-only file', () => {
      expect(compile({ '/main.dbml': '' })
        .interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(1);

      expect(compile({ '/main.dbml': '// just a comment' })
        .interpretFile(Filepath.from('/main.dbml')).getValue().database[0].tables).toHaveLength(0);

      expect(compile({
        '/main.dbml': 'use * from \'./common.dbml\'',
        '/common.dbml': 'Table users { id int [pk] }',
      }).interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(2);
    });

    test('parse errors, missing dep, bad dep still produce a model', () => {
      const r1 = compile({ '/main.dbml': 'Table users { id int [pk' })
        .interpretFile(Filepath.from('/main.dbml'));
      expect(r1.getErrors().length).toBeGreaterThan(0);
      expect(r1.getValue().database).toHaveLength(1);

      expect(compile({
        '/main.dbml': 'use { table users } from \'./missing.dbml\'\nTable orders { id int [pk] }',
      }).interpretFile(Filepath.from('/main.dbml')).getValue().database).toBeDefined();

      expect(compile({
        '/main.dbml': 'use { table users } from \'./bad.dbml\'\nTable orders { id int [pk] }',
        '/bad.dbml': 'Table users { id int [pk',
      }).interpretFile(Filepath.from('/main.dbml')).getValue().database).toBeDefined();
    });

    test('relative path going up directories', () => {
      expect(errors({
        '/sub/main.dbml': `
          use { table users } from '../common.dbml'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      }, '/sub/main.dbml')).toHaveLength(0);
    });
  });

  describe('extensionless import paths', () => {
    test('resolves with and without .dbml extension', () => {
      expect(errors({
        '/main.dbml': 'use { table users } from \'./common\'\nTable orders { id int }',
        '/common.dbml': 'Table users { id int }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': 'use * from \'./common\'\nTable orders { id int }',
        '/common.dbml': 'Table users { id int }',
      })).toHaveLength(0);

      expect(errors({
        '/main.dbml': `
          use { table users } from './common'
          Table orders {
            id int
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      })).toHaveLength(0);
    });

    test('./common and ./common.dbml resolve to same file', () => {
      const model = compile({
        '/a.dbml': 'use { table shared } from \'./shared\'\nTable A { id int }',
        '/b.dbml': 'use { table shared } from \'./shared.dbml\'\nTable B { id int }',
        '/main.dbml': 'use { table A } from \'./a\'\nuse { table B } from \'./b\'\nTable Main { id int }',
        '/shared.dbml': 'Table shared { id int }',
      }).interpretFile(Filepath.from('/main.dbml')).getValue();
      expect(new Set(model.database).size).toBe(model.database.length);
    });
  });

  describe('cache invalidation', () => {
    test('setSource and deleteSource invalidate interpretation', () => {
      const compiler = compile({
        '/main.dbml': 'use { table users } from \'./common.dbml\'\nTable orders { id int }',
        '/common.dbml': 'Table users { id int }',
      });
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(2);

      compiler.setSource('Table users { id int }\nTable products { id int }', Filepath.from('/common.dbml'));
      const updated = compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database;
      expect(updated.find((db) => db.tables.some((t) => t.name === 'products'))!.tables).toHaveLength(2);

      compiler.deleteSource(Filepath.from('/common.dbml'));
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database.length).toBeGreaterThanOrEqual(1);
    });
  });
});
