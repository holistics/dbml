import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { SyntaxTokenKind } from '@/core/types/tokens';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

const MAIN = Filepath.from('/main.dbml');

function setup (files: Record<string, string>) {
  const layout = new MemoryProjectLayout();
  for (const [path, source] of Object.entries(files)) layout.setSource(Filepath.from(path), source);
  return {
    layout,
    compiler: new Compiler(layout),
  };
}

function createCompilerWithSource (source: string) {
  return setup({ '/main.dbml': source }).compiler;
}

const detectFileKind = (source: string) => createCompilerWithSource(source).fileKind(MAIN);

describe('[example] file kind', () => {
  test('front matter diagram_type arch or architecture, any case, is architecture', () => {
    expect(detectFileKind(`---
diagram_type: arch
---
Table users { id int }`)).toBe('arch');
    expect(detectFileKind(`---
diagram_type: Architecture
---`)).toBe('arch');
  });

  test('any other diagram_type is DBML, whatever the content', () => {
    expect(detectFileKind(`---
diagram_type: schema
---
Server api`)).toBe('dbml');
  });

  test('without diagram_type, roles, Group and Kind lines are DBML', () => {
    expect(detectFileKind('Server api')).toBe('dbml');
    expect(detectFileKind('loadbalancer lb')).toBe('dbml');
    expect(detectFileKind('Group g { a }')).toBe('dbml');
    expect(detectFileKind("Kind Lakehouse [color: '#4a7c59']")).toBe('dbml');
    expect(detectFileKind(`---
title: x
---
Server api`)).toBe('dbml');
  });

  test('a role line does not turn a schema file into an architecture file', () => {
    expect(detectFileKind(`Table users { id int }
Group g { users }`)).toBe('dbml');
    expect(detectFileKind(`Table users { id int }
Database main { id int }`)).toBe('dbml');
  });

  test('an imported file does not decide the kind', () => {
    const { compiler } = setup({
      '/pack.dbml': `---
diagram_type: arch
---
Server api`,
      '/main.dbml': `use * from './pack'
Lakehouse lake`,
    });
    expect(compiler.fileKind(Filepath.from('/main.dbml'))).toBe('dbml');
  });

  test('an empty file is DBML', () => {
    expect(detectFileKind('')).toBe('dbml');
  });

  test('a file reads with its own kind: bodyless elements only in architecture files', () => {
    const { compiler } = setup({
      '/arch.dbml': `---
diagram_type: arch
---
Server api
Server web`,
      '/schema.dbml': 'Table users { id int }',
    });
    expect(compiler.parseFile(Filepath.from('/arch.dbml')).getErrors()).toHaveLength(0);
    expect(compiler.parseFile(Filepath.from('/schema.dbml')).getErrors()).toHaveLength(0);
    expect(createCompilerWithSource('Server api')
      .parseFile(MAIN).getErrors().length).toBeGreaterThan(0);
  });
});

describe('[example] frontMatter query', () => {
  test('arch file returns front matter key-value pairs', () => {
    const frontmatter = createCompilerWithSource(`---
diagram_type: arch
title: My Arch
---
Server api`).frontMatter(MAIN);
    expect(frontmatter).toEqual({ diagram_type: 'arch', title: 'My Arch' });
  });

  test('dbml file with front matter returns key-value pairs', () => {
    const frontmatter = createCompilerWithSource(`---
title: My Schema
---
Table users { id int }`).frontMatter(MAIN);
    expect(frontmatter).toEqual({ title: 'My Schema' });
  });

  test('file without front matter returns empty object', () => {
    expect(createCompilerWithSource('Table users { id int }').frontMatter(MAIN)).toEqual({});
  });

  test('empty file returns empty object', () => {
    expect(createCompilerWithSource('').frontMatter(MAIN)).toEqual({});
  });

  test('quoted values have quotes stripped', () => {
    const frontmatter = createCompilerWithSource(`---
title: 'hello'
name: "world"
---`).frontMatter(MAIN);
    expect(frontmatter).toEqual({ title: 'hello', name: 'world' });
  });
});

describe('[example] frontMatter on ProgramNode', () => {
  test('arch file has frontMatter token on ProgramNode', () => {
    const compiler = createCompilerWithSource(`---
diagram_type: arch
---
Server api`);
    const ast = compiler.parseFile(MAIN).getValue().ast;
    expect(ast.frontMatter).toBeDefined();
    expect(ast.frontMatter!.kind).toBe(SyntaxTokenKind.FRONT_MATTER);
    expect(ast.frontMatter!.value).toContain('diagram_type: arch');
  });

  test('dbml file with front matter has frontMatter token on ProgramNode', () => {
    const compiler = createCompilerWithSource(`---
title: My Schema
---
Table users { id int }`);
    const ast = compiler.parseFile(MAIN).getValue().ast;
    expect(ast.frontMatter).toBeDefined();
    expect(ast.frontMatter!.kind).toBe(SyntaxTokenKind.FRONT_MATTER);
    expect(ast.frontMatter!.value).toContain('title: My Schema');
  });

  test('dbml file without front matter has no frontMatter token', () => {
    const ast = createCompilerWithSource('Table users { id int }').parseFile(MAIN).getValue().ast;
    expect(ast.frontMatter).toBeUndefined();
  });

  test('empty file has no frontMatter token', () => {
    const ast = createCompilerWithSource('').parseFile(MAIN).getValue().ast;
    expect(ast.frontMatter).toBeUndefined();
  });

  test('front matter is not trivia, not attached to leading/trailing trivia of other tokens', () => {
    const compiler = createCompilerWithSource(`---
diagram_type: arch
---
Server api`);
    const tokens = compiler.parseFile(MAIN).getValue().tokens;
    for (const token of tokens) {
      const hasFrontMatterTrivia = [...token.leadingTrivia, ...token.trailingTrivia]
        .some((t) => t.kind === SyntaxTokenKind.FRONT_MATTER);
      expect(hasFrontMatterTrivia).toBe(false);
    }
  });

  test('unterminated front matter fence is not treated as front matter', () => {
    const ast = createCompilerWithSource(`---
diagram_type: arch
Server api`).parseFile(MAIN).getValue().ast;
    expect(ast.frontMatter).toBeUndefined();
  });
});
