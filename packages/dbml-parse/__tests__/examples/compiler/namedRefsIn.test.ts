import { describe, expect, test } from 'vitest';
import type Compiler from '@/compiler';
import { UNHANDLED } from '@/core/types/module';
import { ProgramSymbol } from '@/core/types/symbol';
import { RefMetadata } from '@/core/types/symbol/metadata';
import { Filepath } from '@/index';
import { setupCompiler } from '../interpreter/multifile/utils';

function getVisibleRefs (compiler: Compiler, path: string) {
  const ast = compiler.parseFile(Filepath.from(path)).getValue().ast;
  const program = compiler.nodeSymbol(ast).getFiltered(UNHANDLED) as ProgramSymbol;
  return compiler.namedRefsIn(program).map((meta) => ({ name: meta.name(compiler), filepath: meta.declaration.filepath, meta }));
}

describe('[example] compiler - namedRefsIn', () => {
  describe('Ref', () => {
    const ORDERS = `
Table users { id int [pk] }
Table posts {
  id int [pk]
  user_id int
}
Ref user_posts: posts.user_id > users.id
Ref: posts.id - users.id
`;

    test('lists named local refs only', () => {
      const { compiler } = setupCompiler({ '/orders.dbml': ORDERS });

      const refs = getVisibleRefs(compiler, '/orders.dbml');
      expect(refs.map((entry) => entry.name)).toEqual(['user_posts']);
      expect(refs[0].meta).toBeInstanceOf(RefMetadata);
    });

    test('lists refs from a reachable file when both endpoint tables are visible', () => {
      const { compiler } = setupCompiler({
        '/orders.dbml': ORDERS,
        '/reporting.dbml': "use * from './orders.dbml'",
      });

      const refs = getVisibleRefs(compiler, '/reporting.dbml');
      expect(refs.map((entry) => entry.name)).toEqual(['user_posts']);
      expect(refs[0].filepath.equals(Filepath.from('/orders.dbml'))).toBe(true);
    });

    test('does not list a ref whose endpoint table is not visible', () => {
      const { compiler } = setupCompiler({
        '/orders.dbml': ORDERS,
        '/reporting.dbml': "use { table users } from './orders.dbml'",
      });

      expect(getVisibleRefs(compiler, '/reporting.dbml')).toEqual([]);
    });

    test('lists every same-named ref from different files', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': `Table a1 { id int }
Table a2 { a1_id int }
Ref r: a2.a1_id > a1.id`,
        '/b.dbml': `Table b1 { id int }
Table b2 { b1_id int }
Ref r: b2.b1_id > b1.id`,
        '/main.dbml': `use * from './a.dbml'
use * from './b.dbml'`,
      });

      const refs = getVisibleRefs(compiler, '/main.dbml');
      expect(refs.map((entry) => entry.name)).toEqual(['r', 'r']);
      expect(new Set(refs.map((entry) => entry.filepath.absolute)).size).toBe(2);
    });
  });
});
