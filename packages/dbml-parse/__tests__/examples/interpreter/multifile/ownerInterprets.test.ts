import { describe, expect, test } from 'vitest';
import { CompileErrorCode, Filepath } from '@/index';
import { setupCompiler } from './utils';

// Each declaration is interpreted by its Owner. A Ref/Dep/Records block with several Owner tables is emitted once, by its Primary Owner.
describe('[example] multifile interpreter - Owner interprets', () => {
  test('a cross-file Ref whose Primary Owner is imported is emitted exactly once', () => {
    const { compiler } = setupCompiler({
      '/posts.dbml': `Table posts {
  id int [pk]
  user_id int
}`,
      '/users.dbml': `Table users {
  id int [pk]
}`,
      '/main.dbml': `use * from './posts.dbml'
use * from './users.dbml'
Ref r: posts.user_id > users.id`,
    });

    const result = compiler.interpretFile(Filepath.from('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    const db = result.getValue()! as any;
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].name).toBe('r');
  });

  test('a Ref whose left table is visible but right table is not is not emitted and reports nothing', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': `Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}
Ref r: posts.user_id > users.id`,
      '/main.dbml': `use { table posts } from './orders.dbml'`,
    });

    const result = compiler.interpretFile(Filepath.from('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    expect((result.getValue()! as any).refs).toHaveLength(0);
  });

  // Tables cannot be declared inside a Project block (validator: 'Table must appear top-level'),
  // so this guards that a Program with a Project block still emits Refs owned by its tables.
  test('a Ref is still emitted when the Program also has a Project block', () => {
    const { compiler } = setupCompiler({
      '/main.dbml': `Project p {
  database_type: 'PostgreSQL'
}
Table posts {
  id int [pk]
  user_id int
}
Table users {
  id int [pk]
}
Ref: posts.user_id > users.id`,
    });

    const result = compiler.interpretFile(Filepath.from('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    const db = result.getValue()! as any;
    expect(db.refs).toHaveLength(1);
    expect(db.project?.name).toBe('p');
  });

  test('Records for one table in two applying files report a duplicate on both and emit none', () => {
    const { compiler } = setupCompiler({
      '/base.dbml': `Table users {
  id int [pk]
}`,
      '/r1.dbml': `use * from './base.dbml'
records users(id) {
  1
}`,
      '/r2.dbml': `use * from './base.dbml'
records users(id) {
  2
}`,
      '/main.dbml': `use * from './base.dbml'
use * from './r1.dbml'
use * from './r2.dbml'`,
    });

    const result = compiler.interpretFile(Filepath.from('/main.dbml'));
    const dups = result.getErrors().filter((e) => e.code === CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(dups).toHaveLength(2);
    expect(new Set(dups.map((e) => e.filepath.absolute)).size).toBe(2);
    expect((result.getValue()! as any).records).toHaveLength(0);
  });

  test('Metadata Ref targeting a Ref that does not apply reports an unknown target and attaches nothing', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': `Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}
Ref r: posts.user_id > users.id`,
      '/main.dbml': `use { table posts } from './orders.dbml'
Metadata Ref r {
  owner: 'x'
}`,
    });

    const result = compiler.interpretFile(Filepath.from('/main.dbml'));
    expect(result.getErrors().map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Ref r`');
    expect(compiler.parse.rawDb(Filepath.from('/main.dbml'))?.refs ?? []).toHaveLength(0);

    // The defining file is unaffected
    const orders = compiler.interpretFile(Filepath.from('/orders.dbml'));
    expect(orders.getErrors()).toHaveLength(0);
    expect((orders.getValue()! as any).refs.find((ref: any) => ref.name === 'r')?.metadata ?? {}).toEqual({});
  });
});
