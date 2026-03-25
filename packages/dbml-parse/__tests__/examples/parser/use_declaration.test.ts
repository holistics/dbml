import { describe, expect, test } from 'vitest';
import { SyntaxNodeKind, UseSpecifierListNode } from '@/core/parser/nodes';
import { CompileErrorCode } from '@/core/errors';
import { parse } from '@tests/utils';
import { extractVariableFromExpression } from '@/core/utils';

describe('[example] parser - use statement', () => {
  test('selective use: parses specifiers, fromKeyword, path, AST structure', () => {
    const source = "use { table users, enum status } from './schema'";
    const result = parse(source);
    expect(result.getErrors()).toHaveLength(0);

    const ast = result.getValue().ast;
    expect(ast.useDeclarations).toHaveLength(1);
    expect(ast.declarations).toHaveLength(0);

    const stmt = ast.useDeclarations[0];
    expect(stmt.kind).toBe(SyntaxNodeKind.USE_DECLARATION);
    expect(stmt.useKeyword?.value).toBe('use');
    expect(stmt.fromKeyword?.value).toBe('from');
    expect(stmt.path?.value).toBe('./schema');
    expect(stmt.specifiers?.kind).toBe(SyntaxNodeKind.USE_SPECIFIER_LIST);
    expect(stmt.specifiers?.specifiers).toHaveLength(2);

    const spec = stmt.specifiers?.specifiers[0];
    expect(spec?.kind).toBe(SyntaxNodeKind.USE_SPECIFIER);
    expect(spec?.elementKind?.value).toBe('table');
    expect(extractVariableFromExpression(spec).unwrap_or(undefined)).toBe('users');

    expect(stmt.start).toBe(0);
    expect(stmt.end).toBe(source.length);
  });

  test('entire-file use: star token, fromKeyword, no specifiers', () => {
    const source = "use * from './common.dbml'";
    const result = parse(source);
    expect(result.getErrors()).toHaveLength(0);

    const stmt = result.getValue().ast.useDeclarations[0];
    expect(stmt.star?.value).toBe('*');
    expect(stmt.fromKeyword?.value).toBe('from');
    expect(stmt.path?.value).toBe('./common.dbml');
    expect(stmt.specifiers).toBeUndefined();
  });

  test('multiple use statements and coexistence with declarations', () => {
    const source = "use * from './common.dbml'\nuse { table users } from './schema'\nTable orders { id int }";
    const result = parse(source);
    expect(result.getErrors()).toHaveLength(0);

    const ast = result.getValue().ast;
    expect(ast.useDeclarations).toHaveLength(2);
    expect(ast.declarations).toHaveLength(1);

    // entire-file first
    expect(ast.useDeclarations[0].star?.value).toBe('*');
    expect(ast.useDeclarations[0].specifiers).toBeUndefined();

    // selective second
    expect(ast.useDeclarations[1].specifiers?.specifiers).toHaveLength(1);

    // use comes before body in source order
    expect(ast.declarations[0].start).toBeGreaterThanOrEqual(ast.useDeclarations[1].end);

    // body array does not contain use declarations
    ast.declarations.forEach((elem) => expect(elem.kind).not.toBe(SyntaxNodeKind.USE_DECLARATION));
  });

  test('specifier list: commas, braces, quoted names', () => {
    const list = parse("use { table a, enum b, table c } from './x'")
      .getValue().ast.useDeclarations[0].specifiers as UseSpecifierListNode;
    expect(list.specifiers).toHaveLength(3);
    expect(list.commaList).toHaveLength(2);
    expect(list.openBrace?.value).toBe('{');
    expect(list.closeBrace?.value).toBe('}');

    // quoted name
    const quoted = parse('use { table "user accounts" } from \'./schema\'');
    expect(quoted.getErrors()).toHaveLength(0);
    expect(extractVariableFromExpression(quoted.getValue().ast.useDeclarations[0].specifiers?.specifiers[0]).unwrap_or(undefined)).toBe('user accounts');
  });

  test('case insensitive: USE keyword', () => {
    const result = parse("USE { table users } from './schema'");
    expect(result.getErrors()).toHaveLength(0);
    expect(result.getValue().ast.useDeclarations).toHaveLength(1);
    expect(result.getValue().ast.useDeclarations[0].useKeyword?.value).toBe('USE');
  });

  test('empty specifier list is accepted (semantic concern, not syntax)', () => {
    const result = parse("use { } from './schema'");
    expect(result.getErrors()).toHaveLength(0);
    expect(result.getValue().ast.useDeclarations[0].specifiers?.specifiers).toHaveLength(0);
  });

  describe('invalid syntax produces errors', () => {
    test.each([
      [
        "missing 'from'", // test name
        "use { table users } './schema'", // program
        "Expect 'from' after specifier list", // error
      ],
      [
        'missing path',
        'use { table users } from',
        'Expect a string literal path',
      ],
      [
        'missing specifier name',
        "use { table } from './schema'",
        'Expect an element name',
      ],
      [
        'numeric name',
        "use { table 123 } from './schema'",
        'Expect an element name',
      ],
      [
        'non-string path',
        'use { table users } from users',
        'Expect a string literal path',
      ],
      [
        'numeric path',
        'use { table users } from 42',
        'Expect a string literal path',
      ],
      [
        'bare use',
        'use',
        undefined,
      ],
    ])('%s', (_name, source, expectedMessage) => {
      const errs = parse(source).getErrors();
      expect(errs.length).toBeGreaterThan(0);
      expect(errs[0].code).toBe(CompileErrorCode.UNEXPECTED_TOKEN);
      if (expectedMessage) expect(errs[0].diagnostic).toBe(expectedMessage);
    });
  });
});
