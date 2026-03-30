import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler/index';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { Filepath, MemoryProjectLayout } from '@/compiler/projectLayout';
import { NodeToSymbolMap } from '@/core/binder/analyzer';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { dbmlSchemaArbitrary } from '../utils/arbitraries';

// Symbols and nodes are NOT stable across calls - only their interned keys are.
// nodeSymbolPairs extracts (nodeInternKey -> symbolInternKey) records for comparison.

const RUNS = 50;

// Build a (nodeInternKey -> symbolInternKey) record by traversing AST nodes
// and looking them up in the given nodeToSymbol map.
function nodeSymbolPairs (ast: ProgramNode, nodeToSymbol: NodeToSymbolMap): Record<string, string> {
  const result: Record<string, string> = {};

  const visit = (node: ProgramNode | ElementDeclarationNode) => {
    const sym = nodeToSymbol.get(node);
    if (sym) result[node.intern()] = sym.intern();
  };

  visit(ast);
  for (const decl of ast.declarations) {
    visit(decl);
  }

  return result;
}

describe('[property] compiler - single-file intern stability', () => {
  it('parseFile: repeated calls on same compiler return same INTERNED nodes (idempotency)', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        const compiler = new Compiler();
        compiler.setSource(source);
        const r1 = compiler.parseFile(DEFAULT_ENTRY);
        const r2 = compiler.parseFile(DEFAULT_ENTRY);
        expect(r1.getValue().ast).toBe(r2.getValue().ast);
        expect(r1.getValue().ast.intern()).toBe(r2.getValue().ast.intern());
      }),
      { numRuns: RUNS },
    );
  });

  it('validateFile: repeated calls return same nodeToSymbol reference (idempotency)', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        const compiler = new Compiler();
        compiler.setSource(source);
        const r1 = compiler.validateFile(DEFAULT_ENTRY);
        const r2 = compiler.validateFile(DEFAULT_ENTRY);
        expect(r1).toBe(r2);
      }),
      { numRuns: RUNS },
    );
  });

  it('bindFile: repeated calls return same nodeToSymbol reference (idempotency)', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        const compiler = new Compiler();
        compiler.setSource(source);
        const r1 = compiler.bindFile(DEFAULT_ENTRY);
        const r2 = compiler.bindFile(DEFAULT_ENTRY);
        expect(r1).toBe(r2);
      }),
      { numRuns: RUNS },
    );
  });

  it('validateFile and bindProject agree on node -> symbol intern keys for file nodes', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        const compiler = new Compiler();
        compiler.setSource(source);
        const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();

        const fileMap = nodeSymbolPairs(ast, compiler.validateFile(DEFAULT_ENTRY).getValue().publicSchemaSymbol.getNodeSymbolMapping());
        const projectMap = nodeSymbolPairs(ast, compiler.bindProject().getValue().nodeToSymbol);

        expect(Object.keys(fileMap)).toEqual(Object.keys(projectMap));
        for (const key of Object.keys(fileMap)) {
          const [filePath] = fileMap[key].split(':');
          const [projectPath] = projectMap[key].split(':');
          expect(filePath).toBe(projectPath);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe('[property] compiler - multi-file intern isolation', () => {
  it('validateFile(a) result is unchanged after validateFile(b) on the same compiler', () => {
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sourceA, sourceB]) => {
          const fpA = Filepath.from('/a.dbml');
          const fpB = Filepath.from('/b.dbml');
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sourceA,
            [fpB.absolute]: sourceB,
          }));

          const resultA1 = compiler.validateFile(fpA);
          compiler.validateFile(fpB);
          const resultA2 = compiler.validateFile(fpA);

          expect(resultA1).toBe(resultA2);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('bindFile(a) result is unchanged after bindFile(b) on the same compiler', () => {
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sourceA, sourceB]) => {
          const fpA = Filepath.from('/a.dbml');
          const fpB = Filepath.from('/b.dbml');
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sourceA,
            [fpB.absolute]: sourceB,
          }));

          const resultA1 = compiler.bindFile(fpA);
          compiler.bindFile(fpB);
          const resultA2 = compiler.bindFile(fpA);

          expect(resultA1).toBe(resultA2);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('setSource(b) does not invalidate cached validateFile(a)', () => {
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sourceA, sourceB1, sourceB2]) => {
          const fpA = Filepath.from('/a.dbml');
          const fpB = Filepath.from('/b.dbml');
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sourceA,
            [fpB.absolute]: sourceB1,
          }));

          const resultA1 = compiler.validateFile(fpA);
          // Change file B - should not affect A's cache
          compiler.setSource(sourceB2, fpB);
          const resultA2 = compiler.validateFile(fpA);

          expect(resultA1).toBe(resultA2);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('node filepath in parseFile result matches the requested filepath', () => {
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sourceA, sourceB]) => {
          const fpA = Filepath.from('/a.dbml');
          const fpB = Filepath.from('/b.dbml');
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sourceA,
            [fpB.absolute]: sourceB,
          }));

          const astA = compiler.parseFile(fpA).getValue().ast;
          const astB = compiler.parseFile(fpB).getValue().ast;

          expect(astA.filepath.intern()).toBe(fpA.intern());
          expect(astB.filepath.intern()).toBe(fpB.intern());

          for (const decl of astA.declarations) {
            expect(decl.filepath.intern()).toBe(fpA.intern());
          }
          for (const decl of astB.declarations) {
            expect(decl.filepath.intern()).toBe(fpB.intern());
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});

// NOTE: validateFile.nodeToSymbol is incomplete - it does not contain partial-injected symbols.
// Always prefer bindFile.nodeToSymbol for authoritative node->symbol lookup.
describe('[property] compiler - cross-file use declarations', () => {
  const fpA = Filepath.from('/a.dbml');
  const fpB = Filepath.from('/b.dbml');
  const withUseA = (source: string) => `use * from './a.dbml'\n${source}`;

  it('bindFile(b) is idempotent when b uses a', () => {
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sA, sB]) => {
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sA,
            [fpB.absolute]: withUseA(sB),
          }));
          expect(compiler.bindFile(fpB)).toBe(compiler.bindFile(fpB));
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('bindFile(a) not invalidated after bindFile(b) where b uses a', () => {
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sA, sB]) => {
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sA,
            [fpB.absolute]: withUseA(sB),
          }));
          const r1 = compiler.bindFile(fpA);
          compiler.bindFile(fpB);
          expect(compiler.bindFile(fpA)).toBe(r1);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('validate -> bind: validateFile(b) cached after bindFile(b) when b uses a', () => {
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sA, sB]) => {
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sA,
            [fpB.absolute]: withUseA(sB),
          }));
          const v1 = compiler.validateFile(fpB);
          compiler.bindFile(fpB);
          expect(compiler.validateFile(fpB)).toBe(v1);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('bind -> validate: bindFile(b) nodeToSymbol interns agree with validateFile(b) for b own nodes', () => {
    // bindFile reuses validateFile's nodeToSymbol, so declared-element interns must match.
    // bindFile also adds partial-injection symbols not present in validateFile alone.
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sA, sB]) => {
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sA,
            [fpB.absolute]: withUseA(sB),
          }));
          const ast = compiler.parseFile(fpB).getValue().ast;
          const vPairs = nodeSymbolPairs(ast, compiler.validateFile(fpB).getValue().publicSchemaSymbol.getNodeSymbolMapping());
          const bPairs = nodeSymbolPairs(ast, compiler.bindFile(fpB).getValue().nodeToSymbol);
          // bindFile may map additional nodes (partial injections), but the common keys must agree
          for (const key of Object.keys(vPairs)) {
            expect(bPairs[key]).toBe(vPairs[key]);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('a-node symbol interns retain a filepath in bindProject when b uses a', () => {
    // Symbols created for a's declared elements should always carry a's filepath,
    // even when accessed through the project-wide binding that merges b's imports.
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sA, sB]) => {
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sA,
            [fpB.absolute]: withUseA(sB),
          }));
          const astA = compiler.parseFile(fpA).getValue().ast;
          // Use bindFile (not validateFile) for authoritative nodeToSymbol
          const filePairs = nodeSymbolPairs(astA, compiler.bindFile(fpA).getValue().nodeToSymbol);
          const projectPairs = nodeSymbolPairs(astA, compiler.bindProject().getValue().nodeToSymbol);
          expect(Object.keys(filePairs)).toEqual(Object.keys(projectPairs));
          for (const key of Object.keys(filePairs)) {
            // Symbol intern = "filepath:id" - filepath component must be identical
            expect(filePairs[key].split(':')[0]).toBe(projectPairs[key].split(':')[0]);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('b-node symbol interns all reference b filepath (not a) when b uses a', () => {
    // Symbols for b's own declared elements are created by b's validator - they must
    // carry b's filepath regardless of what a exports.
    fc.assert(
      fc.property(
        fc.tuple(dbmlSchemaArbitrary, dbmlSchemaArbitrary),
        ([sA, sB]) => {
          const compiler = new Compiler(new MemoryProjectLayout({
            [fpA.absolute]: sA,
            [fpB.absolute]: withUseA(sB),
          }));
          const astB = compiler.parseFile(fpB).getValue().ast;
          // Use bindFile (not validateFile) for authoritative nodeToSymbol
          const bPairs = nodeSymbolPairs(astB, compiler.bindFile(fpB).getValue().nodeToSymbol);
          for (const symIntern of Object.values(bPairs)) {
            expect(symIntern.split(':')[0]).toBe(fpB.absolute);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});
