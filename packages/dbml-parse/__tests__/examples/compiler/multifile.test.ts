import { describe, expect, test } from 'vitest';
import { Compiler } from '@/index';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { UNHANDLED } from '@/core/types/module';
import { SyntaxNodeKind } from '@/core/types/nodes';

const fileA = Filepath.from('/project/a.dbml');
const fileB = Filepath.from('/project/b.dbml');
const fileC = Filepath.from('/project/c.dbml');

describe('[example] multi-file compiler', () => {
  test('should set, get, delete, and clear sources', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, 'Table users { id int }');
    layout.setSource(fileB, 'Table posts { id int }');
    const compiler = new Compiler(layout);
    expect(compiler.layout.getSource(fileA)).toBe('Table users { id int }');
    expect(compiler.layout.getSource(fileB)).toBe('Table posts { id int }');

    layout.deleteSource(fileA);

    expect(compiler.layout.getSource(fileA)).toBeUndefined();
    expect(compiler.layout.getSource(fileB)).toBe('Table posts { id int }');

    compiler.layout = new MemoryProjectLayout();
    expect(compiler.layout.getSource(fileB)).toBeUndefined();
  });

  test('should parse each file independently with correct filepath on nodes and tokens', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, 'Table users { id int }');
    layout.setSource(fileB, 'Table posts { id int }');
    const compiler = new Compiler(layout);

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
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, 'Table users { id int }');
    layout.setSource(fileB, `
      use { table users } from './a.dbml'
      Table posts { user_id int }
    `);
    const compiler = new Compiler(layout);

    const ast = compiler.parseFile(fileB).getValue().ast;
    expect(ast.uses).toHaveLength(1);
    expect(ast.declarations).toHaveLength(1);
    expect(ast.body).toHaveLength(2);
    expect(ast.body[0].kind).toBe(SyntaxNodeKind.USE_DECLARATION);
    expect(ast.body[1].kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
  });

  test('should cache parse results and invalidate on setSource', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, 'Table users { id int }');
    const compiler = new Compiler(layout);

    const result1 = compiler.parseFile(fileA);
    const result2 = compiler.parseFile(fileA);
    expect(result1).toBe(result2); // cached

    layout.setSource(fileA, `
Table users {
  id int
  name varchar
}
`);

    const result3 = compiler.parseFile(fileA);
    expect(result3).not.toBe(result1); // invalidated
  });

  test('should detect file dependencies from use declarations', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, 'Table users { id int }');
    layout.setSource(fileB, `
      use { table users } from './a.dbml'
      use * from './c.dbml'
    `);
    layout.setSource(fileC, 'Enum status { active }');
    const compiler = new Compiler(layout);

    const depsB = compiler.fileDependencies(fileB);
    expect(depsB).toHaveLength(2);

    const depsA = compiler.fileDependencies(fileA);
    expect(depsA).toHaveLength(0);
  });

  test('should not cache poisoned slot when query throws', () => {
    const layout = new MemoryProjectLayout();
    // Set source to something that parses but will fail during bind
    // due to missing referenced file
    layout.setSource(fileA, `
      use { table X } from './missing.dbml'
      Ref: X.id > X.id
    `);
    const compiler = new Compiler(layout);

    // First call may throw or produce errors
    try {
      compiler.bindProject();
    } catch {
      // Expected
    }

    // Second call should not throw "Cycle detected" - the COMPUTING
    // sentinel must have been cleared on failure
    expect(() => {
      layout.setSource(fileA, 'Table users { id int }');
  
      compiler.bindProject();
    }).not.toThrow();
  });

  test('mutual use imports should not infinite-loop (cycle detection)', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, `
      use { tablepartial PB } from './b.dbml'
      TablePartial PA { id int }
      Table A { ~PB }
    `);
    layout.setSource(fileB, `
      use { tablepartial PA } from './a.dbml'
      TablePartial PB { id int }
      Table B { ~PA }
      Ref: B.id > A.id
    `);
    const compiler = new Compiler(layout);

    // Should resolve without infinite loop or "Cycle detected" error
    expect(() => compiler.bindProject()).not.toThrow();

    // Both files should parse
    expect(compiler.parseFile(fileA).getErrors()).toHaveLength(0);
    expect(compiler.parseFile(fileB).getErrors()).toHaveLength(0);
  });

  test('mutual use imports should resolve symbols across files', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, `
      use { tablepartial PB } from './b.dbml'
      TablePartial PA { id int }
      Table A { ~PB }
    `);
    layout.setSource(fileB, `
      use { tablepartial PA } from './a.dbml'
      TablePartial PB { name varchar }
      Table B { ~PA }
    `);
    const compiler = new Compiler(layout);

    compiler.bindProject();

    // Both files' program symbols should have members
    const astA = compiler.parseFile(fileA).getValue().ast;
    const programSymA = compiler.nodeSymbol(astA).getFiltered(UNHANDLED);
    expect(programSymA).toBeDefined();
    const membersA = compiler.symbolMembers(programSymA!).getFiltered(UNHANDLED);
    expect(membersA).toBeDefined();
    // Should find Table A and TablePartial PA among members (at schema level)
    const names = membersA!.flatMap((m) => {
      const sub = compiler.symbolMembers(m).getFiltered(UNHANDLED);
      return sub ? sub.map((s) => s.name) : [m.name];
    });
    expect(names).toContain('A');
    expect(names).toContain('PA');
  });

  test('fileDependencies returns Filepath objects', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, 'Table users { id int }');
    layout.setSource(fileB, `
      use { table users } from './a.dbml'
    `);
    const compiler = new Compiler(layout);

    const deps = compiler.fileDependencies(fileB);
    expect(deps).toHaveLength(1);
    expect(deps[0]).toBeInstanceOf(Filepath);
    expect(deps[0].absolute).toBe(fileA.absolute);
  });

  test('reachableFiles returns Filepath array', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(fileA, 'Table users { id int }');
    layout.setSource(fileB, `
      use { table users } from './a.dbml'
    `);
    layout.setSource(fileC, `
      use * from './b.dbml'
    `);
    const compiler = new Compiler(layout);

    const reachable = compiler.reachableFiles(fileC);
    expect(Array.isArray(reachable)).toBe(true);
    expect(reachable.length).toBe(3);
    const paths = reachable.map((f: Filepath) => f.absolute);
    expect(paths).toContain(fileA.absolute);
    expect(paths).toContain(fileB.absolute);
    expect(paths).toContain(fileC.absolute);
  });
});
