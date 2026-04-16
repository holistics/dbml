import { describe, expect, test } from 'vitest';
import { parse } from '@tests/utils';
import { UseSpecifierListNode, WildcardNode, SyntaxNodeKind, InfixExpressionNode } from '@/core/types/nodes';
import { extractVariableFromExpression } from '@/core/utils/expression';

describe('[example] use declaration parsing', () => {
  test('selective use: kind, name, from, path', () => {
    const { ast } = parse(`use { table users } from './schema'`).getValue();
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
    const list = parse(`use {\n  table users\n  enum status\n  tablepartial timestamps\n} from './m'`).getValue().ast.uses[0].specifiers as UseSpecifierListNode;
    expect(list.specifiers).toHaveLength(3);
    expect(list.specifiers.map((s) => s.importKind?.value)).toEqual(['table', 'enum', 'tablepartial']);
    expect(list.specifiers.map((s) => extractVariableFromExpression(s.name))).toEqual(['users', 'status', 'timestamps']);
  });

  test('alias inline, on next line, and split across three lines', () => {
    for (const src of [
      `use { table users as u } from './a'`,
      `use { table users\n  as u } from './a'`,
      `use { table users\n  as\n  u } from './a'`,
    ]) {
      const spec = (parse(src).getValue().ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
      expect(spec.asKeyword?.value).toBe('as');
      expect(extractVariableFromExpression(spec.alias)).toBe('u');
    }
  });

  test('wildcard use and reuse', () => {
    const u = parse(`use * from './a'`).getValue().ast.uses[0];
    expect(u.specifiers).toBeInstanceOf(WildcardNode);
    expect(u.isReuse).toBe(false);

    const r = parse(`reuse * from './a'`).getValue().ast.uses[0];
    expect(r.specifiers).toBeInstanceOf(WildcardNode);
    expect(r.isReuse).toBe(true);
  });

  test('case-insensitive keywords and import kinds', () => {
    for (const kw of ['Use', 'USE']) expect(parse(`${kw} { table x } from './a'`).getValue().ast.uses).toHaveLength(1);
    for (const kw of ['Reuse', 'REUSE']) expect(parse(`${kw} * from './a'`).getValue().ast.uses[0].isReuse).toBe(true);
    const list = parse(`use {\n  Table x\n  ENUM y\n  TablePartial z\n} from './a'`).getValue().ast.uses[0].specifiers as UseSpecifierListNode;
    expect(list.specifiers.map((s) => s.getImportKind())).toEqual(['table', 'enum', 'tablepartial']);
  });

  test('schema-qualified specifier name', () => {
    const spec = (parse(`use { table auth.users } from './a'`).getValue().ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
    expect(spec.name).toBeInstanceOf(InfixExpressionNode);
  });

  test('mixed use and elements preserve source order', () => {
    const { ast } = parse(`use { table x } from './a'\nTable t { id int }\nuse * from './b'`).getValue();
    expect(ast.body.map((n) => n.kind)).toEqual([SyntaxNodeKind.USE_DECLARATION, SyntaxNodeKind.ELEMENT_DECLARATION, SyntaxNodeKind.USE_DECLARATION]);
  });

  describe('parser recovery', () => {
    test('missing from keyword: 1 error', () => {
      const r = parse(`use { table users } './schema'`);
      expect(r.getErrors()).toHaveLength(1);
      expect(r.getErrors()[0].diagnostic).toBe("Expect 'from' after specifier list");
      expect(r.getValue().ast.uses).toHaveLength(1);
    });

    test('missing import path: 2 errors', () => {
      const r = parse(`use { table users } from`);
      expect(r.getErrors()).toHaveLength(2);
      expect(r.getErrors()[0].diagnostic).toBe('Expect a string literal path');
      expect(r.getErrors()[1].diagnostic).toBe('Unexpected EOF');
      expect(r.getValue().ast.uses[0].importPath).toBeUndefined();
    });

    test('missing closing brace: 2 errors, partial specifier list', () => {
      const r = parse(`use { table users from './schema'`);
      expect(r.getErrors()).toHaveLength(2);
      expect(r.getErrors()[0].diagnostic).toBe('Expect an element name');
      expect(r.getValue().ast.uses).toHaveLength(1);
    });

    test('missing specifiers: 2 errors, continues parsing elements', () => {
      const r = parse(`use from './schema'\nTable posts { id int }`);
      expect(r.getErrors()).toHaveLength(2);
      expect(r.getErrors()[0].diagnostic).toBe("Expect an opening brace '{'");
      expect(r.getErrors()[1].diagnostic).toBe('Expect an identifier');
      expect(r.getValue().ast.declarations.length).toBeGreaterThanOrEqual(1);
    });

    test('truncated use: 2 errors each, does not crash', () => {
      const r1 = parse('use');
      expect(r1.getErrors()).toHaveLength(2);
      expect(r1.getErrors()[0].diagnostic).toBe("Expect an opening brace '{'");

      const r2 = parse('use {');
      expect(r2.getErrors()).toHaveLength(2);
      expect(r2.getErrors()[0].diagnostic).toBe("Expect a closing brace '}'");

      const r3 = parse('use *');
      expect(r3.getErrors()).toHaveLength(2);
      expect(r3.getErrors()[0].diagnostic).toBe("Expect 'from' after '*'");
    });

    test('as without alias: 2 errors, alias is undefined', () => {
      const r = parse(`use { table users as } from './a'`);
      expect(r.getErrors()).toHaveLength(2);
      expect(r.getErrors()[0].diagnostic).toBe("Expect an alias name after 'as'");
      expect(r.getValue().ast.uses).toHaveLength(1);
      const spec = (r.getValue().ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
      expect(spec.asKeyword?.value).toBe('as');
      expect(spec.alias).toBeUndefined();
    });

    test('as then newline then close brace: 2 errors', () => {
      const r = parse(`use { table users as\n} from './a'`);
      expect(r.getErrors()).toHaveLength(2);
      expect(r.getErrors()[0].diagnostic).toBe("Expect an alias name after 'as'");
    });

    test('recovery after malformed use still parses elements', () => {
      const r = parse(`use { table\nTable users { id int }`);
      expect(r.getErrors()).toHaveLength(3);
      expect(r.getValue().ast.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
