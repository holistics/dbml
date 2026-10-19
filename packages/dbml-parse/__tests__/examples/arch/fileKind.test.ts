import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

function setup (files: Record<string, string>) {
  const layout = new MemoryProjectLayout();
  for (const [path, source] of Object.entries(files)) layout.setSource(Filepath.from(path), source);
  return {
    layout,
    compiler: new Compiler(layout),
  };
}

const kindOf = (source: string) => setup({ '/main.dbml': source }).compiler.fileKind(Filepath.from('/main.dbml'));

describe('[example] file kind', () => {
  test('front matter diagram_type arch or architecture, any case, is architecture', () => {
    expect(kindOf('---\ndiagram_type: arch\n---\nTable users { id int }')).toBe('arch');
    expect(kindOf('---\ndiagram_type: Architecture\n---\n')).toBe('arch');
  });

  test('any other diagram_type is DBML, whatever the content', () => {
    expect(kindOf('---\ndiagram_type: schema\n---\nServer api')).toBe('dbml');
  });

  test('without a marker, a built-in role in any case is architecture', () => {
    expect(kindOf('Server api')).toBe('arch');
    expect(kindOf('loadbalancer lb')).toBe('arch');
  });

  test('without a marker, Group or Kind lines are architecture', () => {
    expect(kindOf('Group g { a }')).toBe('arch');
    expect(kindOf("Kind Lakehouse [icon: graph, color: '#4a7c59']")).toBe('arch');
  });

  test('without a marker, a role declared in an imported file is architecture', () => {
    const { compiler } = setup({
      '/pack.dbml': 'Kind Lakehouse [icon: graph]',
      '/main.dbml': "use * from './pack'\nLakehouse lake",
    });
    expect(compiler.fileKind(Filepath.from('/main.dbml'))).toBe('arch');
  });

  test('words inside bodies and words both languages share do not count', () => {
    expect(kindOf('Table users {\n  Server int\n}')).toBe('dbml');
    expect(kindOf("Note n { 'Server api' }\nRef: a.id > b.id\nProject p { }\nMetadata api { owner: 'x' }")).toBe('dbml');
    expect(kindOf('')).toBe('dbml');
  });

  test('an undeclared role and a DBML typo stay DBML', () => {
    expect(kindOf('Microservice x')).toBe('dbml');
    expect(kindOf('Tabel users { id int }')).toBe('dbml');
  });

  test('a file reads with its own kind: bodyless elements only in architecture files', () => {
    const { compiler } = setup({
      '/arch.dbml': 'Server api\nServer web',
      '/schema.dbml': 'Table users { id int }',
    });
    expect(compiler.parseFile(Filepath.from('/arch.dbml')).getErrors()).toHaveLength(0);
    expect(compiler.parseFile(Filepath.from('/schema.dbml')).getErrors()).toHaveLength(0);
    expect(setup({ '/main.dbml': '---\ndiagram_type: dbml\n---\nServer api' })
      .compiler.parseFile(Filepath.from('/main.dbml')).getErrors().length).toBeGreaterThan(0);
  });

  test('a kind change caused by an imported file drops the cached parse', () => {
    const { layout, compiler } = setup({
      '/pack.dbml': 'Kind Lakehouse [icon: graph]',
      '/main.dbml': "use * from './pack'\nLakehouse lake",
    });
    const main = Filepath.from('/main.dbml');
    expect(compiler.parseFile(main).getErrors()).toHaveLength(0);

    layout.setSource(Filepath.from('/pack.dbml'), 'Table t { id int }');
    expect(compiler.fileKind(main)).toBe('dbml');
    expect(compiler.parseFile(main).getErrors().length).toBeGreaterThan(0);

    layout.setSource(Filepath.from('/pack.dbml'), 'Kind Lakehouse [icon: graph]');
    expect(compiler.parseFile(main).getErrors()).toHaveLength(0);
  });
});
