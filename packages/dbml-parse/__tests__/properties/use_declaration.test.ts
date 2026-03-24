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
  it('parses without errors, correct AST structure', () => {
    fc.assert(
      fc.property(useDeclarationArbitrary, (source) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.useDeclarations).toHaveLength(1);
        expect(ast.declarations).toHaveLength(0);

        const stmt = ast.useDeclarations[0];
        expect(stmt.kind).toBe(SyntaxNodeKind.USE_DECLARATION);
        expect(stmt.useKeyword?.value).toBe('use');
        expect(stmt.path).toBeDefined();

        // Position within bounds
        expect(stmt.start).toBeGreaterThanOrEqual(0);
        expect(stmt.end).toBeLessThanOrEqual(source.length);

        if (stmt.specifiers) {
          // Selective use
          expect(stmt.fromKeyword?.value).toBe('from');
          expect(stmt.specifiers.specifiers.length).toBeGreaterThanOrEqual(1);
          expect(stmt.specifiers.commaList.length).toBe(stmt.specifiers.specifiers.length - 1);
          stmt.specifiers.specifiers.forEach((spec) => {
            expect(spec.elementKind).toBeDefined();
            expect(spec.name).toBeDefined();
          });
        } else {
          // Entire-file use
          expect(stmt.star?.value).toBe('*');
          expect(stmt.fromKeyword?.value).toBe('from');
        }
      }),
      CONFIG,
    );
  });

  it('multiple use statements parse correctly and in order', () => {
    fc.assert(
      fc.property(
        fc.array(useDeclarationArbitrary, { minLength: 2, maxLength: 5 }),
        (stmts) => {
          const source = stmts.join('\n');
          const result = parse(source);
          expect(result.getErrors()).toHaveLength(0);
          expect(result.getValue().ast.useDeclarations).toHaveLength(stmts.length);

          const parsed = result.getValue().ast.useDeclarations;
          for (let i = 1; i < parsed.length; i++) {
            expect(parsed[i].start).toBeGreaterThanOrEqual(parsed[i - 1].end);
          }
        },
      ),
      CONFIG,
    );
  });

  it('coexists with schema elements without interference', () => {
    fc.assert(
      fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.useDeclarations.length).toBeGreaterThanOrEqual(1);
        expect(ast.declarations.length).toBeGreaterThanOrEqual(1);

        // Use declarations don't appear in body
        ast.declarations.forEach((e) => expect(e.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION));
        // Use statements end before body begins
        const lastUseEnd = Math.max(...ast.useDeclarations.map((s) => s.end));
        const firstBodyStart = Math.min(...ast.declarations.map((e) => e.start));
        expect(firstBodyStart).toBeGreaterThanOrEqual(lastUseEnd);
      }),
      CONFIG,
    );
  });

  it('roundtrips and is deterministic', () => {
    fc.assert(
      fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
        expect(print(source, parse(source).getValue().ast)).toBe(source);
      }),
      CONFIG,
    );
    fc.assert(
      fc.property(useDeclarationArbitrary, (source) => {
        expect(parse(source).getErrors().length).toBe(parse(source).getErrors().length);
      }),
      CONFIG,
    );
  });

  it('adding use statements does not change body element count', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        fc.array(useDeclarationArbitrary, { minLength: 1, maxLength: 3 }),
        (schema, uses) => {
          const base = parse(schema);
          fc.pre(base.getErrors().length === 0);

          const withUse = parse(`${uses.join('\n')}\n${schema}`);
          fc.pre(withUse.getErrors().length === 0);

          expect(withUse.getValue().ast.declarations.length).toBe(base.getValue().ast.declarations.length);
        },
      ),
      EXTENDED,
    );
  });

  describe('negative properties', () => {
    it('missing from, missing path, non-string path always error', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/[a-z_][a-z_0-9]*/),
          fc.stringMatching(/[a-z_][a-z_0-9]*/),
          (kind, name) => {
            // Missing from
            expect(parse(`use { ${kind} ${name} } './x'`).getErrors().length).toBeGreaterThan(0);
            // Missing path
            expect(parse(`use { ${kind} ${name} } from`).getErrors().length).toBeGreaterThan(0);
            // Non-string path
            expect(parse(`use { ${kind} ${name} } from ${name}`).getErrors().length).toBeGreaterThan(0);
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
            expect(parse(`use { ${kind} } from ${path}`).getErrors().length).toBeGreaterThan(0);
          },
        ),
        EXTENDED,
      );
    });

    it('upper-cased USE is case-insensitive', () => {
      fc.assert(
        fc.property(useDeclarationArbitrary, (source) => {
          const uppercased = source.replace(/^use /, 'USE ');
          expect(parse(uppercased).getErrors()).toHaveLength(0);
        }),
        CONFIG,
      );
    });
  });
});
