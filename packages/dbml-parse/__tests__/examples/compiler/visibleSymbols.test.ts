import { describe, expect, test } from 'vitest';
import type Compiler from '@/compiler';
import { UNHANDLED } from '@/core/types/module';
import { ProgramSymbol, RefSymbol, SymbolKind } from '@/core/types/symbol';
import { fp, setupCompiler } from '../interpreter/multifile/utils';

function visible (compiler: Compiler, path: string, kind: SymbolKind.Ref) {
  const ast = compiler.parseFile(fp(path)).getValue().ast;
  const program = compiler.nodeSymbol(ast).getFiltered(UNHANDLED) as ProgramSymbol;
  return compiler.visibleSymbols(program, kind);
}

describe('[example] compiler - visibleSymbols', () => {
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

      const refs = visible(compiler, '/orders.dbml', SymbolKind.Ref);
      expect(refs.map((s) => s.name)).toEqual(['user_posts']);
      expect(refs[0]).toBeInstanceOf(RefSymbol);
    });

    test('lists refs from a reachable file when both endpoint tables are visible', () => {
      const { compiler } = setupCompiler({
        '/orders.dbml': ORDERS,
        '/reporting.dbml': "use * from './orders.dbml'",
      });

      const refs = visible(compiler, '/reporting.dbml', SymbolKind.Ref);
      expect(refs.map((s) => s.name)).toEqual(['user_posts']);
      expect(refs[0].filepath.equals(fp('/orders.dbml'))).toBe(true);
    });

    test('does not list a ref whose endpoint table is not visible', () => {
      const { compiler } = setupCompiler({
        '/orders.dbml': ORDERS,
        '/reporting.dbml': "use { table users } from './orders.dbml'",
      });

      expect(visible(compiler, '/reporting.dbml', SymbolKind.Ref)).toEqual([]);
    });

    test('lists every same-named ref from different files', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': 'Table a1 { id int }\nTable a2 { a1_id int }\nRef r: a2.a1_id > a1.id',
        '/b.dbml': 'Table b1 { id int }\nTable b2 { b1_id int }\nRef r: b2.b1_id > b1.id',
        '/main.dbml': "use * from './a.dbml'\nuse * from './b.dbml'",
      });

      const refs = visible(compiler, '/main.dbml', SymbolKind.Ref);
      expect(refs.map((s) => s.name)).toEqual(['r', 'r']);
      expect(new Set(refs.map((s) => s.filepath.toString())).size).toBe(2);
    });
  });
});
