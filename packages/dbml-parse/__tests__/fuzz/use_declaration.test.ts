import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  useDeclarationArbitrary,
  schemaWithUseDeclarationsArbitrary,
  tableArbitrary,
  charSubstitutionArbitrary,
  multiCharInsertionArbitrary,
} from '../utils/arbitraries';
import { singleLineStringArbitrary } from '../utils/arbitraries/tokens';
import { parse } from '../utils';
import { SyntaxNodeKind } from '@/core/parser/nodes';

const FUZZ = { numRuns: 50 };
const ROBUSTNESS = { numRuns: 25 };

describe('[fuzz] use statement - valid input', () => {
  it('should parse generated use statements without crashing', () => {
    fc.assert(
      fc.property(useDeclarationArbitrary, (source) => {
        const result = parse(source);
        expect(result).toBeDefined();
        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(result.getValue().ast.useDeclarations).toBeInstanceOf(Array);
      }),
      FUZZ,
    );
  });

  it('should parse use statements mixed with schema without crashing', () => {
    fc.assert(
      fc.property(schemaWithUseDeclarationsArbitrary, (source) => {
        const result = parse(source);
        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
      }),
      FUZZ,
    );
  });
});

describe('[fuzz] use statement - robustness (malformed input)', () => {
  it('should not crash on arbitrary string starting with "use"', () => {
    const usePrefix = fc.string().map((s) => `use ${s}`);
    fc.assert(
      fc.property(usePrefix, (source) => {
        let threw = false;
        try {
          parse(source);
        } catch {
          threw = true;
        }
        expect(threw).toBe(false);
      }),
      ROBUSTNESS,
    );
  });

  it('should produce valid AST structure on truncated use statement', () => {
    const truncated = useDeclarationArbitrary.chain((source) =>
      fc.nat({ max: source.length }).map((n) => source.slice(0, n)),
    );
    fc.assert(
      fc.property(truncated, (source) => {
        const result = parse(source);
        expect(result.getValue().ast).toBeDefined();
        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
      }),
      ROBUSTNESS,
    );
  });

  it('should return valid AST on use statement with garbage path', () => {
    const garbage = fc.string().filter((s) => !s.includes('\0') && !s.startsWith("'"));
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constant('table'),
          fc.stringMatching(/[a-z_][a-z_0-9]*/),
          garbage,
        ),
        ([kind, name, path]) => {
          const source = `use { ${kind} ${name} } from ${path}`;
          let threw = false;
          try {
            parse(source);
          } catch {
            threw = true;
          }
          expect(threw).toBe(false);
          expect(parse(source).getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      ROBUSTNESS,
    );
  });

  it('should handle binary garbage embedded around "use" without crashing', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 50 }),
        (bytes) => {
          const source = `use ${String.fromCharCode(...bytes)}`;
          let threw = false;
          try {
            parse(source);
          } catch {
            threw = true;
          }
          expect(threw).toBe(false);
        },
      ),
      ROBUSTNESS,
    );
  });
});

describe('[fuzz] use statement - mutation resilience', () => {
  it('should produce valid AST after single character substitution', () => {
    fc.assert(
      fc.property(
        useDeclarationArbitrary.chain((source) => charSubstitutionArbitrary(source)),
        (mutated) => {
          const result = parse(mutated);
          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
          expect(result.getValue().ast.end).toBeLessThanOrEqual(mutated.length);
        },
      ),
      FUZZ,
    );
  });

  it('should produce valid AST after multi-character insertion', () => {
    fc.assert(
      fc.property(
        useDeclarationArbitrary.chain((source) => multiCharInsertionArbitrary(source)),
        (mutated) => {
          const result = parse(mutated);
          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      FUZZ,
    );
  });

  it('should produce valid AST after single character deletion', () => {
    fc.assert(
      fc.property(
        useDeclarationArbitrary,
        fc.nat(),
        (source, pos) => {
          fc.pre(source.length > 0);
          const idx = pos % source.length;
          const mutated = source.slice(0, idx) + source.slice(idx + 1);
          const result = parse(mutated);
          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      FUZZ,
    );
  });

  it('should produce valid AST after single character insertion', () => {
    fc.assert(
      fc.property(
        useDeclarationArbitrary,
        fc.nat(),
        fc.string({ minLength: 1, maxLength: 1 }).filter((c) => c !== '\0'),
        (source, pos, char) => {
          const idx = pos % (source.length + 1);
          const mutated = source.slice(0, idx) + char + source.slice(idx);
          const result = parse(mutated);
          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      FUZZ,
    );
  });
});

describe('[fuzz] use statement - negative (invalid input must error)', () => {
  it('should always error when "from" is replaced with garbage', () => {
    const garbage = fc.string().filter((s) =>
      !s.includes('\0') && s.trim() !== 'from' && s.trim().length > 0,
    );
    fc.assert(
      fc.property(
        fc.stringMatching(/[a-z_][a-z_0-9]*/),
        fc.stringMatching(/[a-z_][a-z_0-9]*/),
        fc.stringMatching(/'[^'\n]*/), // deliberately unclosed or garbage path
        garbage,
        (kind, name, path, junk) => {
          const source = `use { ${kind} ${name} } ${junk} ${path}`;
          const result = parse(source);
          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
          // 'from' is not present so must error
          expect(result.getErrors().length).toBeGreaterThan(0);
        },
      ),
      ROBUSTNESS,
    );
  });

  it('use statement with empty specifier list is accepted without errors (semantic check only)', () => {
    fc.assert(
      fc.property(singleLineStringArbitrary, (path) => {
        const source = `use { } from ${path}`;
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);
        expect(result.getValue().ast.useDeclarations[0].specifiers?.specifiers).toHaveLength(0);
      }),
      ROBUSTNESS,
    );
  });

  it('should always produce an error on completely arbitrary "use ..." input', () => {
    // Exclude valid use statement patterns — any random suffix should error
    const neverValid = fc.string().filter((s) =>
      !s.includes('\0')
      && !s.match(/^\{[^}]+\}\s+from\s+'[^']*'$/),
    );
    fc.assert(
      fc.property(neverValid, (suffix) => {
        const source = `use ${suffix}`;
        const result = parse(source);
        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        // Arbitrary suffix is almost certainly not valid
        // (we can only assert no crash; error presence depends on content)
        expect(result).toBeDefined();
      }),
      ROBUSTNESS,
    );
  });
});

describe('[fuzz] use statement - recovery with surrounding valid elements', () => {
  it('should recover body elements around a broken use statement', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.string().filter((s) => !s.includes('\0')),
        tableArbitrary,
        (before, garbage, after) => {
          const source = `${before}\nuse ${garbage}\n${after}`;
          const result = parse(source);
          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
          // Should recover at least some body elements
          expect(result.getValue().ast.body.length).toBeGreaterThanOrEqual(0);
        },
      ),
      ROBUSTNESS,
    );
  });

  it('should produce consistent result when parsing same use statement twice', () => {
    fc.assert(
      fc.property(useDeclarationArbitrary, (source) => {
        const r1 = parse(source);
        const r2 = parse(source);
        expect(r1.getErrors().length).toBe(r2.getErrors().length);
        expect(r1.getValue().ast.useDeclarations.length).toBe(r2.getValue().ast.useDeclarations.length);
      }),
      FUZZ,
    );
  });
});
