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

  test('without a marker, Group lines are architecture, and so are Kind lines, so they can be reported', () => {
    expect(kindOf('Group g { a }')).toBe('arch');
    expect(kindOf("Kind Lakehouse [color: '#4a7c59']")).toBe('arch');
  });

  test('an imported file does not decide the kind', () => {
    const { compiler } = setup({
      '/pack.dbml': 'Server api',
      '/main.dbml': "use * from './pack'\nLakehouse lake",
    });
    expect(compiler.fileKind(Filepath.from('/main.dbml'))).toBe('dbml');
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
});
