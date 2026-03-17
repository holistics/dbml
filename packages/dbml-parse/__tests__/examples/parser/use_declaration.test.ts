import { describe, expect, test } from 'vitest';
import { SyntaxNodeKind, UseDeclarationNode, UseSpecifierListNode, UseSpecifierNode, PrimaryExpressionNode, VariableNode } from '@/core/parser/nodes';
import { CompileErrorCode } from '@/core/errors';
import { parse } from '@tests/utils';

function specNameValue (spec?: UseSpecifierNode): string | undefined {
  const name = spec?.name;
  if (name instanceof PrimaryExpressionNode && name.expression instanceof VariableNode) {
    return name.expression.variable?.value;
  }
  return undefined;
}

function getUseStatements (source: string): UseDeclarationNode[] {
  return parse(source).getValue().ast.useDeclarations;
}

describe('[example] parser - use statement', () => {
  describe('basic parsing', () => {
    test('should parse a single specifier', () => {
      const source = "use { table users } from './schema'";
      const result = parse(source);

      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue().ast;
      expect(ast.useDeclarations).toHaveLength(1);
      expect(ast.declarations).toHaveLength(0);
    });

    test('should parse multiple specifiers', () => {
      const source = "use { table users, enum status, table orders } from './schema'";
      const result = parse(source);

      expect(result.getErrors()).toHaveLength(0);

      const stmts = getUseStatements(source);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      expect(stmt.specifiers?.specifiers).toHaveLength(3);
    });

    test('should parse use statement followed by table declaration', () => {
      const source = "use { table users } from './schema'\nTable orders { id int }";
      const result = parse(source);

      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue().ast;
      expect(ast.useDeclarations).toHaveLength(1);
      expect(ast.declarations).toHaveLength(1);
    });

    test('should parse multiple use statements', () => {
      const source = "use { table users } from './a'\nuse { enum status } from './b'";
      const result = parse(source);

      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue().ast;
      expect(ast.useDeclarations).toHaveLength(2);
    });
  });

  describe('AST node structure', () => {
    test('UseDeclarationNode should have correct kind', () => {
      const stmts = getUseStatements("use { table users } from './schema'");
      expect(stmts[0].kind).toBe(SyntaxNodeKind.USE_DECLARATION);
    });

    test('should have useKeyword token with value "use"', () => {
      const stmts = getUseStatements("use { table users } from './schema'");
      expect(stmts[0].useKeyword?.value).toBe('use');
    });

    test('should have fromKeyword token with value "from"', () => {
      const stmts = getUseStatements("use { table users } from './schema'");
      expect(stmts[0].fromKeyword?.value).toBe('from');
    });

    test('should have path token as string literal (value is content without quotes)', () => {
      const stmts = getUseStatements("use { table users } from './schema'");
      // The lexer strips surrounding quote characters; value is the content only
      expect(stmts[0].path?.value).toBe('./schema');
    });

    test('specifiers should have USE_SPECIFIER_LIST kind', () => {
      const stmts = getUseStatements("use { table users } from './schema'");
      expect(stmts[0].specifiers?.kind).toBe(SyntaxNodeKind.USE_SPECIFIER_LIST);
    });

    test('each specifier should have USE_SPECIFIER kind', () => {
      const stmts = getUseStatements("use { table users, enum status } from './schema'");
      const specifiers = stmts[0].specifiers?.specifiers ?? [];
      expect(specifiers).toHaveLength(2);
      specifiers.forEach((s) => expect(s.kind).toBe(SyntaxNodeKind.USE_SPECIFIER));
    });

    test('specifier should have elementKind and name tokens', () => {
      const stmts = getUseStatements("use { table users } from './schema'");
      const spec = stmts[0].specifiers?.specifiers[0];
      expect(spec?.elementKind?.value).toBe('table');
      expect(specNameValue(spec)).toBe('users');
    });

    test('should accept quoted name in specifier', () => {
      const source = 'use { table "user accounts" } from \'./schema\'';
      const result = parse(source);
      expect(result.getErrors()).toHaveLength(0);

      const spec = getUseStatements(source)[0].specifiers?.specifiers[0];
      // QUOTED_STRING token value is the content without surrounding double quotes
      expect(specNameValue(spec)).toBe('user accounts');
    });
  });

  describe('position tracking', () => {
    test('use statement should span the full text', () => {
      const source = "use { table users } from './schema'";
      const stmt = getUseStatements(source)[0];
      expect(stmt.start).toBe(0);
      expect(stmt.end).toBe(source.length);
    });

    test('use statements should come before body elements in source order', () => {
      const source = "use { table users } from './a'\nTable orders { id int }";
      const ast = parse(source).getValue().ast;
      const useEnd = ast.useDeclarations[0].end;
      const bodyStart = ast.declarations[0].start;
      expect(bodyStart).toBeGreaterThanOrEqual(useEnd);
    });
  });

  describe('specifier list details', () => {
    test('comma list should have N-1 commas for N specifiers', () => {
      const source = "use { table a, enum b, table c } from './x'";
      const stmts = getUseStatements(source);
      const list = stmts[0].specifiers as UseSpecifierListNode;
      expect(list.specifiers).toHaveLength(3);
      expect(list.commaList).toHaveLength(2);
    });

    test('should have openBrace and closeBrace tokens', () => {
      const source = "use { table users } from './schema'";
      const list = getUseStatements(source)[0].specifiers as UseSpecifierListNode;
      expect(list.openBrace?.value).toBe('{');
      expect(list.closeBrace?.value).toBe('}');
    });
  });

  describe('negative tests — invalid syntax must produce errors', () => {
    test('missing "from" keyword: use { table users } \'path\'', () => {
      const source = "use { table users } './schema'";
      const errors = parse(source).getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      expect(errors[0].diagnostic).toBe("Expect 'from' after specifier list");
    });

    test('missing path after from: use { table users } from', () => {
      const source = 'use { table users } from';
      const errors = parse(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      expect(errors[0].diagnostic).toBe('Expect a string literal path');
    });

    test('missing specifier list: use from \'path\'', () => {
      // 'from' is parsed as a specifier kind — then './schema' is not a valid name
      const source = "use from './schema'";
      const errors = parse(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
    });

    test('empty specifier list: use { } from \'path\' is accepted without error', () => {
      // The parser does not enforce a non-empty specifier list — that is a semantic concern
      const source = "use { } from './schema'";
      const result = parse(source);
      expect(result.getErrors()).toHaveLength(0);
      const stmt = result.getValue().ast.useDeclarations[0];
      expect(stmt.useKeyword?.value).toBe('use');
      expect(stmt.fromKeyword?.value).toBe('from');
      expect(stmt.path?.value).toBe('./schema');
      expect(stmt.specifiers?.specifiers).toHaveLength(0);
    });

    test('specifier missing name: use { table } from \'path\'', () => {
      // 'table' is consumed as elementKind, then '}' is not a valid name
      const source = "use { table } from './schema'";
      const errors = parse(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      expect(errors[0].diagnostic).toBe('Expect an element name');
    });

    test('specifier with number as name: use { table 123 } from \'path\'', () => {
      // Numeric literal is not IDENTIFIER or QUOTED_STRING
      const source = "use { table 123 } from './schema'";
      const errors = parse(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      expect(errors[0].diagnostic).toBe('Expect an element name');
    });

    test('non-string-literal path: use { table users } from users', () => {
      // Identifier is not a STRING_LITERAL
      const source = 'use { table users } from users';
      const errors = parse(source).getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      expect(errors[0].diagnostic).toBe('Expect a string literal path');
    });

    test('numeric path: use { table users } from 42', () => {
      const source = 'use { table users } from 42';
      const errors = parse(source).getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      expect(errors[0].diagnostic).toBe('Expect a string literal path');
    });

    test('unclosed specifier list: use { table users from \'path\'', () => {
      const source = "use { table users from './schema'";
      const errors = parse(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
    });

    test('bare use without specifiers or path: use', () => {
      const source = 'use';
      const errors = parse(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      expect(errors[0].diagnostic).toBe("Expect an opening brace '{'");
    });

    test('bare use with only a path (no specifier list): use \'path\'', () => {
      // This form is NOT supported — specifier list is required
      // 'path' will be treated as element kind in specifier, then fails
      const source = "use './schema'";
      const errors = parse(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
    });

    test('USE keyword (uppercase) is accepted as a use statement (case-insensitive)', () => {
      const source = "USE { table users } from './schema'";
      const result = parse(source);
      expect(result.getErrors()).toHaveLength(0);
      const ast = result.getValue().ast;
      expect(ast.useDeclarations).toHaveLength(1);
      expect(ast.declarations).toHaveLength(0);
      expect(ast.useDeclarations[0].useKeyword?.value).toBe('USE');
    });

    test('still produces a valid AST on any broken use statement', () => {
      const broken = [
        'use',
        'use {',
        'use { }',
        'use { table }',
        'use { table users }',
        'use { table users } from',
        'use { table users } from 42',
        'use {{{ from @@@ }',
      ];
      broken.forEach((source) => {
        const result = parse(source);
        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(result.getErrors().length).toBeGreaterThan(0);
      });
    });

    test('body elements are still parsed after a broken use statement', () => {
      const source = 'use { table users } from\nTable orders { id int }';
      const result = parse(source);
      expect(result.getErrors().length).toBeGreaterThan(0);
      // Error recovery should not swallow the Table declaration
      expect(result.getValue().ast.declarations.length).toBeGreaterThanOrEqual(1);
    });

    test('error recovery after broken use statement does not crash', () => {
      // The first use statement is broken (missing path). synchronizeProgram() consumes
      // exactly one token for recovery, which may overlap the second statement.
      // The key invariant is: no crash and at least one error is reported.
      const source = "use { table users } from\nuse { enum status } from './b'";
      const result = parse(source);
      expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
      expect(result.getErrors().length).toBeGreaterThan(0);
    });
  });

  describe('coexistence with other elements', () => {
    test('use statements should not appear in body array', () => {
      const source = "use { table users } from './a'\nTable orders { id int }";
      const ast = parse(source).getValue().ast;
      ast.declarations.forEach((elem) => {
        expect(elem.kind).not.toBe(SyntaxNodeKind.USE_DECLARATION);
      });
    });

    test('body elements should not appear in useDeclarations array', () => {
      const source = "use { table users } from './a'\nTable orders { id int }";
      const ast = parse(source).getValue().ast;
      ast.useDeclarations.forEach((stmt) => {
        expect(stmt.kind).toBe(SyntaxNodeKind.USE_DECLARATION);
      });
    });

    test('should preserve normal element parsing with use statements present', () => {
      const source = [
        "use { table users } from './a'",
        'Table orders { id int }',
        'Enum status { active inactive }',
      ].join('\n');

      const result = parse(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue().ast;
      expect(ast.useDeclarations).toHaveLength(1);
      expect(ast.declarations).toHaveLength(2);
    });
  });
});
