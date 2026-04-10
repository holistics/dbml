import { describe, expect, test } from 'vitest';
import { parse } from '@tests/utils';
import { UseSpecifierListNode, WildcardNode, SyntaxNodeKind, InfixExpressionNode } from '@/core/parser/nodes';
import { extractVariableFromExpression } from '@/core/utils/expression';

describe('[example] use declaration parsing', () => {
  test('should parse selective use with single specifier', () => {
    const { ast } = parse(`use { table users } from './schema'`).getValue();
    expect(ast.uses).toHaveLength(1);
    expect(ast.declarations).toHaveLength(0);

    const use = ast.uses[0];
    expect(use.useKeyword?.value).toBe('use');
    expect(use.isReuse).toBe(false);
    expect(use.fromKeyword?.value).toBe('from');
    expect(use.importPath?.value).toBe('./schema');

    const list = use.specifiers as UseSpecifierListNode;
    expect(list.specifiers).toHaveLength(1);

    const spec = list.specifiers[0];
    expect(spec.importKind?.value).toBe('table');
    expect(extractVariableFromExpression(spec.name)).toBe('users');
    expect(spec.asKeyword).toBeUndefined();
    expect(spec.alias).toBeUndefined();
  });

  test('should parse selective use with multiple specifiers on separate lines', () => {
    const { ast } = parse(`use {
  table users
  enum status
  tablepartial timestamps
} from './models'`).getValue();

    const list = ast.uses[0].specifiers as UseSpecifierListNode;
    expect(list.specifiers).toHaveLength(3);
    expect(list.specifiers[0].importKind?.value).toBe('table');
    expect(extractVariableFromExpression(list.specifiers[0].name)).toBe('users');
    expect(list.specifiers[1].importKind?.value).toBe('enum');
    expect(extractVariableFromExpression(list.specifiers[1].name)).toBe('status');
    expect(list.specifiers[2].importKind?.value).toBe('tablepartial');
    expect(extractVariableFromExpression(list.specifiers[2].name)).toBe('timestamps');
  });

  test('should parse use with alias', () => {
    const { ast } = parse(`use { table users as u } from './schema'`).getValue();
    const spec = (ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];

    expect(spec.importKind?.value).toBe('table');
    expect(extractVariableFromExpression(spec.name)).toBe('users');
    expect(spec.asKeyword?.value).toBe('as');
    expect(extractVariableFromExpression(spec.alias)).toBe('u');
  });

  test('should parse use with alias on next line', () => {
    const { ast } = parse(`use { table users
  as u } from './schema'`).getValue();
    const spec = (ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];

    expect(spec.importKind?.value).toBe('table');
    expect(extractVariableFromExpression(spec.name)).toBe('users');
    expect(spec.asKeyword?.value).toBe('as');
    expect(extractVariableFromExpression(spec.alias)).toBe('u');
  });

  test('should parse use with alias split across three lines', () => {
    const { ast } = parse(`use { table users
  as
  u } from './schema'`).getValue();
    const spec = (ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];

    expect(spec.importKind?.value).toBe('table');
    expect(extractVariableFromExpression(spec.name)).toBe('users');
    expect(spec.asKeyword?.value).toBe('as');
    expect(extractVariableFromExpression(spec.alias)).toBe('u');
  });

  test('should parse wildcard use', () => {
    const { ast } = parse(`use * from './common'`).getValue();
    expect(ast.uses).toHaveLength(1);

    const use = ast.uses[0];
    expect(use.specifiers).toBeInstanceOf(WildcardNode);
    expect(use.importPath?.value).toBe('./common');
    expect(use.isReuse).toBe(false);
  });

  test('should parse reuse with selective specifiers', () => {
    const { ast } = parse(`reuse { table users } from './schema'`).getValue();
    const use = ast.uses[0];
    expect(use.isReuse).toBe(true);
    expect(use.useKeyword?.value).toBe('reuse');
    expect((use.specifiers as UseSpecifierListNode).specifiers).toHaveLength(1);
  });

  test('should parse reuse with wildcard', () => {
    const { ast } = parse(`reuse * from './common'`).getValue();
    const use = ast.uses[0];
    expect(use.isReuse).toBe(true);
    expect(use.specifiers).toBeInstanceOf(WildcardNode);
  });

  test('should be case-insensitive for import kind', () => {
    const { ast } = parse(`use {
  Table users
  ENUM status
  TablePartial timestamps
} from './schema'`).getValue();

    const list = ast.uses[0].specifiers as UseSpecifierListNode;
    expect(list.specifiers).toHaveLength(3);
    expect(list.specifiers[0].importKind?.value).toBe('Table');
    expect(list.specifiers[1].importKind?.value).toBe('ENUM');
    expect(list.specifiers[2].importKind?.value).toBe('TablePartial');

    // getImportKind() should normalize
    expect(list.specifiers[0].getImportKind()).toBe('table');
    expect(list.specifiers[1].getImportKind()).toBe('enum');
    expect(list.specifiers[2].getImportKind()).toBe('tablepartial');
  });

  test('should be case-insensitive for use/reuse keyword', () => {
    const r1 = parse(`Use { table users } from './a'`).getValue().ast;
    const r2 = parse(`USE { table users } from './a'`).getValue().ast;
    const r3 = parse(`Reuse { table users } from './a'`).getValue().ast;
    const r4 = parse(`REUSE { table users } from './a'`).getValue().ast;

    expect(r1.uses).toHaveLength(1);
    expect(r2.uses).toHaveLength(1);
    expect(r3.uses[0].isReuse).toBe(true);
    expect(r4.uses[0].isReuse).toBe(true);
  });

  test('should parse schema-qualified specifier name', () => {
    const { ast } = parse(`use { table auth.users } from './schema'`).getValue();
    const spec = (ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
    expect(spec.name).toBeInstanceOf(InfixExpressionNode);
  });

  test('should parse use alongside element declarations', () => {
    const { ast } = parse(`
      use { table users } from './schema'
      Table posts { id int }
      use * from './common'
    `).getValue();

    expect(ast.uses).toHaveLength(2);
    expect(ast.declarations).toHaveLength(1);
    expect(ast.body).toHaveLength(3);
    // Body preserves source order
    expect(ast.body[0].kind).toBe(SyntaxNodeKind.USE_DECLARATION);
    expect(ast.body[1].kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
    expect(ast.body[2].kind).toBe(SyntaxNodeKind.USE_DECLARATION);
  });
});
