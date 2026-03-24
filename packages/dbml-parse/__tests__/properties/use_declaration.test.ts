import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  useDeclarationArbitrary,
  schemaWithUseDeclarationsArbitrary,
  dbmlSchemaArbitrary,
} from '../utils/arbitraries';
import { singleLineStringArbitrary } from '../utils/arbitraries/tokens';
import { parse, print } from '../utils';
import { SyntaxNodeKind } from '@/core/parser/nodes';

const CONFIG = { numRuns: 50 };
const EXTENDED = { numRuns: 25 };

describe('[property] use statement', () => {
  describe('valid input invariants', () => {
    it('should parse any generated use statement without errors', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          expect(result.getErrors()).toHaveLength(0);

          const ast = result.getValue().ast;
          expect(ast.useDeclarations).toHaveLength(1);
          expect(ast.declarations).toHaveLength(0);
        }),
        CONFIG,
      );
    });

    it('should parse multiple use statements without errors', () => {
      fc.assert(
        fc.property(
          fc.array(useDeclarationArbitrary, { minLength: 1, maxLength: 5 }),
          (stmts) => {
            const source = stmts.join('\n');
            const result = parse(source);
            expect(result.getErrors()).toHaveLength(0);

            const ast = result.getValue().ast;
            expect(ast.useDeclarations).toHaveLength(stmts.length);
          },
        ),
        CONFIG,
      );
    });

    it('should parse use statements combined with a schema without errors', () => {
      fc.assert(
        fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
          const result = parse(source);
          expect(result.getErrors()).toHaveLength(0);

          const ast = result.getValue().ast;
          expect(ast.useDeclarations.length).toBeGreaterThanOrEqual(1);
          expect(ast.declarations.length).toBeGreaterThanOrEqual(1);
        }),
        CONFIG,
      );
    });
  });

  describe('AST structure invariants', () => {
    it('every use statement should have kind USE_DECLARATION', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const ast = parse(source).getValue().ast;
          ast.useDeclarations.forEach((stmt) => {
            expect(stmt.kind).toBe(SyntaxNodeKind.USE_DECLARATION);
          });
        }),
        CONFIG,
      );
    });

    it('every use statement should have useKeyword and path', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);

          const stmt = result.getValue().ast.useDeclarations[0];
          expect(stmt.useKeyword).toBeDefined();
          expect(stmt.useKeyword?.value).toBe('use');
          expect(stmt.path).toBeDefined();
        }),
        CONFIG,
      );
    });

    it('selective use should have specifiers, fromKeyword, and path', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);

          const stmt = result.getValue().ast.useDeclarations[0];
          fc.pre(stmt.specifiers !== undefined);

          expect(stmt.fromKeyword).toBeDefined();
          expect(stmt.fromKeyword?.value).toBe('from');
          expect(stmt.path).toBeDefined();
        }),
        CONFIG,
      );
    });

    it('entire-file use should have star and fromKeyword but no specifiers', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);

          const stmt = result.getValue().ast.useDeclarations[0];
          fc.pre(stmt.specifiers === undefined);

          expect(stmt.star).toBeDefined();
          expect(stmt.star?.value).toBe('*');
          expect(stmt.fromKeyword).toBeDefined();
          expect(stmt.fromKeyword?.value).toBe('from');
          expect(stmt.path).toBeDefined();
        }),
        CONFIG,
      );
    });

    it('selective use specifier list should have at least one specifier', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);

          const stmt = result.getValue().ast.useDeclarations[0];
          fc.pre(stmt.specifiers !== undefined);

          expect(stmt.specifiers!.specifiers.length).toBeGreaterThanOrEqual(1);
        }),
        CONFIG,
      );
    });

    it('comma count should be specifier count minus one', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);

          const stmt = result.getValue().ast.useDeclarations[0];
          fc.pre(stmt.specifiers !== undefined);

          const list = stmt.specifiers!;
          expect(list.commaList.length).toBe(list.specifiers.length - 1);
        }),
        CONFIG,
      );
    });

    it('every specifier should have elementKind and name', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);

          const specifiers = result.getValue().ast.useDeclarations[0].specifiers?.specifiers ?? [];
          specifiers.forEach((spec) => {
            expect(spec.elementKind).toBeDefined();
            expect(spec.name).toBeDefined();
            expect(spec.elementKind?.value.length).toBeGreaterThan(0);
          });
        }),
        CONFIG,
      );
    });

    it('use statements should not appear in body', () => {
      fc.assert(
        fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
          const ast = parse(source).getValue().ast;
          ast.declarations.forEach((elem) => {
            expect(elem.kind).not.toBe(SyntaxNodeKind.USE_DECLARATION);
          });
        }),
        CONFIG,
      );
    });

    it('body elements should remain ELEMENT_DECLARATION when use statements present', () => {
      fc.assert(
        fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);
          const ast = result.getValue().ast;
          ast.declarations.forEach((elem) => {
            expect(elem.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
          });
        }),
        CONFIG,
      );
    });
  });

  describe('position invariants', () => {
    it('use statement positions should be within source bounds', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);

          const stmt = result.getValue().ast.useDeclarations[0];
          expect(stmt.start).toBeGreaterThanOrEqual(0);
          expect(stmt.end).toBeLessThanOrEqual(source.length);
          expect(stmt.start).toBeLessThanOrEqual(stmt.end);
        }),
        CONFIG,
      );
    });

    it('use statements should be in source order', () => {
      fc.assert(
        fc.property(
          fc.array(useDeclarationArbitrary, { minLength: 2, maxLength: 5 }),
          (stmts) => {
            const source = stmts.join('\n');
            const result = parse(source);
            fc.pre(result.getErrors().length === 0);

            const parsed = result.getValue().ast.useDeclarations;
            for (let i = 1; i < parsed.length; i++) {
              expect(parsed[i].start).toBeGreaterThanOrEqual(parsed[i - 1].end);
            }
          },
        ),
        CONFIG,
      );
    });

    it('use statements should end before body elements begin', () => {
      fc.assert(
        fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
          const result = parse(source);
          fc.pre(result.getErrors().length === 0);
          const ast = result.getValue().ast;
          fc.pre(ast.useDeclarations.length > 0 && ast.declarations.length > 0);

          const lastUseEnd = Math.max(...ast.useDeclarations.map((s) => s.end));
          const firstBodyStart = Math.min(...ast.declarations.map((e) => e.start));
          expect(firstBodyStart).toBeGreaterThanOrEqual(lastUseEnd);
        }),
        CONFIG,
      );
    });
  });

  describe('roundtrip invariant', () => {
    it('should roundtrip a source with use statements', () => {
      fc.assert(
        fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
          const ast = parse(source).getValue().ast;
          const reprinted = print(source, ast);
          expect(reprinted).toBe(source);
        }),
        CONFIG,
      );
    });

    it('should produce the same AST when parsed twice', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const r1 = parse(source);
          const r2 = parse(source);
          expect(r1.getErrors().length).toBe(r2.getErrors().length);
          expect(r1.getValue().ast.useDeclarations.length).toBe(r2.getValue().ast.useDeclarations.length);
        }),
        CONFIG,
      );
    });
  });

  describe('negative property tests — invalid forms must produce errors', () => {
    it('use statement without "from" keyword always errors', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.stringMatching(/[a-z_][a-z_0-9]*/),
              fc.stringMatching(/[a-z_][a-z_0-9]*/),
            ),
            { minLength: 1, maxLength: 3 },
          ),
          fc.stringMatching(/'[^'\n]*'/),
          (specPairs, path) => {
            const specList = specPairs.map(([k, n]) => `${k} ${n}`).join(', ');
            const source = `use { ${specList} } ${path}`;
            expect(parse(source).getErrors().length).toBeGreaterThan(0);
          },
        ),
        EXTENDED,
      );
    });

    it('use statement without path always errors', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.stringMatching(/[a-z_][a-z_0-9]*/),
              fc.stringMatching(/[a-z_][a-z_0-9]*/),
            ),
            { minLength: 1, maxLength: 3 },
          ),
          (specPairs) => {
            const specList = specPairs.map(([k, n]) => `${k} ${n}`).join(', ');
            const source = `use { ${specList} } from`;
            expect(parse(source).getErrors().length).toBeGreaterThan(0);
          },
        ),
        EXTENDED,
      );
    });

    it('use statement with non-string-literal path always errors', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/[a-z_][a-z_0-9]*/),
          fc.stringMatching(/[a-z_][a-z_0-9]*/),
          fc.stringMatching(/[a-z_][a-z_0-9]*/), // identifier, not a string literal
          (kind, name, path) => {
            const source = `use { ${kind} ${name} } from ${path}`;
            expect(parse(source).getErrors().length).toBeGreaterThan(0);
          },
        ),
        EXTENDED,
      );
    });

    it('use statement with empty specifier list is accepted without errors (semantic check only)', () => {
      fc.assert(
        fc.property(
          singleLineStringArbitrary,
          (path) => {
            const source = `use { } from ${path}`;
            const result = parse(source);
            expect(result.getErrors()).toHaveLength(0);
            expect(result.getValue().ast.useDeclarations[0].specifiers?.specifiers).toHaveLength(0);
          },
        ),
        EXTENDED,
      );
    });

    it('specifier missing name always errors', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/[a-z_][a-z_0-9]*/),
          fc.stringMatching(/'[^'\n]*'/),
          (kind, path) => {
            const source = `use { ${kind} } from ${path}`;
            expect(parse(source).getErrors().length).toBeGreaterThan(0);
          },
        ),
        EXTENDED,
      );
    });

    it('upper-cased USE is still parsed as a use statement (case-insensitive)', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const uppercased = source.replace(/^use /, 'USE ');
          const result = parse(uppercased);
          expect(result.getErrors()).toHaveLength(0);
          expect(result.getValue().ast.useDeclarations).toHaveLength(1);
        }),
        CONFIG,
      );
    });
  });

  describe('use statements do not break existing schema parsing', () => {
    it('adding use statements to a schema should not change body element count', () => {
      fc.assert(
        fc.property(
          dbmlSchemaArbitrary,
          fc.array(useDeclarationArbitrary, { minLength: 1, maxLength: 3 }),
          (schema, uses) => {
            const baseResult = parse(schema);
            fc.pre(baseResult.getErrors().length === 0);

            const withUse = `${uses.join('\n')}\n${schema}`;
            const withUseResult = parse(withUse);
            fc.pre(withUseResult.getErrors().length === 0);

            expect(withUseResult.getValue().ast.declarations.length).toBe(baseResult.getValue().ast.declarations.length);
            expect(withUseResult.getValue().ast.useDeclarations.length).toBe(uses.length);
          },
        ),
        EXTENDED,
      );
    });
  });
});
