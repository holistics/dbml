import { describe, expect, test } from 'vitest';
import { parse } from '@tests/utils';
import {
  UseSpecifierListNode, WildcardNode, SyntaxNodeKind, InfixExpressionNode,
} from '@/core/types/nodes';
import { extractVariableFromExpression } from '@/core/utils/expression';

describe('[example] use declaration parsing', () => {
  test('selective use: kind, name, from, path', () => {
    const { ast } = parse('use { table users } from \'./schema\'').getValue();
    expect(ast.uses).toHaveLength(1);
    const use = ast.uses[0];
    expect(use.useKeyword?.value).toBe('use');
    expect(use.isReuse).toBe(false);
    expect(use.fromKeyword?.value).toBe('from');
    expect(use.importPath?.value).toBe('./schema');
    const spec = (use.specifiers as UseSpecifierListNode).specifiers[0];
    expect(spec.importKind?.value).toBe('table');
    expect(extractVariableFromExpression(spec.name)).toBe('users');
    expect(spec.asKeyword).toBeUndefined();
    expect(spec.alias).toBeUndefined();
  });

  test('multiple specifiers on separate lines', () => {
    const list = parse('use {\n  table users\n  enum status\n  tablepartial timestamps\n} from \'./m\'').getValue().ast.uses[0].specifiers as UseSpecifierListNode;
    expect(list.specifiers).toHaveLength(3);
    expect(list.specifiers.map((specifier) => specifier.importKind?.value)).toEqual(['table', 'enum', 'tablepartial']);
    expect(list.specifiers.map((specifier) => extractVariableFromExpression(specifier.name))).toEqual(['users', 'status', 'timestamps']);
  });

  test('alias inline, on next line, and split across three lines', () => {
    for (const source of [
      'use { table users as u } from \'./a\'',
      'use { table users\n  as u } from \'./a\'',
      'use { table users\n  as\n  u } from \'./a\'',
    ]) {
      const spec = (parse(source).getValue().ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
      expect(spec.asKeyword?.value).toBe('as');
      expect(extractVariableFromExpression(spec.alias)).toBe('u');
    }
  });

  test('wildcard use and reuse', () => {
    const useDeclaration = parse('use * from \'./a\'').getValue().ast.uses[0];
    expect(useDeclaration.specifiers).toBeInstanceOf(WildcardNode);
    expect(useDeclaration.isReuse).toBe(false);

    const reuseDeclaration = parse('reuse * from \'./a\'').getValue().ast.uses[0];
    expect(reuseDeclaration.specifiers).toBeInstanceOf(WildcardNode);
    expect(reuseDeclaration.isReuse).toBe(true);
  });

  test('case-insensitive keywords and import kinds', () => {
    for (const kw of ['Use', 'USE']) expect(parse(`${kw} { table x } from './a'`).getValue().ast.uses).toHaveLength(1);
    for (const kw of ['Reuse', 'REUSE']) expect(parse(`${kw} * from './a'`).getValue().ast.uses[0].isReuse).toBe(true);
    const list = parse('use {\n  Table x\n  ENUM y\n  TablePartial z\n} from \'./a\'').getValue().ast.uses[0].specifiers as UseSpecifierListNode;
    expect(list.specifiers.map((specifier) => specifier.getSymbolKind())).toEqual(['Table', 'Enum', 'TablePartial']);
  });

  test('schema-qualified specifier name', () => {
    const spec = (parse('use { table auth.users } from \'./a\'').getValue().ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
    expect(spec.name).toBeInstanceOf(InfixExpressionNode);
  });

  test('mixed use and elements preserve source order', () => {
    const { ast } = parse('use { table x } from \'./a\'\nTable t { id int }\nuse * from \'./b\'').getValue();
    expect(ast.body.map((node) => node.kind)).toEqual([SyntaxNodeKind.USE_DECLARATION, SyntaxNodeKind.ELEMENT_DECLARATION, SyntaxNodeKind.USE_DECLARATION]);
  });

  describe('parser recovery', () => {
    test('missing from keyword: 1 error', () => {
      const result = parse('use { table users } \'./schema\'');
      expect(result.getErrors()).toHaveLength(1);
      expect(result.getErrors()[0].diagnostic).toBe("Expect 'from' after specifier list");
      expect(result.getValue().ast.uses).toHaveLength(1);
    });

    test('missing import path: 1 error', () => {
      const result = parse('use { table users } from');
      expect(result.getErrors()).toHaveLength(1);
      expect(result.getErrors()[0].diagnostic).toBe('Expect a string literal path');
      expect(result.getValue().ast.uses[0].importPath).toBeUndefined();
    });

    test('missing closing brace: 2 errors, partial specifier list', () => {
      const result = parse('use { table users from \'./schema\'');
      expect(result.getErrors()).toHaveLength(2);
      expect(result.getErrors()[0].diagnostic).toBe('Expect a closing brace \'}\'');
      expect(result.getValue().ast.uses).toHaveLength(1);
    });

    test('missing specifiers: 6 errors, continues parsing elements', () => {
      const result = parse('use from \'./schema\'\nTable posts { id int }');
      expect(result.getErrors()).toHaveLength(6);
      expect(result.getErrors()[0].diagnostic).toBe("Expect an opening brace '{'");
      expect(result.getValue().ast.body.length).toBeGreaterThanOrEqual(1);
    });

    test('truncated use: errors, does not crash', () => {
      const result1 = parse('use');
      expect(result1.getErrors()).toHaveLength(4);
      expect(result1.getErrors()[0].diagnostic).toBe("Expect an opening brace '{'");

      const result2 = parse('use {');
      expect(result2.getErrors()).toHaveLength(3);
      expect(result2.getErrors()[0].diagnostic).toBe("Expect a closing brace '}'");

      const result3 = parse('use *');
      expect(result3.getErrors()).toHaveLength(2);
      expect(result3.getErrors()[0].diagnostic).toBe("Expect 'from' after '*'");
    });

    test('as without alias: 1 error, alias is undefined', () => {
      const result = parse('use { table users as } from \'./a\'');
      expect(result.getErrors()).toHaveLength(1);
      expect(result.getErrors()[0].diagnostic).toBe("Expect an alias name after 'as'");
      expect(result.getValue().ast.uses).toHaveLength(1);
      const spec = (result.getValue().ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
      expect(spec.asKeyword?.value).toBe('as');
      expect(spec.alias).toBeUndefined();
    });

    test('as then newline then close brace: 1 error', () => {
      const result = parse('use { table users as\n} from \'./a\'');
      expect(result.getErrors()).toHaveLength(1);
      expect(result.getErrors()[0].diagnostic).toBe("Expect an alias name after 'as'");
    });

    test('recovery after malformed use still parses elements', () => {
      const result = parse('use { table\nTable users { id int }');
      expect(result.getErrors().length).toBeGreaterThan(0);
      expect(result.getValue().ast.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
