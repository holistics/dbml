import { describe, expect, test } from 'vitest';
import { Compiler } from '@/index';
import { Filepath } from '@/core/types/filepath';
import { SyntaxNodeKind } from '@/core/parser/nodes';

const fileA = Filepath.from('/project/a.dbml');
const fileB = Filepath.from('/project/b.dbml');
const fileC = Filepath.from('/project/c.dbml');

describe('[example] multi-file compiler', () => {
  test('should set, get, delete, and clear sources', () => {
    const compiler = new Compiler();
    compiler.setSource(fileA, 'Table users { id int }');
    compiler.setSource(fileB, 'Table posts { id int }');
    expect(compiler.layout.getSource(fileA)).toBe('Table users { id int }');
    expect(compiler.layout.getSource(fileB)).toBe('Table posts { id int }');

    compiler.deleteSource(fileA);
    expect(compiler.layout.getSource(fileA)).toBeUndefined();
    expect(compiler.layout.getSource(fileB)).toBe('Table posts { id int }');

    compiler.clearSource();
    expect(compiler.layout.getSource(fileB)).toBeUndefined();
  });

  test('should parse each file independently with correct filepath on nodes and tokens', () => {
    const compiler = new Compiler();
    compiler.setSource(fileA, 'Table users { id int }');
    compiler.setSource(fileB, 'Table posts { id int }');

    const resultA = compiler.parseFile(fileA);
    const resultB = compiler.parseFile(fileB);
    expect(resultA.getErrors()).toHaveLength(0);
    expect(resultB.getErrors()).toHaveLength(0);

    const astA = resultA.getValue().ast;
    const astB = resultB.getValue().ast;

    // AST nodes carry their file's filepath
    expect(astA.filepath).toBe(fileA);
    expect(astB.filepath).toBe(fileB);
    expect(astA.declarations[0].filepath).toBe(fileA);
    expect(astB.declarations[0].filepath).toBe(fileB);

    // Tokens carry filepath too
    expect(resultA.getValue().tokens[0].filepath).toBe(fileA);
    expect(resultB.getValue().tokens[0].filepath).toBe(fileB);
  });

  test('should parse file with use declarations alongside elements', () => {
    const compiler = new Compiler();
    compiler.setSource(fileA, 'Table users { id int }');
    compiler.setSource(fileB, `
      use { table users } from './a.dbml'
      Table posts { user_id int }
    `);

    const ast = compiler.parseFile(fileB).getValue().ast;
    expect(ast.uses).toHaveLength(1);
    expect(ast.declarations).toHaveLength(1);
    expect(ast.body).toHaveLength(2);
    expect(ast.body[0].kind).toBe(SyntaxNodeKind.USE_DECLARATION);
    expect(ast.body[1].kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
  });

  test('should cache parse results and invalidate on setSource', () => {
    const compiler = new Compiler();
    compiler.setSource(fileA, 'Table users { id int }');

    const result1 = compiler.parseFile(fileA);
    const result2 = compiler.parseFile(fileA);
    expect(result1).toBe(result2); // cached

    compiler.setSource(fileA, `
Table users {
  id int
  name varchar
}
`);
    const result3 = compiler.parseFile(fileA);
    expect(result3).not.toBe(result1); // invalidated
  });

  test('should detect file dependencies from use declarations', () => {
    const compiler = new Compiler();
    compiler.setSource(fileA, 'Table users { id int }');
    compiler.setSource(fileB, `
      use { table users } from './a.dbml'
      use * from './c.dbml'
    `);
    compiler.setSource(fileC, 'Enum status { active }');

    const depsB = compiler.fileDependencies(fileB);
    expect(depsB.size).toBe(2);

    const depsA = compiler.fileDependencies(fileA);
    expect(depsA.size).toBe(0);
  });
});
