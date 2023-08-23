import { last } from '../utils';
import { SyntaxToken } from '../lexer/tokens';
import { NodeSymbol } from '../analyzer/symbol/symbols';
import { Position } from '../types';

export type SyntaxNodeId = number;
export class SyntaxNodeIdGenerator {
  private static id = 0;

  static reset() {
    this.id = 0;
  }

  static nextId(): SyntaxNodeId {
    return this.id++;
  }
}

export interface SyntaxNode {
  id: Readonly<SyntaxNodeId>;
  kind: SyntaxNodeKind;
  start: Readonly<number>;
  end: Readonly<number>;
  symbol?: NodeSymbol;
  referee?: NodeSymbol; // The symbol that this syntax node refers to
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
}

export class ProgramNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.PROGRAM = SyntaxNodeKind.PROGRAM;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  body: ElementDeclarationNode[];

  eof: SyntaxToken;

  symbol?: NodeSymbol;

  constructor(
    { body, eof }: { body: ElementDeclarationNode[]; eof: SyntaxToken },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = {
      offset: 0,
      line: 0,
      column: 0,
    };
    this.endPos = eof.endPos;
    this.body = body;
    this.eof = eof;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class ElementDeclarationNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.ELEMENT_DECLARATION = SyntaxNodeKind.ELEMENT_DECLARATION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  type: SyntaxToken;

  name?: NormalExpressionNode;

  as?: SyntaxToken;

  alias?: NormalExpressionNode;

  attributeList?: ListExpressionNode;

  bodyColon?: SyntaxToken;

  body: ExpressionNode | BlockExpressionNode;

  symbol?: NodeSymbol;

  parentElement?: ElementDeclarationNode | ProgramNode;

  constructor(
    {
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
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = type.startPos;
    this.endPos = body.endPos;
    this.type = type;
    this.name = name;
    this.as = as;
    this.alias = alias;
    this.attributeList = attributeList;
    this.bodyColon = bodyColon;
    this.body = body;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class IdentiferStreamNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.IDENTIFIER_STREAM = SyntaxNodeKind.IDENTIFIER_STREAM;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  identifiers: SyntaxToken[];

  constructor(
    { identifiers }: { identifiers: SyntaxToken[] },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    if (identifiers.length === 0) {
      throw new Error("An IdentifierStreamNode shouldn't be created with zero tokens");
    }
    this.identifiers = identifiers;
    this.startPos = this.identifiers[0].startPos;
    this.endPos = last(identifiers)!.endPos;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class AttributeNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.ATTRIBUTE = SyntaxNodeKind.ATTRIBUTE;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  name: IdentiferStreamNode;

  colon?: SyntaxToken;

  value?: NormalExpressionNode | IdentiferStreamNode;

  symbol?: NodeSymbol;

  constructor(
    {
      name,
      colon,
      value,
    }: {
      name: IdentiferStreamNode;
      colon?: SyntaxToken;
      value?: NormalExpressionNode | IdentiferStreamNode;
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.name = name;
    this.value = value;
    this.colon = colon;
    this.startPos = this.name.startPos;
    if (colon && !value) {
      throw new Error("An AttributeNode shouldn't be created with a colon but no value");
    }
    this.endPos = colon ? value!.endPos : name.endPos;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
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
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.PREFIX_EXPRESSION = SyntaxNodeKind.PREFIX_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  op: SyntaxToken;

  expression: NormalExpressionNode;

  symbol?: NodeSymbol;

  constructor(
    { op, expression }: { op: SyntaxToken; expression: NormalExpressionNode },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = op.startPos;
    this.endPos = expression.endPos;
    this.op = op;
    this.expression = expression;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class InfixExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.INFIX_EXPRESSION = SyntaxNodeKind.INFIX_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  op: SyntaxToken;

  leftExpression: NormalExpressionNode;

  rightExpression: NormalExpressionNode;

  symbol?: NodeSymbol;

  constructor(
    {
      op,
      leftExpression,
      rightExpression,
    }: {
      op: SyntaxToken;
      leftExpression: NormalExpressionNode;
      rightExpression: NormalExpressionNode;
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = leftExpression.startPos;
    this.endPos = rightExpression.endPos;
    this.op = op;
    this.leftExpression = leftExpression;
    this.rightExpression = rightExpression;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class PostfixExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.POSTFIX_EXPRESSION = SyntaxNodeKind.POSTFIX_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  op: SyntaxToken;

  expression: NormalExpressionNode;

  symbol?: NodeSymbol;

  constructor(
    { op, expression }: { op: SyntaxToken; expression: NormalExpressionNode },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = expression.startPos;
    this.endPos = op.endPos;
    this.op = op;
    this.expression = expression;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class FunctionExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.FUNCTION_EXPRESSION = SyntaxNodeKind.FUNCTION_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  value: SyntaxToken;

  symbol?: NodeSymbol;

  constructor(
    { value }: { value: SyntaxToken },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = value.startPos;
    this.endPos = value.endPos;
    this.value = value;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class FunctionApplicationNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.FUNCTION_APPLICATION = SyntaxNodeKind.FUNCTION_APPLICATION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  callee: ExpressionNode;

  args: ExpressionNode[];

  symbol?: NodeSymbol;

  constructor(
    { callee, args }: { callee: ExpressionNode; args: ExpressionNode[] },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = callee.startPos;
    if (args.length === 0) {
      this.endPos = callee.endPos;
    } else {
      this.endPos = last(args)!.endPos;
    }
    this.callee = callee;
    this.args = args;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class BlockExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.BLOCK_EXPRESSION = SyntaxNodeKind.BLOCK_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  blockOpenBrace: SyntaxToken;

  body: ExpressionNode[];

  blockCloseBrace: SyntaxToken;

  symbol?: NodeSymbol;

  constructor(
    {
      blockOpenBrace,
      body,
      blockCloseBrace,
    }: {
      blockOpenBrace: SyntaxToken;
      body: ExpressionNode[];
      blockCloseBrace: SyntaxToken;
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = blockOpenBrace.startPos;
    this.endPos = blockCloseBrace.endPos;
    this.blockOpenBrace = blockOpenBrace;
    this.body = body;
    this.blockCloseBrace = blockCloseBrace;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class ListExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.LIST_EXPRESSION = SyntaxNodeKind.LIST_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  listOpenBracket: SyntaxToken;

  elementList: AttributeNode[];

  commaList: SyntaxToken[];

  listCloseBracket: SyntaxToken;

  symbol?: NodeSymbol;

  constructor(
    {
      listOpenBracket,
      elementList,
      commaList,
      listCloseBracket,
    }: {
      listOpenBracket: SyntaxToken;
      elementList: AttributeNode[];
      commaList: SyntaxToken[];
      listCloseBracket: SyntaxToken;
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = listOpenBracket.startPos;
    this.endPos = listCloseBracket.endPos;
    this.listOpenBracket = listOpenBracket;
    this.elementList = elementList;
    this.commaList = commaList;
    this.listCloseBracket = listCloseBracket;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class TupleExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.TUPLE_EXPRESSION | SyntaxNodeKind.GROUP_EXPRESSION =
    SyntaxNodeKind.TUPLE_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  tupleOpenParen: SyntaxToken;

  elementList: NormalExpressionNode[];

  commaList: SyntaxToken[];

  tupleCloseParen: SyntaxToken;

  symbol?: NodeSymbol;

  constructor(
    {
      tupleOpenParen,
      elementList,
      commaList,
      tupleCloseParen,
    }: {
      tupleOpenParen: SyntaxToken;
      elementList: NormalExpressionNode[];
      commaList: SyntaxToken[];
      tupleCloseParen: SyntaxToken;
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = tupleOpenParen.startPos;
    this.endPos = tupleCloseParen.endPos;
    this.tupleOpenParen = tupleOpenParen;
    this.elementList = elementList;
    this.commaList = commaList;
    this.tupleCloseParen = tupleCloseParen;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class GroupExpressionNode extends TupleExpressionNode {
  kind: SyntaxNodeKind.GROUP_EXPRESSION = SyntaxNodeKind.GROUP_EXPRESSION;

  symbol?: NodeSymbol;

  constructor(
    {
      groupOpenParen,
      expression,
      groupCloseParen,
    }: {
      groupOpenParen: SyntaxToken;
      expression: NormalExpressionNode;
      groupCloseParen: SyntaxToken;
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    super(
      {
        tupleOpenParen: groupOpenParen,
        elementList: [expression],
        commaList: [],
        tupleCloseParen: groupCloseParen,
      },
      id,
    );
  }
}

export class CallExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.CALL_EXPRESSION = SyntaxNodeKind.CALL_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  callee: NormalExpressionNode;

  argumentList: TupleExpressionNode;

  symbol?: NodeSymbol;

  constructor(
    {
      callee,
      argumentList,
    }: {
      callee: NormalExpressionNode;
      argumentList: TupleExpressionNode;
    },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = callee.startPos;
    this.endPos = argumentList.endPos;
    this.callee = callee;
    this.argumentList = argumentList;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class LiteralNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.LITERAL = SyntaxNodeKind.LITERAL;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  literal: SyntaxToken;

  symbol?: NodeSymbol;

  constructor(
    { literal }: { literal: SyntaxToken },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = literal.startPos;
    this.endPos = literal.endPos;
    this.literal = literal;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class VariableNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.VARIABLE = SyntaxNodeKind.VARIABLE;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  variable: SyntaxToken;

  symbol?: NodeSymbol;

  constructor(
    { variable }: { variable: SyntaxToken },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = variable.startPos;
    this.endPos = variable.endPos;
    this.variable = variable;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}

export class PrimaryExpressionNode implements SyntaxNode {
  id: Readonly<SyntaxNodeId>;

  kind: SyntaxNodeKind.PRIMARY_EXPRESSION = SyntaxNodeKind.PRIMARY_EXPRESSION;

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  expression: LiteralNode | VariableNode;

  symbol?: NodeSymbol;

  constructor(
    { expression }: { expression: LiteralNode | VariableNode },
    id: SyntaxNodeId = SyntaxNodeIdGenerator.nextId(),
  ) {
    this.id = id;
    this.startPos = expression.startPos;
    this.endPos = expression.endPos;
    this.expression = expression;

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
}
