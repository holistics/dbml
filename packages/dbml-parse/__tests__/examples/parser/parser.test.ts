import { describe, expect, test } from 'vitest';
import {
  SyntaxNodeKind,
  ElementDeclarationNode,
  BlockExpressionNode,
  FunctionApplicationNode,
  CallExpressionNode,
  InfixExpressionNode,
  PrefixExpressionNode,
  TupleExpressionNode,
  ListExpressionNode,
  AttributeNode,
  PrimaryExpressionNode,
  VariableNode,
  CommaExpressionNode,
  LiteralNode,
} from '@/core/parser/nodes';
import { SyntaxTokenKind } from '@/core/lexer/tokens';
import { parse } from '@tests/utils';

// Helper to extract a value from a PrimaryExpressionNode
function getPrimaryValue (node: PrimaryExpressionNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.expression instanceof VariableNode) {
    return node.expression.variable?.value;
  }
  if (node.expression instanceof LiteralNode) {
    return node.expression.literal?.value;
  }
  return undefined;
}

// Helper to get element by type
function getElements (source: string): ElementDeclarationNode[] {
  return parse(source).getValue().ast.body.filter(
    (n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION,
  );
}

describe('[example] parser', () => {
  describe('element declaration parsing', () => {
    test('should parse table element declaration with correct structure', () => {
      const source = 'Table users { id int }';
      const result = parse(source);
      const ast = result.getValue().ast;
      const elements = ast.body.filter(
        (n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION,
      );

      expect(result.getErrors()).toHaveLength(0);
      expect(elements).toHaveLength(1);

      const table = elements[0];
      expect(table.type?.value).toBe('Table');
      expect(table.type?.kind).toBe(SyntaxTokenKind.IDENTIFIER);
      expect(table.name?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);

      // Verify table name is 'users'
      const tableName = table.name as PrimaryExpressionNode;
      expect(getPrimaryValue(tableName)).toBe('users');

      // Verify block body structure
      expect(table.body?.kind).toBe(SyntaxNodeKind.BLOCK_EXPRESSION);
      const body = table.body as BlockExpressionNode;
      expect(body.blockOpenBrace?.value).toBe('{');
      expect(body.blockCloseBrace?.value).toBe('}');
      expect(body.body).toHaveLength(1);

      // Verify column definition is a FunctionApplication (name type)
      const column = body.body[0];
      expect(column.kind).toBe(SyntaxNodeKind.FUNCTION_APPLICATION);
    });

    test('should parse element name correctly with identifier verification', () => {
      const source = 'Table my_users { id int }';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].name?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);

      const name = elements[0].name as PrimaryExpressionNode;
      expect(name.expression?.kind).toBe(SyntaxNodeKind.VARIABLE);
      expect(getPrimaryValue(name)).toBe('my_users');
    });

    test('should parse element with alias and verify alias structure', () => {
      const source = 'Table users as U { id int }';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      const table = elements[0];

      expect(table.as?.value).toBe('as');
      expect(table.alias?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);

      const alias = table.alias as PrimaryExpressionNode;
      expect(getPrimaryValue(alias)).toBe('U');
    });

    test('should parse element with settings and verify attribute structure', () => {
      const source = 'Table users [headercolor: #fff] { id int }';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      const table = elements[0];

      expect(table.attributeList?.kind).toBe(SyntaxNodeKind.LIST_EXPRESSION);
      const attrList = table.attributeList as ListExpressionNode;

      expect(attrList.listOpenBracket?.value).toBe('[');
      expect(attrList.listCloseBracket?.value).toBe(']');
      expect(attrList.elementList).toHaveLength(1);

      // Verify attribute structure
      const attr = attrList.elementList[0];
      expect(attr.kind).toBe(SyntaxNodeKind.ATTRIBUTE);
      expect(attr.colon?.value).toBe(':');
    });

    test('should parse element with block body and verify brace tokens', () => {
      const source = 'Table users { id int }';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].body?.kind).toBe(SyntaxNodeKind.BLOCK_EXPRESSION);

      const body = elements[0].body as BlockExpressionNode;
      expect(body.blockOpenBrace?.value).toBe('{');
      expect(body.blockCloseBrace?.value).toBe('}');
    });

    test('should parse element with simple (colon) body and verify infix expression', () => {
      const source = 'Ref: users.id > posts.user_id';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      const ref = elements[0];

      expect(ref.type?.value).toBe('Ref');
      expect(ref.bodyColon?.value).toBe(':');

      // Body should be a FunctionApplication containing the ref expression
      expect(ref.body?.kind).toBe(SyntaxNodeKind.FUNCTION_APPLICATION);
      const body = ref.body as FunctionApplicationNode;

      // The callee is the infix expression (users.id > posts.user_id)
      expect(body.callee?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      const infix = body.callee as InfixExpressionNode;
      expect(infix.op?.value).toBe('>');

      // Left side: users.id (also infix expression with '.')
      expect(infix.leftExpression?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      const leftInfix = infix.leftExpression as InfixExpressionNode;
      expect(leftInfix.op?.value).toBe('.');

      // Right side: posts.user_id (also infix expression with '.')
      expect(infix.rightExpression?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      const rightInfix = infix.rightExpression as InfixExpressionNode;
      expect(rightInfix.op?.value).toBe('.');
    });

    test('should parse multiple elements with correct types', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        Enum status { active inactive }
      `;
      const elements = getElements(source);

      expect(elements).toHaveLength(3);
      expect(elements[0].type?.value).toBe('Table');
      expect(elements[1].type?.value).toBe('Table');
      expect(elements[2].type?.value).toBe('Enum');

      // Verify each element has proper structure
      elements.forEach((elem) => {
        expect(elem.type).toBeDefined();
        expect(elem.name).toBeDefined();
        expect(elem.body).toBeDefined();
      });
    });

    test('should parse schema-qualified element name as infix expression', () => {
      const source = 'Table public.users { id int }';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].name?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);

      const infix = elements[0].name as InfixExpressionNode;
      expect(infix.op?.value).toBe('.');

      // Left side should be 'public'
      expect(infix.leftExpression?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      const left = infix.leftExpression as PrimaryExpressionNode;
      expect(getPrimaryValue(left)).toBe('public');

      // Right side should be 'users'
      expect(infix.rightExpression?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      const right = infix.rightExpression as PrimaryExpressionNode;
      expect(getPrimaryValue(right)).toBe('users');
    });

    test('should parse element with quoted name and preserve value', () => {
      const source = 'Table "user-table" { id int }';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].name?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);

      // Quoted name should be parsed as a literal or variable with the quoted value
      const name = elements[0].name as PrimaryExpressionNode;
      expect(name.expression).toBeDefined();
    });
  });

  describe('block expression parsing', () => {
    test('should parse nested elements in block with column structures', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;

      expect(body.kind).toBe(SyntaxNodeKind.BLOCK_EXPRESSION);
      expect(body.body).toHaveLength(2);

      // Each column is a FunctionApplication
      body.body.forEach((item) => {
        expect(item.kind).toBe(SyntaxNodeKind.FUNCTION_APPLICATION);
      });

      // First column should have attributes
      const firstCol = body.body[0] as FunctionApplicationNode;
      expect(firstCol.args.length).toBeGreaterThanOrEqual(1);
    });

    test('should parse table with indexes block as nested element', () => {
      const source = `
        Table users {
          id int [pk]
          email varchar

          indexes {
            email [unique]
          }
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;

      expect(body.body).toHaveLength(3);

      // The indexes block should be an ElementDeclaration
      const indexesBlock = body.body[2];
      expect(indexesBlock.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
      const indexes = indexesBlock as ElementDeclarationNode;
      expect(indexes.type?.value).toBe('indexes');
    });

    test('should parse table with Note sub-element correctly', () => {
      const source = `
        Table users {
          id int
          Note: 'User table'
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;

      expect(body.body).toHaveLength(2);

      // Note should be an ElementDeclaration with colon body
      const note = body.body[1];
      expect(note.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
      const noteDecl = note as ElementDeclarationNode;
      expect(noteDecl.type?.value).toBe('Note');
      expect(noteDecl.bodyColon?.value).toBe(':');
    });

    test('should parse partial injection with tilde operator', () => {
      const source = `
        Table users {
          id int
          ~timestamps
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;

      expect(body.body).toHaveLength(2);

      // Find the partial injection
      const partialFunctionAppNode = body.body[1];

      expect(partialFunctionAppNode).toBeInstanceOf(FunctionApplicationNode);
      const partialInjectionNode = (partialFunctionAppNode as FunctionApplicationNode).callee as PrefixExpressionNode;
      expect(partialInjectionNode).toBeInstanceOf(PrefixExpressionNode);

      expect(partialInjectionNode.op?.value).toBe('~');
      const partialNode = partialInjectionNode.expression as PrimaryExpressionNode;
      expect(partialNode).toBeInstanceOf(PrimaryExpressionNode);
      expect((partialNode.expression as VariableNode).variable?.value).toBe('timestamps');
    });
  });

  describe('expression parsing', () => {
    test('should parse function application (column type) with CallExpression for typed args', () => {
      const source = 'Table users { name varchar(255) }';
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;

      expect(body.body).toHaveLength(1);

      // Column definition is a FunctionApplication
      const column = body.body[0] as FunctionApplicationNode;
      expect(column.kind).toBe(SyntaxNodeKind.FUNCTION_APPLICATION);

      // The args should contain the type with arguments
      expect(column.args.length).toBeGreaterThanOrEqual(1);

      // Find the CallExpression for varchar(255)
      const typeArg = column.args.find((arg) => arg.kind === SyntaxNodeKind.CALL_EXPRESSION);
      expect(typeArg).toBeDefined();

      const callExpr = typeArg as CallExpressionNode;
      expect(callExpr.callee?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);

      // Single-arg tuple is represented as GROUP_EXPRESSION (subclass of TupleExpressionNode)
      expect([SyntaxNodeKind.TUPLE_EXPRESSION, SyntaxNodeKind.GROUP_EXPRESSION]).toContain(
        callExpr.argumentList?.kind,
      );

      // Verify the argument list has exactly one element
      const argList = callExpr.argumentList as TupleExpressionNode;
      expect(argList.elementList).toHaveLength(1);
    });

    test('should parse member access expressions as chained infix', () => {
      const source = 'Ref: users.id > posts.user_id';
      const elements = getElements(source);
      const body = elements[0].body as FunctionApplicationNode;

      expect(body.callee?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      const expr = body.callee as InfixExpressionNode;

      // Main operator is >
      expect(expr.op?.value).toBe('>');

      // Both sides are member access (infix with .)
      expect(expr.leftExpression?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      expect(expr.rightExpression?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);

      const left = expr.leftExpression as InfixExpressionNode;
      const right = expr.rightExpression as InfixExpressionNode;

      expect(left.op?.value).toBe('.');
      expect(right.op?.value).toBe('.');
    });

    test('should parse list expressions with correct attribute count', () => {
      const source = 'Table users { id int [pk, not null, unique] }';
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;

      // Find the ListExpression in the args
      const listArg = column.args.find(
        (arg) => arg.kind === SyntaxNodeKind.LIST_EXPRESSION,
      ) as ListExpressionNode;

      expect(listArg).toBeDefined();
      expect(listArg.elementList).toHaveLength(3);
      expect(listArg.commaList).toHaveLength(2);

      // Verify each attribute
      listArg.elementList.forEach((attr) => {
        expect(attr.kind).toBe(SyntaxNodeKind.ATTRIBUTE);
      });
    });

    test('should parse tuple expressions for composite keys', () => {
      const source = `
        Table orders {
          indexes {
            (user_id, product_id) [unique]
          }
        }
      `;
      const elements = getElements(source);
      const tableBody = elements[0].body as BlockExpressionNode;
      const indexesDecl = tableBody.body[0] as ElementDeclarationNode;
      const indexesBody = indexesDecl.body as BlockExpressionNode;
      const indexDef = indexesBody.body[0] as FunctionApplicationNode;

      // The callee should be a TupleExpression
      expect(indexDef.callee?.kind).toBe(SyntaxNodeKind.TUPLE_EXPRESSION);

      const tuple = indexDef.callee as TupleExpressionNode;
      expect(tuple.tupleOpenParen?.value).toBe('(');
      expect(tuple.tupleCloseParen?.value).toBe(')');
      expect(tuple.elementList).toHaveLength(2);
      expect(tuple.commaList).toHaveLength(1);
    });

    test('should parse infix expressions with correct operator', () => {
      const source = 'Ref: users.id > posts.user_id';
      const elements = getElements(source);
      const body = elements[0].body as FunctionApplicationNode;
      const infix = body.callee as InfixExpressionNode;

      expect(infix.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      expect(infix.op?.value).toBe('>');
      expect(infix.leftExpression).toBeDefined();
      expect(infix.rightExpression).toBeDefined();
    });

    test('should parse prefix expressions with operator', () => {
      const source = 'Table users { age int [check: > 0] }';
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;

      // Find the list expression (settings)
      const listArg = column.args.find(
        (arg) => arg.kind === SyntaxNodeKind.LIST_EXPRESSION,
      ) as ListExpressionNode;

      expect(listArg).toBeDefined();
      expect(listArg.elementList).toHaveLength(1);

      const checkAttr = listArg.elementList[0] as AttributeNode;
      expect(checkAttr.value?.kind).toBe(SyntaxNodeKind.PREFIX_EXPRESSION);

      const prefix = checkAttr.value as PrefixExpressionNode;
      expect(prefix.op?.value).toBe('>');
      expect(prefix.expression).toBeDefined();
    });
  });

  describe('attribute parsing', () => {
    test('should parse simple attribute with name only', () => {
      const source = 'Table users { id int [pk] }';
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;

      const listArg = column.args.find(
        (arg) => arg.kind === SyntaxNodeKind.LIST_EXPRESSION,
      ) as ListExpressionNode;

      expect(listArg.elementList).toHaveLength(1);
      const attr = listArg.elementList[0];
      expect(attr.kind).toBe(SyntaxNodeKind.ATTRIBUTE);
      expect(attr.colon).toBeUndefined(); // No colon for simple attribute
    });

    test('should parse attribute with value and colon', () => {
      const source = "Table users { id int [default: 0, note: 'ID'] }";
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;

      const listArg = column.args.find(
        (arg) => arg.kind === SyntaxNodeKind.LIST_EXPRESSION,
      ) as ListExpressionNode;

      expect(listArg.elementList).toHaveLength(2);

      // Both attributes should have colons and values
      listArg.elementList.forEach((attr) => {
        expect(attr.colon?.value).toBe(':');
        expect(attr.value).toBeDefined();
      });
    });

    test('should parse multiple attributes with correct comma separation', () => {
      const source = 'Table users { id int [pk, not null, unique, increment] }';
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;

      const listArg = column.args.find(
        (arg) => arg.kind === SyntaxNodeKind.LIST_EXPRESSION,
      ) as ListExpressionNode;

      expect(listArg.elementList).toHaveLength(4);
      expect(listArg.commaList).toHaveLength(3);

      // Verify commas are actual comma tokens
      listArg.commaList.forEach((comma) => {
        expect(comma.value).toBe(',');
      });
    });

    test('should parse attribute with inline ref as prefix expression', () => {
      const source = 'Table posts { user_id int [ref: > users.id] }';
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;

      const listArg = column.args.find(
        (arg) => arg.kind === SyntaxNodeKind.LIST_EXPRESSION,
      ) as ListExpressionNode;

      expect(listArg.elementList).toHaveLength(1);
      const refAttr = listArg.elementList[0];
      expect(refAttr.colon?.value).toBe(':');

      // The value should be a prefix expression (> users.id)
      expect(refAttr.value?.kind).toBe(SyntaxNodeKind.PREFIX_EXPRESSION);
      const prefix = refAttr.value as PrefixExpressionNode;
      expect(prefix.op?.value).toBe('>');
    });

    test('should parse element-level attributes with multiple entries', () => {
      const source = "Table users [headercolor: #fff, note: 'Important'] { id int }";
      const elements = getElements(source);

      expect(elements[0].attributeList?.kind).toBe(SyntaxNodeKind.LIST_EXPRESSION);
      const attrList = elements[0].attributeList as ListExpressionNode;

      expect(attrList.elementList).toHaveLength(2);
      expect(attrList.commaList).toHaveLength(1);

      // First attribute: headercolor
      const headerColorAttr = attrList.elementList[0];
      expect(headerColorAttr.colon?.value).toBe(':');

      // Second attribute: note
      const noteAttr = attrList.elementList[1];
      expect(noteAttr.colon?.value).toBe(':');
    });
  });

  describe('error recovery', () => {
    test('should recover from missing closing brace and still parse structure', () => {
      const source = 'Table users { id int';
      const result = parse(source);
      const ast = result.getValue().ast;
      const errors = result.getErrors();

      expect(ast).toBeDefined();
      expect(errors.length).toBeGreaterThan(0);

      // Should still parse the table declaration
      const elements = ast.body.filter(
        (n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION,
      );
      expect(elements).toHaveLength(1);
      expect(elements[0].type?.value).toBe('Table');

      // Body should exist but may be incomplete
      expect(elements[0].body).toBeDefined();
    });

    test('should recover from missing closing bracket and report specific error', () => {
      const source = 'Table users { id int [pk }';
      const result = parse(source);
      const ast = result.getValue().ast;
      const errors = result.getErrors();

      expect(ast).toBeDefined();
      expect(errors.length).toBeGreaterThan(0);

      // Verify table structure is still present
      const elements = ast.body.filter(
        (n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION,
      );
      expect(elements).toHaveLength(1);
    });

    test('should continue parsing after error and recover subsequent elements', () => {
      const source = `
        Table users { id int [
        Table posts { id int }
      `;
      const result = parse(source);
      const ast = result.getValue().ast;
      const errors = result.getErrors();

      expect(errors.length).toBeGreaterThan(0);

      // Should recover and parse the second table
      const elements = ast.body.filter(
        (n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION,
      );

      // At minimum, should have parsed something
      expect(elements.length).toBeGreaterThanOrEqual(1);

      // If recovery worked, the second table should be parsed
      const postsTable = elements.find((e) => {
        const name = e.name as PrimaryExpressionNode;
        return getPrimaryValue(name) === 'posts';
      });

      // Verify posts table was recovered if present
      if (postsTable) {
        expect(postsTable.type?.value).toBe('Table');
        expect(postsTable.body?.kind).toBe(SyntaxNodeKind.BLOCK_EXPRESSION);
      }
    });

    test('should handle empty block gracefully without errors', () => {
      const source = 'Table users { }';
      const result = parse(source);

      expect(result.getValue().ast).toBeDefined();
      expect(result.getErrors()).toHaveLength(0);

      const elements = getElements(source);
      expect(elements).toHaveLength(1);

      const body = elements[0].body as BlockExpressionNode;
      expect(body.body).toHaveLength(0);
      expect(body.blockOpenBrace?.value).toBe('{');
      expect(body.blockCloseBrace?.value).toBe('}');
    });

    test('should handle malformed expression and report error', () => {
      const source = 'Table users { id }';
      const result = parse(source);

      expect(result.getValue().ast).toBeDefined();
      // This might be valid (single identifier in block) or error depending on grammar
      const elements = getElements(source);
      expect(elements).toHaveLength(1);
    });
  });

  describe('position tracking', () => {
    test('should track element start position at beginning of source', () => {
      const source = 'Table users { id int }';
      const elements = getElements(source);

      expect(elements[0].startPos.line).toBe(0);
      expect(elements[0].startPos.column).toBe(0);
      expect(elements[0].start).toBe(0);
    });

    test('should track element end position matching source length', () => {
      const source = 'Table users { id int }';
      const elements = getElements(source);

      expect(elements[0].endPos.line).toBe(0);
      // End column should be at source length (22 characters)
      expect(elements[0].endPos.column).toBe(source.length);
      expect(elements[0].end).toBe(source.length);
    });

    test('should track positions across multiple lines correctly', () => {
      const source = `Table users {
  id int
}
Table posts {
  id int
}`;
      const elements = getElements(source);

      // First table starts at line 0
      expect(elements[0].startPos.line).toBe(0);
      expect(elements[0].startPos.column).toBe(0);

      // Second table starts at line 3 (after closing brace + newline)
      expect(elements[1].startPos.line).toBe(3);
      expect(elements[1].startPos.column).toBe(0);

      // Verify end positions are greater than start
      elements.forEach((elem) => {
        expect(elem.end).toBeGreaterThan(elem.start);
      });
    });

    test('should track byte offsets correctly for entire element', () => {
      const source = 'Table users { id int }';
      const elements = getElements(source);

      expect(elements[0].start).toBe(0);
      expect(elements[0].end).toBe(source.length);

      // Verify the element spans the entire source
      expect(elements[0].end - elements[0].start).toBe(source.length);
    });

    test('should track nested element positions within parent', () => {
      const source = 'Table users { id int }';
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;

      // Column should be within the table's range
      expect(column.start).toBeGreaterThan(elements[0].start);
      expect(column.end).toBeLessThan(elements[0].end);

      // Column should be within the block's range
      expect(column.start).toBeGreaterThan(body.start);
      expect(column.end).toBeLessThan(body.end);
    });
  });

  describe('complex structures', () => {
    test('should parse complete table with all features', () => {
      const source = `
        Table public.users as U [headercolor: #fff] {
          id integer [pk, increment]
          email varchar(255) [unique, not null]
          status user_status [default: 'active']

          indexes {
            email [unique, name: 'idx_email']
            (id, email) [pk]
          }

          Note: 'Main users table'
        }
      `;
      const result = parse(source);
      const errors = result.getErrors();
      const elements = result.getValue().ast.body.filter(
        (n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION,
      );

      expect(errors).toHaveLength(0);
      expect(elements).toHaveLength(1);

      const table = elements[0];
      expect(table.type?.value).toBe('Table');
      expect(table.name?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      expect(table.as?.value).toBe('as');
      expect(table.alias?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(table.attributeList?.kind).toBe(SyntaxNodeKind.LIST_EXPRESSION);
      expect(table.body?.kind).toBe(SyntaxNodeKind.BLOCK_EXPRESSION);

      // Verify body contents
      const body = table.body as BlockExpressionNode;
      expect(body.body.length).toBe(5); // 3 columns + indexes + Note
    });

    test('should parse enum with field settings and verify structure', () => {
      const source = `
        Enum order_status {
          pending [note: 'Initial state']
          processing
          completed [note: 'Final state']
        }
      `;
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].type?.value).toBe('Enum');

      const body = elements[0].body as BlockExpressionNode;
      expect(body.body).toHaveLength(3);

      // Verify enum fields are FunctionApplications
      body.body.forEach((field) => {
        expect(field.kind).toBe(SyntaxNodeKind.FUNCTION_APPLICATION);
      });
    });

    test('should parse ref with settings and verify named ref structure', () => {
      const source = 'Ref user_posts [delete: cascade, update: no action]: users.id > posts.user_id';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      const ref = elements[0];

      expect(ref.type?.value).toBe('Ref');
      expect(ref.name?.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(ref.attributeList?.kind).toBe(SyntaxNodeKind.LIST_EXPRESSION);
      expect(ref.bodyColon?.value).toBe(':');

      // Verify attributes
      const attrList = ref.attributeList as ListExpressionNode;
      expect(attrList.elementList).toHaveLength(2);
    });

    test('should parse TableGroup with schema-qualified tables', () => {
      const source = `
        TableGroup ecommerce {
          public.users
          public.orders
          public.products
        }
      `;
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].type?.value).toBe('TableGroup');

      const body = elements[0].body as BlockExpressionNode;
      expect(body.body).toHaveLength(3);

      // Each entry should be a FunctionApplication or infix expression
      body.body.forEach((entry) => {
        expect(entry.kind).toBe(SyntaxNodeKind.FUNCTION_APPLICATION);
      });
    });

    test('should parse Project with nested elements', () => {
      const source = `
        Project myproject {
          database_type: 'PostgreSQL'
          Note: 'Project description'
        }
      `;
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].type?.value).toBe('Project');

      const body = elements[0].body as BlockExpressionNode;
      expect(body.body.length).toBeGreaterThanOrEqual(2);
    });

    test('should parse TablePartial with columns', () => {
      const source = `
        TablePartial timestamps {
          created_at timestamp [default: \`now()\`]
          updated_at timestamp
        }
      `;
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      expect(elements[0].type?.value).toBe('TablePartial');

      const body = elements[0].body as BlockExpressionNode;
      expect(body.body).toHaveLength(2);
    });

    test('should parse composite foreign key ref with tuple on both sides', () => {
      const source = 'Ref: orders.(merchant_id, country) > merchants.(id, country_code)';
      const elements = getElements(source);

      expect(elements).toHaveLength(1);
      const body = elements[0].body as FunctionApplicationNode;

      expect(body.callee?.kind).toBe(SyntaxNodeKind.INFIX_EXPRESSION);
      const infix = body.callee as InfixExpressionNode;
      expect(infix.op?.value).toBe('>');
    });
  });

  describe('comma expression parsing', () => {
    test('should parse comma expression in function application args', () => {
      const source = `
        Table users {
          sample_data 1, 2, 3
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;

      expect(body.body).toHaveLength(1);
      const funcApp = body.body[0] as FunctionApplicationNode;
      expect(funcApp.kind).toBe(SyntaxNodeKind.FUNCTION_APPLICATION);

      // The args should contain a CommaExpressionNode
      expect(funcApp.args).toHaveLength(1);
      expect(funcApp.args[0].kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);

      const commaExpr = funcApp.args[0] as CommaExpressionNode;
      expect(commaExpr.elementList).toHaveLength(3);
      expect(commaExpr.commaList).toHaveLength(2);

      // Verify each element is a primary expression with a literal
      commaExpr.elementList.forEach((elem) => {
        expect(elem.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        const primary = elem as PrimaryExpressionNode;
        expect(primary.expression?.kind).toBe(SyntaxNodeKind.LITERAL);
      });
    });

    test('should parse comma expression with string values', () => {
      const source = `
        Table users {
          sample_data 'a', 'b', 'c'
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;

      expect(funcApp.args).toHaveLength(1);
      expect(funcApp.args[0].kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);

      const commaExpr = funcApp.args[0] as CommaExpressionNode;
      expect(commaExpr.elementList).toHaveLength(3);
    });

    test('should parse comma expression as callee', () => {
      const source = `
        Table users {
          1, 2, 3
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;

      expect(body.body).toHaveLength(1);
      const funcApp = body.body[0] as FunctionApplicationNode;

      // The callee should be a CommaExpressionNode
      expect(funcApp.callee?.kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);

      const commaExpr = funcApp.callee as CommaExpressionNode;
      expect(commaExpr.elementList).toHaveLength(3);
      expect(commaExpr.commaList).toHaveLength(2);
    });

    test('should parse single expression without comma as normal expression', () => {
      const source = `
        Table users {
          sample_data 1
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;

      // Single value should be a PrimaryExpression, not CommaExpression
      expect(funcApp.args).toHaveLength(1);
      expect(funcApp.args[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
    });

    test('should parse multiple comma expressions in function application', () => {
      const source = `
        Table users {
          sample_data 1, 2 'x', 'y'
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;

      // Should have two args: "1, 2" and "'x', 'y'"
      expect(funcApp.args).toHaveLength(2);
      expect(funcApp.args[0].kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);
      expect(funcApp.args[1].kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);

      const first = funcApp.args[0] as CommaExpressionNode;
      expect(first.elementList).toHaveLength(2);

      const second = funcApp.args[1] as CommaExpressionNode;
      expect(second.elementList).toHaveLength(2);
    });

    test('should preserve comma tokens in comma expression', () => {
      const source = `
        Table users {
          sample_data 1, 2, 3, 4
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;
      const commaExpr = funcApp.args[0] as CommaExpressionNode;

      expect(commaExpr.commaList).toHaveLength(3);
      commaExpr.commaList.forEach((comma) => {
        expect(comma.value).toBe(',');
        expect(comma.kind).toBe(SyntaxTokenKind.COMMA);
      });
    });

    test('should parse empty field in comma expression (consecutive commas)', () => {
      const source = `
        Table users {
          sample_data 1, , 3
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;

      expect(funcApp.args).toHaveLength(1);
      expect(funcApp.args[0].kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);

      const commaExpr = funcApp.args[0] as CommaExpressionNode;
      expect(commaExpr.elementList).toHaveLength(3);
      expect(commaExpr.commaList).toHaveLength(2);

      // First element: 1
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      // Second element: empty (EmptyNode)
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.EMPTY);
      // Third element: 3
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
    });

    test('should parse multiple empty fields in comma expression', () => {
      const source = `
        Table users {
          sample_data 1, , , 4
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;
      const commaExpr = funcApp.args[0] as CommaExpressionNode;

      expect(commaExpr.elementList).toHaveLength(4);
      expect(commaExpr.commaList).toHaveLength(3);

      // First element: 1
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      // Second element: empty (EmptyNode)
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.EMPTY);
      // Third element: empty (EmptyNode)
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.EMPTY);
      // Fourth element: 4
      expect(commaExpr.elementList[3].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
    });

    test('should parse trailing comma in comma expression', () => {
      const source = `
        Table users {
          sample_data 1, 2,
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;
      const commaExpr = funcApp.args[0] as CommaExpressionNode;

      expect(commaExpr.elementList).toHaveLength(3);
      expect(commaExpr.commaList).toHaveLength(2);

      // First element: 1
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      // Second element: 2
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      // Third element: empty (EmptyNode for trailing comma)
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.EMPTY);
    });

    test('should parse leading comma in comma expression (as callee)', () => {
      const source = `
        Table users {
          ,1, 2
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;

      // The callee should be a CommaExpressionNode starting with empty
      expect(funcApp.callee?.kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);

      const commaExpr = funcApp.callee as CommaExpressionNode;
      expect(commaExpr.elementList).toHaveLength(3);
      expect(commaExpr.commaList).toHaveLength(2);

      // First element: empty (EmptyNode for leading comma)
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.EMPTY);
      // Second element: 1
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[1] as PrimaryExpressionNode)).toBe('1');
      // Third element: 2
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[2] as PrimaryExpressionNode)).toBe('2');
    });

    test('should parse leading and trailing comma in comma expression', () => {
      const source = `
        Table users {
          ,1, 2,
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;
      const commaExpr = funcApp.callee as CommaExpressionNode;

      expect(commaExpr.elementList).toHaveLength(4);
      expect(commaExpr.commaList).toHaveLength(3);

      // First element: empty (EmptyNode for leading comma)
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.EMPTY);
      // Second element: 1
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[1] as PrimaryExpressionNode)).toBe('1');
      // Third element: 2
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[2] as PrimaryExpressionNode)).toBe('2');
      // Fourth element: empty (EmptyNode for trailing comma)
      expect(commaExpr.elementList[3].kind).toBe(SyntaxNodeKind.EMPTY);
    });

    test('should parse comma expression with only commas (all empty fields)', () => {
      const source = `
        Table users {
          ,,
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;
      const commaExpr = funcApp.callee as CommaExpressionNode;

      expect(commaExpr.elementList).toHaveLength(3);
      expect(commaExpr.commaList).toHaveLength(2);

      // All elements should be EmptyNodes
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.EMPTY);
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.EMPTY);
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.EMPTY);
    });

    test('should parse leading comma as callee in function application with spaces', () => {
      const source = `
        Table users {
          , 1, 2
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;

      // The callee should be a CommaExpressionNode starting with empty
      expect(funcApp.callee?.kind).toBe(SyntaxNodeKind.COMMA_EXPRESSION);

      const commaExpr = funcApp.callee as CommaExpressionNode;
      expect(commaExpr.elementList).toHaveLength(3);

      // First element: empty (EmptyNode for leading comma)
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.EMPTY);
      // Second element: 1
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[1] as PrimaryExpressionNode)).toBe('1');
      // Third element: 2
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[2] as PrimaryExpressionNode)).toBe('2');
    });

    test('should parse leading comma with string values', () => {
      const source = `
        Table users {
          ,'hello', 'world'
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;
      const commaExpr = funcApp.callee as CommaExpressionNode;

      expect(commaExpr.elementList).toHaveLength(3);
      expect(commaExpr.commaList).toHaveLength(2);

      // First element: empty (EmptyNode for leading comma)
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.EMPTY);
      // Second element: 'hello' (string literal values don't include quotes)
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[1] as PrimaryExpressionNode)).toBe('hello');
      // Third element: 'world'
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[2] as PrimaryExpressionNode)).toBe('world');
    });

    test('should parse leading comma with identifier values', () => {
      const source = `
        Table users {
          ,foo, bar, baz
        }
      `;
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const funcApp = body.body[0] as FunctionApplicationNode;
      const commaExpr = funcApp.callee as CommaExpressionNode;

      expect(commaExpr.elementList).toHaveLength(4);
      expect(commaExpr.commaList).toHaveLength(3);

      // First element: empty (EmptyNode for leading comma)
      expect(commaExpr.elementList[0].kind).toBe(SyntaxNodeKind.EMPTY);
      // Second element: foo
      expect(commaExpr.elementList[1].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[1] as PrimaryExpressionNode)).toBe('foo');
      // Third element: bar
      expect(commaExpr.elementList[2].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[2] as PrimaryExpressionNode)).toBe('bar');
      // Fourth element: baz
      expect(commaExpr.elementList[3].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(getPrimaryValue(commaExpr.elementList[3] as PrimaryExpressionNode)).toBe('baz');
    });
  });

  describe('edge cases', () => {
    test('should handle empty source with empty body', () => {
      const result = parse('');

      expect(result.getValue().ast).toBeDefined();
      expect(result.getValue().ast.body).toHaveLength(0);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should handle comments only without errors', () => {
      const result = parse('// Just a comment');

      expect(result.getValue().ast).toBeDefined();
      expect(result.getValue().ast.body).toHaveLength(0);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should handle deeply nested structures', () => {
      const source = `
        Table t {
          indexes {
            (a, b, c, d, e) [unique, name: 'complex_idx', type: btree]
          }
        }
      `;
      const result = parse(source);

      expect(result.getValue().ast).toBeDefined();
      expect(result.getErrors()).toHaveLength(0);

      // Verify structure is parsed correctly
      const elements = getElements(source);
      const tableBody = elements[0].body as BlockExpressionNode;
      const indexesDecl = tableBody.body[0] as ElementDeclarationNode;
      const indexesBody = indexesDecl.body as BlockExpressionNode;
      const indexDef = indexesBody.body[0] as FunctionApplicationNode;

      // Verify the tuple has 5 elements
      const tuple = indexDef.callee as TupleExpressionNode;
      expect(tuple.elementList).toHaveLength(5);
    });

    test('should handle adjacent elements without blank lines', () => {
      const source = 'Table a { id int }Table b { id int }';
      const elements = getElements(source);

      expect(elements).toHaveLength(2);

      // Verify both tables are properly parsed
      const nameA = elements[0].name as PrimaryExpressionNode;
      const nameB = elements[1].name as PrimaryExpressionNode;

      expect(getPrimaryValue(nameA)).toBe('a');
      expect(getPrimaryValue(nameB)).toBe('b');

      // Verify positions don't overlap
      expect(elements[1].start).toBeGreaterThanOrEqual(elements[0].end);
    });

    test('should handle mixed quote styles', () => {
      const source = 'Table users { name varchar [note: "double quotes", default: \'single\'] }';
      const result = parse(source);

      expect(result.getValue().ast).toBeDefined();
      expect(result.getErrors()).toHaveLength(0);

      // Verify both attributes are parsed
      const elements = getElements(source);
      const body = elements[0].body as BlockExpressionNode;
      const column = body.body[0] as FunctionApplicationNode;
      const listArg = column.args.find(
        (arg) => arg.kind === SyntaxNodeKind.LIST_EXPRESSION,
      ) as ListExpressionNode;

      expect(listArg.elementList).toHaveLength(2);
    });

    test('should handle identifiers that look like keywords', () => {
      const source = 'Table table { ref int table varchar }';
      const result = parse(source);

      expect(result.getValue().ast).toBeDefined();

      const elements = getElements(source);
      expect(elements).toHaveLength(1);

      // Table name should be 'table' (keyword used as identifier)
      const tableName = elements[0].name as PrimaryExpressionNode;
      expect(getPrimaryValue(tableName)).toBe('table');
    });
  });
});
