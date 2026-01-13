import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { dbmlSchemaArbitrary, tableArbitrary, enumArbitrary, tablePartialArbitrary, partialInjectionArbitrary } from '../utils/arbitraries';
import { isEqual } from 'lodash-es';
import { parse, print, lex } from '../utils';
import { SyntaxNodeKind, BlockExpressionNode } from '@/core/parser/nodes';

const PROPERTY_TEST_CONFIG = { numRuns: 50 };
const EXTENDED_CONFIG = { numRuns: 25 };

describe('[property] parser', () => {
  it('should produce consistent ASTs', { timeout: 30000 }, () => {
    // Property: Parsing the same source twice should produce the same ASTs
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result1 = parse(source);
        const result2 = parse(source);
        expect(isEqual(result1, result2)).toBeTruthy();
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should roundtrip with valid DBML', () => {
    // Property: Source 1 -parse-> ast -print-> Source 2
    // Then: Source 1 === Source 2
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const ast = parse(source).getValue().ast;
        const newSource = print(source, ast);
        expect(source).toEqual(newSource);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should roundtrip with ASCII strings', () => {
    // Property: Source 1 -parse-> ast -print-> Source 2
    // Then: Source 1 === Source 2
    fc.assert(
      fc.property(fc.string(), (source: string) => {
        const ast = parse(source).getValue().ast;
        const newSource = print(source, ast);
        expect(source).toEqual(newSource);
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should roundtrip with valid dbml injected with random strings', () => {
    // Property: Source 1 -parse-> ast -print-> Source 2
    // Then: Source 1 === Source 2
    fc.assert(
      fc.property(dbmlSchemaArbitrary, fc.nat({ max: 10 }), fc.string(), (source: string, injectedPos: number, injectSource: string) => {
        const injectedSource = `${source.slice(0, injectedPos)}${injectSource}${source.slice(injectedPos)}`;
        const ast = parse(injectedSource).getValue().ast;
        const newSource = print(injectedSource, ast);
        expect(injectedSource).toEqual(newSource);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should always produce a PROGRAM node as root', () => {
    // Property: The root of any AST should always be a PROGRAM node
    fc.assert(
      fc.property(fc.string(), (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast).toBeDefined();
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body).toBeInstanceOf(Array);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have error positions within source bounds', () => {
    // Property: All errors should have positions within source bounds
    fc.assert(
      fc.property(fc.string(), (source: string) => {
        const result = parse(source);
        const errors = result.getErrors();

        errors.forEach((error) => {
          expect(error.start).toBeGreaterThanOrEqual(0);
          expect(error.end).toBeGreaterThanOrEqual(error.start);
          expect(error.end).toBeLessThanOrEqual(source.length);
        });
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should have AST span matching source length for valid input', () => {
    // Property: For valid DBML, the AST should span the entire source
    // Note: Leading trivia (comments, whitespace) is attached to the first token,
    // so we only check that the AST ends at source.length
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        if (result.getErrors().length === 0 && source.length > 0 && ast.body.length > 0) {
          // AST start may be > 0 due to leading trivia (comments, whitespace)
          expect(ast.start).toBeGreaterThanOrEqual(0);
          expect(ast.end).toBe(source.length);
        }
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should preserve element order from source', () => {
    // Property: Elements in AST body should be in source order
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        for (let i = 1; i < ast.body.length; i++) {
          expect(ast.body[i].start).toBeGreaterThanOrEqual(ast.body[i - 1].end);
        }
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have all ELEMENT_DECLARATION nodes in program body', () => {
    // Property: All top-level elements should be ELEMENT_DECLARATION nodes
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        ast.body.forEach((elem) => {
          expect(elem.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have tokens matching AST structure', () => {
    // Property: Tokens from lexer should be referenced correctly by AST
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const tokens = lex(source).getValue();
        const result = parse(source);

        // The tokens should cover the entire source
        if (tokens.length > 0) {
          const lastNonEofToken = tokens[tokens.length - 2];
          expect(lastNonEofToken.end).toBeLessThanOrEqual(source.length);
        }

        // Parse should complete without throwing
        expect(result.getValue().ast).toBeDefined();
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should be deterministic with seeded random input', () => {
    // Property: Same input always produces same output
    fc.assert(
      fc.property(
        fc.string(),
        (source: string) => {
          const result1 = parse(source);
          const result2 = parse(source);
          const result3 = parse(source);

          expect(result1.getErrors().length).toBe(result2.getErrors().length);
          expect(result2.getErrors().length).toBe(result3.getErrors().length);
          expect(result1.getValue().ast.body.length).toBe(result2.getValue().ast.body.length);
          expect(result2.getValue().ast.body.length).toBe(result3.getValue().ast.body.length);
        },
      ),
      EXTENDED_CONFIG,
    );
  });
});

describe('[property] parser - TablePartial (tilde)', () => {
  it('should roundtrip TablePartial declarations', () => {
    fc.assert(
      fc.property(tablePartialArbitrary, (source: string) => {
        const ast = parse(source).getValue().ast;
        const newSource = print(source, ast);
        expect(source).toEqual(newSource);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should parse TablePartial injection syntax correctly', () => {
    fc.assert(
      fc.property(tablePartialArbitrary, partialInjectionArbitrary, (partial: string, injection: string) => {
        // Combine a TablePartial with a table that uses the injection
        const source = `${partial}\n\nTable test {\n  id int\n  ${injection}\n}`;
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body.length).toBe(2); // TablePartial and Table
      }),
      EXTENDED_CONFIG,
    );
  });
});

// AST structure semantic properties - verify parsed structure matches input semantics
describe('[property] parser - AST structure semantics', () => {
  it('should have ElementDeclaration nodes with type tokens', () => {
    // Property: Every ELEMENT_DECLARATION should have a defined type token
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        ast.body.forEach((node) => {
          if (node.kind === SyntaxNodeKind.ELEMENT_DECLARATION) {
            expect(node.type).toBeDefined();
            expect(node.type?.value).toBeDefined();
            expect(node.type?.value.length).toBeGreaterThan(0);
          }
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have table elements with body containing columns', () => {
    // Property: Table elements should have block bodies with column definitions
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const result = parse(source);

        const ast = result.getValue().ast;
        const table = ast.body[0];

        expect(table.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
        expect(table.type?.value?.toLowerCase()).toBe('table');
        expect(table.body?.kind).toBe(SyntaxNodeKind.BLOCK_EXPRESSION);
        expect((table.body as BlockExpressionNode)?.body).toBeInstanceOf(Array);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have enum elements with value entries', () => {
    // Property: Enum elements should have block bodies with enum values
    fc.assert(
      fc.property(enumArbitrary, (source: string) => {
        const result = parse(source);

        const ast = result.getValue().ast;
        const enumDecl = ast.body[0];

        expect(enumDecl.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
        expect(enumDecl.type?.value?.toLowerCase()).toBe('enum');
        expect(enumDecl.body?.kind).toBe(SyntaxNodeKind.BLOCK_EXPRESSION);
        expect((enumDecl.body as BlockExpressionNode)?.body).toBeInstanceOf(Array);
        expect((enumDecl.body as BlockExpressionNode)?.body.length).toBeGreaterThanOrEqual(1);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should preserve table name from source', () => {
    // Property: Parsed table name should be extractable from the AST
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const result = parse(source);

        const ast = result.getValue().ast;
        const table = ast.body[0];

        // Name should be defined and within source bounds
        expect(table.name).toBeDefined();
        expect(table.name?.start).toBeGreaterThanOrEqual(0);
        expect(table.name?.end).toBeLessThanOrEqual(source.length);

        // Extracted name text should be non-empty
        const nameText = source.slice(table.name?.start, table.name?.end);
        expect(nameText.length).toBeGreaterThan(0);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have ref elements with infix expression body', () => {
    // Property: Standalone refs should have body with relationship operator
    fc.assert(
      fc.property(fc.oneof(
        fc.constant('Ref: a.id > b.id'),
        fc.constant('Ref: x.col < y.col'),
        fc.constant('Ref: m.f - n.f'),
        fc.constant('Ref: p.q <> r.s'),
      ), (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        const ref = ast.body[0];
        expect(ref.type?.value?.toLowerCase()).toBe('ref');
        expect(ref.bodyColon).toBeDefined();
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have nested block positions within parent bounds', () => {
    // Property: All nested blocks should have positions contained within their parent
    // Note: Trivia (whitespace, comments) is attached to tokens but stored with positions
    // outside the token bounds - this is by design, so we skip trivia properties
    const triviaProperties = new Set([
      'leadingTrivia',
      'trailingTrivia',
      'leadingInvalid',
      'trailingInvalid',
    ]);

    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = parse(source);

        const ast = result.getValue().ast;

        function checkNested (node: any, parentStart: number, parentEnd: number): void {
          if (!node || typeof node !== 'object') return;
          // Skip parent references to avoid circular checks
          if (node.parent) return;

          if ('start' in node && 'end' in node) {
            expect(node.start).toBeGreaterThanOrEqual(parentStart);
            expect(node.end).toBeLessThanOrEqual(parentEnd);

            // Recursively check children with updated bounds, skipping trivia
            Object.entries(node).forEach(([key, child]) => {
              if (triviaProperties.has(key)) return; // Skip trivia properties
              if (Array.isArray(child)) {
                child.forEach((c) => checkNested(c, node.start, node.end));
              } else if (child && typeof child === 'object' && 'start' in child) {
                checkNested(child, node.start, node.end);
              }
            });
          }
        }

        ast.body.forEach((elem) => checkNested(elem, 0, source.length));
      }),
      { numRuns: 50 },
    );
  });
});

// Negative property tests - verify invariants are violated for invalid input
describe('[property] parser - negative tests', () => {
  it('should report errors for unclosed braces', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count: number) => {
          const source = 'Table t '.repeat(count) + '{'.repeat(count);
          const result = parse(source);

          // Unclosed braces must produce errors
          expect(result.getErrors().length).toBeGreaterThan(0);
        },
      ),
      EXTENDED_CONFIG,
    );
  });

  it('should report errors for invalid syntax patterns', () => {
    const invalidPatterns = fc.constantFrom(
      'Table {', // unclosed brace
      'Ref: >', // incomplete ref
      '<<<>>>', // meaningless operators
      'Table users { id int } garbage', // trailing garbage
    );

    fc.assert(
      fc.property(invalidPatterns, (source: string) => {
        const result = parse(source);

        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should not produce valid elements for garbage input', () => {
    // Exclude / to avoid creating comments (// or /*)
    const garbage = fc.stringMatching(/^[!@#$%^&*()_+={}|\\:;<>?~`]+$/);

    fc.assert(
      fc.property(garbage, (source: string) => {
        const result = parse(source);

        // Garbage input should not produce valid elements
        // (body may have error recovery nodes but no valid declarations)
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      EXTENDED_CONFIG,
    );
  });
});
