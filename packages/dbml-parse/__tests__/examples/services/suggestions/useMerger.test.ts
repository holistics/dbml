import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { SymbolKind } from '@/core/types/symbol';
import { scanExistingUses, mergeSymbolIntoUses } from '@/services/suggestions/utils/useMerger';

function setup (files: Record<string, string>) {
  const compiler = new Compiler();
  for (const [path, src] of Object.entries(files)) {
    compiler.setSource(Filepath.from(path), src);
  }
  return compiler;
}

describe('scanExistingUses - preserves alias', () => {
  test('specifier with alias captures alias', () => {
    const compiler = setup({
      '/base.dbml': 'Table users { id int [pk] }',
      '/main.dbml': "use { table users as u } from './base'",
    });
    const uses = scanExistingUses(compiler, Filepath.from('/main.dbml'), "use { table users as u } from './base'");
    expect(uses).toHaveLength(1);
    expect(uses[0].specifiers[0]).toEqual({ kind: 'table', name: 'users', alias: 'u' });
  });

  test('specifier without alias has undefined alias', () => {
    const compiler = setup({
      '/base.dbml': 'Table users { id int [pk] }',
      '/main.dbml': "use { table users } from './base'",
    });
    const uses = scanExistingUses(compiler, Filepath.from('/main.dbml'), "use { table users } from './base'");
    expect(uses[0].specifiers[0]).toEqual({ kind: 'table', name: 'users', alias: undefined });
  });
});

describe('mergeSymbolIntoUses - preserves alias when adding new specifier', () => {
  test('existing aliased specifier preserved when merging new symbol', () => {
    const content = "use { table users as u } from './base'\n";
    const compiler = setup({
      '/base.dbml': 'Table users { id int [pk] }\nTable orders { id int [pk] }',
      '/main.dbml': content,
    });
    const result = mergeSymbolIntoUses(
      compiler, 'orders', SymbolKind.Table,
      Filepath.from('/base.dbml'), Filepath.from('/main.dbml'), content,
    );
    expect(result.topInsert).toContain('table users as u');
    expect(result.topInsert).toContain('table users as u');
    expect(result.topInsert).toContain('Table orders');
  });

  test('multiple aliased specifiers all preserved', () => {
    const content = "use {\n  table users as u\n  table orders as o\n} from './base'\n";
    const compiler = setup({
      '/base.dbml': 'Table users { id int [pk] }\nTable orders { id int [pk] }\nEnum status { active\n  inactive\n}',
      '/main.dbml': content,
    });
    const result = mergeSymbolIntoUses(
      compiler, 'status', SymbolKind.Enum,
      Filepath.from('/base.dbml'), Filepath.from('/main.dbml'), content,
    );
    expect(result.topInsert).toContain('table users as u');
    expect(result.topInsert).toContain('table orders as o');
    expect(result.topInsert).toContain('Enum status');
  });

  test('duplicate symbol not added again', () => {
    const content = "use { table users as u } from './base'\n";
    const compiler = setup({
      '/base.dbml': 'Table users { id int [pk] }',
      '/main.dbml': content,
    });
    const result = mergeSymbolIntoUses(
      compiler, 'users', SymbolKind.Table,
      Filepath.from('/base.dbml'), Filepath.from('/main.dbml'), content,
    );
    expect(result.topInsert).toBe('');
  });
});
