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

  test('without diagram_type, roles, Group and Kind lines are DBML', () => {
    expect(kindOf('Server api')).toBe('dbml');
    expect(kindOf('loadbalancer lb')).toBe('dbml');
    expect(kindOf('Group g { a }')).toBe('dbml');
    expect(kindOf("Kind Lakehouse [color: '#4a7c59']")).toBe('dbml');
    expect(kindOf('---\ntitle: x\n---\nServer api')).toBe('dbml');
  });

  test('a role line does not turn a schema file into an architecture file', () => {
    expect(kindOf('Table users { id int }\nGroup g { users }')).toBe('dbml');
    expect(kindOf('Table users { id int }\nDatabase main { id int }')).toBe('dbml');
  });

  test('an imported file does not decide the kind', () => {
    const { compiler } = setup({
      '/pack.dbml': '---\ndiagram_type: arch\n---\nServer api',
      '/main.dbml': "use * from './pack'\nLakehouse lake",
    });
    expect(compiler.fileKind(Filepath.from('/main.dbml'))).toBe('dbml');
  });

  test('an empty file is DBML', () => {
    expect(kindOf('')).toBe('dbml');
  });

  test('a file reads with its own kind: bodyless elements only in architecture files', () => {
    const { compiler } = setup({
      '/arch.dbml': '---\ndiagram_type: arch\n---\nServer api\nServer web',
      '/schema.dbml': 'Table users { id int }',
    });
    expect(compiler.parseFile(Filepath.from('/arch.dbml')).getErrors()).toHaveLength(0);
    expect(compiler.parseFile(Filepath.from('/schema.dbml')).getErrors()).toHaveLength(0);
    expect(setup({ '/main.dbml': 'Server api' })
      .compiler.parseFile(Filepath.from('/main.dbml')).getErrors().length).toBeGreaterThan(0);
  });
});
