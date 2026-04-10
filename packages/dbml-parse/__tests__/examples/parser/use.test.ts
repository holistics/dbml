import { describe, expect, test } from 'vitest';
import { parse } from '@tests/utils';
import { UseDeclarationNode, UseSpecifierNode, UseSpecifierListNode, WildcardNode, SyntaxNodeKind, InfixExpressionNode } from '@/core/parser/nodes';

describe('[example] use declaration parsing', () => {
  describe('selective use', () => {
    test('should parse use with single specifier', () => {
      const { ast } = parse(`use { table users } from './schema'`).getValue();
      expect(ast.uses).toHaveLength(1);

      const use = ast.uses[0];
      expect(use).toBeInstanceOf(UseDeclarationNode);
      expect(use.useKeyword?.value).toBe('use');
      expect(use.fromKeyword?.value).toBe('from');
      expect(use.importPath?.value).toBe('./schema');
      expect(use.isReuse).toBe(false);

      expect(use.specifiers).toBeInstanceOf(UseSpecifierListNode);
      const list = use.specifiers as UseSpecifierListNode;
      expect(list.specifiers).toHaveLength(1);
      expect(list.specifiers[0].importKind?.value).toBe('table');
      expect(list.specifiers[0].name?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
    });

    test('should parse use with multiple specifiers', () => {
      const { ast } = parse(`use {
  table users
  enum status
} from './models'`).getValue();
      const use = ast.uses[0];
      const list = use.specifiers as UseSpecifierListNode;
      expect(list.specifiers).toHaveLength(2);
      expect(list.specifiers[0].importKind?.value).toBe('table');
      expect(list.specifiers[1].importKind?.value).toBe('enum');
    });

    test('should parse use with alias', () => {
      const { ast } = parse(`use { table users as u } from './schema'`).getValue();
      const spec = (ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
      expect(spec.asKeyword?.value).toBe('as');
      expect(spec.alias).toBeDefined();
    });
  });

  describe('wildcard use', () => {
    test('should parse use * from path', () => {
      const { ast } = parse(`use * from './common'`).getValue();
      expect(ast.uses).toHaveLength(1);

      const use = ast.uses[0];
      expect(use.specifiers).toBeInstanceOf(WildcardNode);
      expect(use.importPath?.value).toBe('./common');
    });
  });

  describe('reuse', () => {
    test('should parse reuse with selective specifiers', () => {
      const { ast } = parse(`reuse { table users } from './schema'`).getValue();
      const use = ast.uses[0];
      expect(use.isReuse).toBe(true);
      expect(use.useKeyword?.value).toBe('reuse');
    });

    test('should parse reuse * from path', () => {
      const { ast } = parse(`reuse * from './common'`).getValue();
      const use = ast.uses[0];
      expect(use.isReuse).toBe(true);
      expect(use.specifiers).toBeInstanceOf(WildcardNode);
    });
  });

  describe('mixed with element declarations', () => {
    test('should parse use alongside tables', () => {
      const { ast } = parse(`
        use { table users } from './schema'
        Table posts { id int }
      `).getValue();
      expect(ast.uses).toHaveLength(1);
      expect(ast.declarations).toHaveLength(1);
      expect(ast.body).toHaveLength(2);
    });

    test('should parse multiple use declarations', () => {
      const { ast } = parse(`
        use { table users } from './schema'
        use * from './common'
        reuse { enum status } from './types'
      `).getValue();
      expect(ast.uses).toHaveLength(3);
      expect(ast.uses[0].isReuse).toBe(false);
      expect(ast.uses[1].specifiers).toBeInstanceOf(WildcardNode);
      expect(ast.uses[2].isReuse).toBe(true);
    });
  });

  describe('schema-qualified specifiers', () => {
    test('should parse use with schema-qualified name', () => {
      const { ast } = parse(`use { table auth.users } from './schema'`).getValue();
      const spec = (ast.uses[0].specifiers as UseSpecifierListNode).specifiers[0];
      expect(spec.name).toBeInstanceOf(InfixExpressionNode);
    });
  });
});
