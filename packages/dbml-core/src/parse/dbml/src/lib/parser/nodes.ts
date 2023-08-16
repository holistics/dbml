import { CompileError } from 'lib/errors';
import { findEnd, last } from '../utils';
import { SyntaxToken } from '../lexer/tokens';
import { NodeSymbol } from '../analyzer/symbol/symbols';

export interface SyntaxNode {
  kind: SyntaxNodeKind;
  start: number;
  end: number;
  symbol?: NodeSymbol;
}

export enum SyntaxNodeKind {
  PROGRAM = '<program>',
  ELEMENT_DECLARATION = '<element-declaration>',
  ATTRIBUTE = '<attribute>',
  // A node that represents a contiguous stream of identifiers
  // Attribute name or value may use this
  // e.g [primary key] -> 'primary' 'key'
  // e.g [update: no action] -> 'no' 'action'
  IDENTIFIER_STREAM = '<identifer-stream>',
  PARTIAL_EXPRESSION = '<partial-expression>',

  LITERAL = '<literal>',
  VARIABLE = '<variable>',
  PREFIX_EXPRESSION = '<prefix-expression>',
  INFIX_EXPRESSION = '<infix-expression>',
  POSTFIX_EXPRESSION = '<postfix-expression>',
  FUNCTION_EXPRESSION = '<function-expression>',
  FUNCTION_APPLICATION = '<function-application>',
  BLOCK_EXPRESSION = '<block-expression>',
  LIST_EXPRESSION = '<list-expression>',
  TUPLE_EXPRESSION = '<tuple-expression>',
  CALL_EXPRESSION = '<call-expression>',
  PRIMARY_EXPRESSION = '<primary-expression>',
  GROUP_EXPRESSION = '<group-expression>',
  ACCESS_EXPRESSION = '<access-expression>',
}

export class ProgramNode implements SyntaxNode {
  kind: SyntaxNodeKind.PROGRAM = SyntaxNodeKind.PROGRAM;

  start: Readonly<number>;

  end: Readonly<number>;

  body: ElementDeclarationNode[];

  eof: SyntaxToken;

  invalid: (SyntaxToken | SyntaxNode)[];

  symbol?: NodeSymbol;

  constructor({
    body,
    eof,
    invalid,
  }: {
    body: ElementDeclarationNode[];
    eof: SyntaxToken;
    invalid?: (SyntaxToken | SyntaxNode)[];
  }) {
    this.start = 0;
    this.end = eof.offset;
    this.body = body;
    this.eof = eof;
    this.invalid = invalid || [];
  }
}

export class ElementDeclarationNode implements SyntaxNode {
  kind: SyntaxNodeKind.ELEMENT_DECLARATION = SyntaxNodeKind.ELEMENT_DECLARATION;

  start: Readonly<number>;

  end: Readonly<number>;

  type: SyntaxToken;

  name?: NormalExpressionNode;

  as?: SyntaxToken;

  alias?: NormalExpressionNode;

  attributeList?: ListExpressionNode;

  bodyColon?: SyntaxToken;

  body: ExpressionNode | BlockExpressionNode;

  symbol?: NodeSymbol;

  parentElement?: ElementDeclarationNode;

  constructor({
    type,
    name,
    as,
    alias,
    attributeList,
    bodyColon,
    body,
  }: {
    type: SyntaxToken;
    name?: NormalExpressionNode;
    as?: SyntaxToken;
    alias?: NormalExpressionNode;
    attributeList?: ListExpressionNode;
    bodyColon?: SyntaxToken;
    body: BlockExpressionNode | ExpressionNode;
  }) {
    this.start = type.offset;
    this.end = body.end;
    this.type = type;
    this.name = name;
    this.as = as;
    this.alias = alias;
    this.attributeList = attributeList;
    this.bodyColon = bodyColon;
    this.body = body;
  }
}

export class IdentiferStreamNode implements SyntaxNode {
  kind: SyntaxNodeKind.IDENTIFIER_STREAM = SyntaxNodeKind.IDENTIFIER_STREAM;

  start: Readonly<number>;

  end: Readonly<number>;

  identifiers: SyntaxToken[];

  constructor({ identifiers }: { identifiers: SyntaxToken[] }) {
    if (identifiers.length === 0) {
      throw new Error("An IdentifierStreamNode shouldn't be created with zero tokens");
    }
    this.identifiers = identifiers;
    this.start = this.identifiers[0].offset;
    this.end = findEnd(last(identifiers)!);
  }
}
export class AttributeNode implements SyntaxNode {
  kind: SyntaxNodeKind.ATTRIBUTE = SyntaxNodeKind.ATTRIBUTE;

  start: Readonly<number>;

  end: Readonly<number>;

  name: IdentiferStreamNode;

  colon?: SyntaxToken;

  value?: NormalExpressionNode | IdentiferStreamNode;

  symbol?: NodeSymbol;

  constructor({
    name,
    colon,
    value,
  }: {
    name: IdentiferStreamNode;
    colon?: SyntaxToken;
    value?: NormalExpressionNode | IdentiferStreamNode;
  }) {
    this.name = name;
    this.value = value;
    this.colon = colon;
    this.start = this.name.start;
    if (colon && !value) {
      throw new Error("An AttributeNode shouldn't be created with a colon but no value");
    }
    this.end = colon ? value!.end : name.end;
  }
}

// A normal form expression is the regular expression we encounter in most programming languages
// ex. 1 + 2, 1 * 2, (1 / 3) - 4, a.b
// Function application and literal element expressions are not considered one
export type NormalExpressionNode =
  | PrefixExpressionNode
  | InfixExpressionNode
  | PostfixExpressionNode
  | BlockExpressionNode
  | ListExpressionNode
  | TupleExpressionNode
  | CallExpressionNode
  | PrimaryExpressionNode
  | FunctionExpressionNode;

export type ExpressionNode =
  | ElementDeclarationNode
  | NormalExpressionNode
  | FunctionApplicationNode;

export class PrefixExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.PREFIX_EXPRESSION = SyntaxNodeKind.PREFIX_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  op: SyntaxToken;

  expression: NormalExpressionNode;

  symbol?: NodeSymbol;

  constructor({ op, expression }: { op: SyntaxToken; expression: NormalExpressionNode }) {
    this.start = op.offset;
    this.end = expression.end;
    this.op = op;
    this.expression = expression;
  }
}

export class InfixExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.INFIX_EXPRESSION = SyntaxNodeKind.INFIX_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  op: SyntaxToken;

  leftExpression: NormalExpressionNode;

  rightExpression: NormalExpressionNode;

  symbol?: NodeSymbol;

  constructor({
    op,
    leftExpression,
    rightExpression,
  }: {
    op: SyntaxToken;
    leftExpression: NormalExpressionNode;
    rightExpression: NormalExpressionNode;
  }) {
    this.start = leftExpression.start;
    this.end = rightExpression.end;
    this.op = op;
    this.leftExpression = leftExpression;
    this.rightExpression = rightExpression;
  }
}

export class PostfixExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.POSTFIX_EXPRESSION = SyntaxNodeKind.POSTFIX_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  op: SyntaxToken;

  expression: NormalExpressionNode;

  symbol?: NodeSymbol;

  constructor({ op, expression }: { op: SyntaxToken; expression: NormalExpressionNode }) {
    this.start = expression.start;
    this.end = op.offset + 1;
    this.op = op;
    this.expression = expression;
  }
}

export class FunctionExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.FUNCTION_EXPRESSION = SyntaxNodeKind.FUNCTION_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  value: SyntaxToken;

  symbol?: NodeSymbol;

  constructor({ value }: { value: SyntaxToken }) {
    this.start = value.offset;
    this.end = value.offset + value.length;
    this.value = value;
  }
}

export class FunctionApplicationNode implements SyntaxNode {
  kind: SyntaxNodeKind.FUNCTION_APPLICATION = SyntaxNodeKind.FUNCTION_APPLICATION;

  start: Readonly<number>;

  end: Readonly<number>;

  callee: ExpressionNode;

  args: ExpressionNode[];

  symbol?: NodeSymbol;

  constructor({ callee, args }: { callee: ExpressionNode; args: ExpressionNode[] }) {
    this.start = callee.start;
    if (args.length === 0) {
      this.end = callee.end;
    } else {
      this.end = args[args.length - 1].end;
    }
    this.callee = callee;
    this.args = args;
  }
}

export class BlockExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.BLOCK_EXPRESSION = SyntaxNodeKind.BLOCK_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  blockOpenBrace: SyntaxToken;

  body: ExpressionNode[];

  blockCloseBrace: SyntaxToken;

  symbol?: NodeSymbol;

  constructor({
    blockOpenBrace,
    body,
    blockCloseBrace,
  }: {
    blockOpenBrace: SyntaxToken;
    body: ExpressionNode[];
    blockCloseBrace: SyntaxToken;
  }) {
    this.start = blockOpenBrace.offset;
    this.end = blockCloseBrace.offset + 1;
    this.blockOpenBrace = blockOpenBrace;
    this.body = body;
    this.blockCloseBrace = blockCloseBrace;
  }
}

export class ListExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.LIST_EXPRESSION = SyntaxNodeKind.LIST_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  listOpenBracket: SyntaxToken;

  elementList: AttributeNode[];

  commaList: SyntaxToken[];

  listCloseBracket: SyntaxToken;

  symbol?: NodeSymbol;

  constructor({
    listOpenBracket,
    elementList,
    commaList,
    listCloseBracket,
  }: {
    listOpenBracket: SyntaxToken;
    elementList: AttributeNode[];
    commaList: SyntaxToken[];
    listCloseBracket: SyntaxToken;
  }) {
    this.start = listOpenBracket.offset;
    this.end = listCloseBracket.offset + 1;
    this.listOpenBracket = listOpenBracket;
    this.elementList = elementList;
    this.commaList = commaList;
    this.listCloseBracket = listCloseBracket;
  }
}

export class TupleExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.TUPLE_EXPRESSION | SyntaxNodeKind.GROUP_EXPRESSION =
    SyntaxNodeKind.TUPLE_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  tupleOpenParen: SyntaxToken;

  elementList: NormalExpressionNode[];

  commaList: SyntaxToken[];

  tupleCloseParen: SyntaxToken;

  symbol?: NodeSymbol;

  constructor({
    tupleOpenParen,
    elementList,
    commaList,
    tupleCloseParen,
  }: {
    tupleOpenParen: SyntaxToken;
    elementList: NormalExpressionNode[];
    commaList: SyntaxToken[];
    tupleCloseParen: SyntaxToken;
  }) {
    this.start = tupleOpenParen.offset;
    this.end = tupleCloseParen.offset + 1;
    this.tupleOpenParen = tupleOpenParen;
    this.elementList = elementList;
    this.commaList = commaList;
    this.tupleCloseParen = tupleCloseParen;
  }
}

export class GroupExpressionNode extends TupleExpressionNode {
  kind: SyntaxNodeKind.GROUP_EXPRESSION = SyntaxNodeKind.GROUP_EXPRESSION;

  symbol?: NodeSymbol;

  constructor({
    groupOpenParen,
    expression,
    groupCloseParen,
  }: {
    groupOpenParen: SyntaxToken;
    expression: NormalExpressionNode;
    groupCloseParen: SyntaxToken;
  }) {
    super({
      tupleOpenParen: groupOpenParen,
      elementList: [expression],
      commaList: [],
      tupleCloseParen: groupCloseParen,
    });
  }
}

export class CallExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.CALL_EXPRESSION = SyntaxNodeKind.CALL_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  callee: NormalExpressionNode;

  argumentList: TupleExpressionNode;

  symbol?: NodeSymbol;

  constructor({
    callee,
    argumentList,
  }: {
    callee: NormalExpressionNode;
    argumentList: TupleExpressionNode;
  }) {
    this.start = callee.start;
    this.end = argumentList.end;
    this.callee = callee;
    this.argumentList = argumentList;
  }
}

export class LiteralNode implements SyntaxNode {
  kind: SyntaxNodeKind.LITERAL = SyntaxNodeKind.LITERAL;

  start: Readonly<number>;

  end: Readonly<number>;

  literal: SyntaxToken;

  symbol?: NodeSymbol;

  constructor({ literal }: { literal: SyntaxToken }) {
    this.start = literal.offset;
    this.end = literal.offset + literal.length;
    this.literal = literal;
  }
}

export class VariableNode implements SyntaxNode {
  kind: SyntaxNodeKind.VARIABLE = SyntaxNodeKind.VARIABLE;

  start: Readonly<number>;

  end: Readonly<number>;

  variable: SyntaxToken;

  symbol?: NodeSymbol;

  constructor({ variable }: { variable: SyntaxToken }) {
    this.start = variable.offset;
    this.end = variable.offset + variable.length;
    this.variable = variable;
  }
}

export class PrimaryExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.PRIMARY_EXPRESSION = SyntaxNodeKind.PRIMARY_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  expression: LiteralNode | VariableNode;

  symbol?: NodeSymbol;

  constructor({ expression }: { expression: LiteralNode | VariableNode }) {
    this.start = expression.start;
    this.end = expression.end;
    this.expression = expression;
  }
}
