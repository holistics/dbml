import {
  describe, expect, test,
} from 'vitest';
import {
  SyntaxTokenKind, isTriviaToken,
} from '@/core/types/tokens';
import { CompileErrorCode } from '@/core/types/errors';
import { SyntaxNodeKind, ElementDeclarationNode } from '@/core/types/nodes';
import { WildcardNode } from '@/core/types/nodes';
import { isWildcardExpression } from '@/core/utils/expression';
import {
  lex, parse, analyze,
} from '@tests/utils';

// Helper to get non-trivia, non-EOF tokens
function getTokens (source: string) {
  return lex(source).getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);
}

describe('[example] wildcard', () => {
  // ── Sub-Problem 1: Lexer — WildcardToken ──

  describe('lexer', () => {
    test('should lex * as WILDCARD token, not OP', () => {
      const tokens = getTokens('*');

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.WILDCARD);
      expect(tokens[0].value).toBe('*');
    });

    test('should lex * as WILDCARD among other tokens', () => {
      const source = 'Tables { * }';
      const tokens = getTokens(source);
      const wildcardToken = tokens.find((t) => t.value === '*');

      expect(wildcardToken).toBeDefined();
      expect(wildcardToken!.kind).toBe(SyntaxTokenKind.WILDCARD);
    });

    test('should not affect other operators', () => {
      const tokens = getTokens('+ - / % < > = .');
      const kinds = tokens.map((t) => t.kind);

      expect(kinds.every((k) => k === SyntaxTokenKind.OP)).toBe(true);
    });
  });

  // ── Sub-Problem 2: Parser — WildcardNode ──

  describe('parser', () => {
    test('should parse * as WildcardNode', () => {
      const source = 'Table t { * }';
      const { ast } = parse(source).getValue();
      const table = ast.body[0] as ElementDeclarationNode;
      const body = table.body as any;
      const field = body.body[0];

      expect(field.callee).toBeInstanceOf(WildcardNode);
      expect(field.callee.kind).toBe(SyntaxNodeKind.WILDCARD);
    });

    test('isWildcardExpression should return true for WildcardNode', () => {
      const source = 'Table t { * }';
      const { ast } = parse(source).getValue();
      const table = ast.body[0] as ElementDeclarationNode;
      const body = table.body as any;
      const field = body.body[0];

      expect(isWildcardExpression(field.callee)).toBe(true);
    });

    test('isWildcardExpression should return false for non-wildcard', () => {
      const source = 'Table t { id int }';
      const { ast } = parse(source).getValue();
      const table = ast.body[0] as ElementDeclarationNode;
      const body = table.body as any;
      const field = body.body[0];

      expect(isWildcardExpression(field.callee)).toBe(false);
    });

    test('isWildcardExpression should return false for undefined', () => {
      expect(isWildcardExpression(undefined)).toBe(false);
    });
  });

  // ── Sub-Problem 3: Validators — Reject * outside DiagramView ──

  describe('validator: reject * as element name', () => {
    test('should reject * as Table name', () => {
      const source = 'Table * { id int }';
      const errors = analyze(source).getErrors();

      expect(errors.length).toBeGreaterThan(0);
      const wildcardError = errors.find((e) => e.code === CompileErrorCode.INVALID_NAME);
      expect(wildcardError).toBeDefined();
      expect(wildcardError!.diagnostic).toContain('Wildcard');
    });

    test('should reject * as Enum name', () => {
      const source = 'Enum * { value1 }';
      const errors = analyze(source).getErrors();

      const wildcardError = errors.find((e) => e.code === CompileErrorCode.INVALID_NAME);
      expect(wildcardError).toBeDefined();
      expect(wildcardError!.diagnostic).toContain('Wildcard');
    });

    test('should reject * as TableGroup name', () => {
      const source = 'TableGroup * { users }';
      const errors = analyze(source).getErrors();

      const wildcardError = errors.find((e) => e.code === CompileErrorCode.INVALID_NAME);
      expect(wildcardError).toBeDefined();
      expect(wildcardError!.diagnostic).toContain('Wildcard');
    });

    test('should reject * as Ref name', () => {
      const source = 'Ref *: users.id > posts.user_id';
      const errors = analyze(source).getErrors();

      const wildcardError = errors.find((e) => e.code === CompileErrorCode.INVALID_NAME);
      expect(wildcardError).toBeDefined();
      expect(wildcardError!.diagnostic).toContain('Wildcard');
    });

    test('should reject * as Note name', () => {
      const source = "Note * { 'some note' }";
      const errors = analyze(source).getErrors();

      const wildcardError = errors.find((e) => e.code === CompileErrorCode.INVALID_NAME);
      expect(wildcardError).toBeDefined();
      expect(wildcardError!.diagnostic).toContain('Wildcard');
    });
  });

  // ── DiagramView: Allow * ──

  describe('validator: allow * inside DiagramView', () => {
    test('should allow * in DiagramView body', () => {
      const source = `
        DiagramView myView {
          *
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should allow * in DiagramView Tables sub-block', () => {
      const source = `
        DiagramView myView {
          Tables {
            *
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should allow * in DiagramView Notes sub-block', () => {
      const source = `
        DiagramView myView {
          Notes {
            *
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should allow * in DiagramView TableGroups sub-block', () => {
      const source = `
        DiagramView myView {
          TableGroups {
            *
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should allow specific items alongside * in DiagramView sub-block (with warning)', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables {
            *
            users
          }
        }
      `;
      const report = analyze(source);
      const errors = report.getErrors();

      // No wildcard-related INVALID_NAME errors
      const wildcardErrors = errors.filter((e) => e.code === CompileErrorCode.INVALID_NAME && e.diagnostic.includes('Wildcard'));
      expect(wildcardErrors).toHaveLength(0);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    test('should still allow valid table names after wildcard fix', () => {
      const source = 'Table users { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should still allow quoted table names', () => {
      const source = 'Table "my table" { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should still allow schema-qualified table names', () => {
      const source = 'Table public.users { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });
});
