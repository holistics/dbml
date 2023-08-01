import { SyntaxToken } from '../lexer/tokens';

export interface SyntaxNode {
  kind: SyntaxNodeKind;
  start: number;
  end: number;
}

export enum SyntaxNodeKind {
  PROGRAM = '<program>',
  ELEMENT_DECLARATION = '<element-declaration>',
  FIELD_DECLARATION = '<field-declaration>',
  ATTRIBUTE = '<attribute>',

  LITERAL = '<literal>',
  VARIABLE = '<variable>',
  INVALID_EXPRESSION = '<invalid-expression>',
  LITERAL_ELEMENT_EXPRESSION = '<literal-element-expression>',
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

  name?: NormalFormExpressionNode;

  as?: SyntaxToken;

  alias?: NormalFormExpressionNode;

  attributeList?: ListExpressionNode;

  bodyOpenColon?: SyntaxToken;

  bodyOpenBrace?: SyntaxToken;

  body: ExpressionNode | BlockExpressionNode;

  bodyCloseBrace?: SyntaxToken;

  constructor({
    type,
    name,
    as,
    alias,
    attributeList,
    bodyOpenColon,
    body,
  }: {
    type: SyntaxToken;
    name?: NormalFormExpressionNode;
    as?: SyntaxToken;
    alias?: NormalFormExpressionNode;
    attributeList?: ListExpressionNode;
    bodyOpenColon?: SyntaxToken;
    body: BlockExpressionNode | ExpressionNode;
  }) {
    this.start = type.offset;
    this.end = body.end;
    this.type = type;
    this.name = name;
    this.as = as;
    this.alias = alias;
    this.attributeList = attributeList;
    this.bodyOpenColon = bodyOpenColon;
    this.body = body;
  }
}

export class FieldDeclarationNode implements SyntaxNode {
  kind: SyntaxNodeKind.FIELD_DECLARATION = SyntaxNodeKind.FIELD_DECLARATION;

  start: Readonly<number>;

  end: Readonly<number>;

  name: SyntaxToken;

  valueOpenColon: SyntaxToken;

  value: NormalFormExpressionNode;

  attributeList?: ListExpressionNode;

  constructor({
    name,
    valueOpenColon,
    value,
    attributeList,
  }: {
    name: SyntaxToken;
    valueOpenColon: SyntaxToken;
    value: NormalFormExpressionNode;
    attributeList?: ListExpressionNode;
  }) {
    this.start = name.offset;
    if (attributeList) {
      this.end = attributeList.end;
    } else {
      this.end = value.end;
    }
    this.name = name;
    this.valueOpenColon = valueOpenColon;
    this.value = value;
    this.attributeList = attributeList;
  }
}

export class AttributeNode implements SyntaxNode {
  kind: SyntaxNodeKind.ATTRIBUTE = SyntaxNodeKind.ATTRIBUTE;

  start: Readonly<number>;

  end: Readonly<number>;

  name: SyntaxToken[];

  valueOpenColon?: SyntaxToken;

  value?: NormalFormExpressionNode;

  constructor({
    name,
    valueOpenColon,
    value,
  }: {
    name: SyntaxToken[];
    valueOpenColon?: SyntaxToken;
    value?: NormalFormExpressionNode;
  }) {
    if (name.length === 0) {
      this.start = -1;
      this.end = -1;
    } else {
      this.start = name[0].offset;
      if (value) {
        this.end = value.end;
      } else {
        const lastName = name[name.length - 1];
        this.end = lastName.offset + lastName.length - 1;
      }
    }
    this.name = name;
    this.valueOpenColon = valueOpenColon;
    this.value = value;
  }
}

export type NormalFormExpressionNode =
  | PrefixExpressionNode
  | InfixExpressionNode
  | PostfixExpressionNode
  | LiteralElementExpressionNode
  | FunctionApplicationNode
  | BlockExpressionNode
  | ListExpressionNode
  | TupleExpressionNode
  | CallExpressionNode
  | PrimaryExpressionNode
  | FunctionExpressionNode
  | AccessExpressionNode;

export type ExpressionNode =
  | LiteralElementExpressionNode
  | NormalFormExpressionNode
  | FunctionApplicationNode;

export class AccessExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.ACCESS_EXPRESSION = SyntaxNodeKind.ACCESS_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  container: NormalFormExpressionNode;

  dot: SyntaxToken;

  containee: NormalFormExpressionNode;

  constructor({
    container,
    dot,
    containee,
  }: {
    container: NormalFormExpressionNode;
    dot: SyntaxToken;
    containee: NormalFormExpressionNode;
  }) {
    this.start = container.start;
    this.end = containee.end;
    this.container = container;
    this.containee = containee;
    this.dot = dot;
  }
}

export class LiteralElementExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.LITERAL_ELEMENT_EXPRESSION = SyntaxNodeKind.LITERAL_ELEMENT_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  type: ExpressionNode;

  attributeList?: ListExpressionNode;

  body: BlockExpressionNode;

  constructor({
    type,
    attributeList,
    body,
  }: {
    type: ExpressionNode;
    attributeList?: ListExpressionNode;
    body: BlockExpressionNode;
  }) {
    this.start = type.start;
    this.end = body.end;
    this.type = type;
    this.attributeList = attributeList;
    this.body = body;
  }
}

export class PrefixExpressionNode implements SyntaxNode {
  kind: SyntaxNodeKind.PREFIX_EXPRESSION = SyntaxNodeKind.PREFIX_EXPRESSION;

  start: Readonly<number>;

  end: Readonly<number>;

  op: SyntaxToken;

  expression: NormalFormExpressionNode;

  constructor({ op, expression }: { op: SyntaxToken; expression: NormalFormExpressionNode }) {
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

  leftExpression: NormalFormExpressionNode;

  rightExpression: NormalFormExpressionNode;

  constructor({
    op,
    leftExpression,
    rightExpression,
  }: {
    op: SyntaxToken;
    leftExpression: NormalFormExpressionNode;
    rightExpression: NormalFormExpressionNode;
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

  expression: NormalFormExpressionNode;

  constructor({ op, expression }: { op: SyntaxToken; expression: NormalFormExpressionNode }) {
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

  body: (ExpressionNode | FieldDeclarationNode)[];

  blockCloseBrace: SyntaxToken;

  constructor({
    blockOpenBrace,
    body,
    blockCloseBrace,
  }: {
    blockOpenBrace: SyntaxToken;
    body: (ExpressionNode | FieldDeclarationNode)[];
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

  elementList: NormalFormExpressionNode[];

  commaList: SyntaxToken[];

  tupleCloseParen: SyntaxToken;

  constructor({
    tupleOpenParen,
    elementList,
    commaList,
    tupleCloseParen,
  }: {
    tupleOpenParen: SyntaxToken;
    elementList: NormalFormExpressionNode[];
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

  constructor({
    groupOpenParen,
    expression,
    groupCloseParen,
  }: {
    groupOpenParen: SyntaxToken;
    expression: NormalFormExpressionNode;
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

  callee: NormalFormExpressionNode;

  argumentList: TupleExpressionNode;

  constructor({
    callee,
    argumentList,
  }: {
    callee: NormalFormExpressionNode;
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

  constructor({ expression }: { expression: LiteralNode | VariableNode }) {
    this.start = expression.start;
    this.end = expression.end;
    this.expression = expression;
  }
}
