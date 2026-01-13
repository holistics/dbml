import { flatten, zip } from 'lodash-es';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { Position } from '@/core/types';
import { getTokenFullEnd, getTokenFullStart } from '@/core/lexer/utils';

export type SyntaxNodeId = number;
export class SyntaxNodeIdGenerator {
  private id = 0;

  reset () {
    this.id = 0;
  }

  nextId (): SyntaxNodeId {
    return this.id++;
  }
}

export class SyntaxNode {
  id: Readonly<SyntaxNodeId>;
  kind: SyntaxNodeKind;
  startPos: Readonly<Position>;
  start: Readonly<number>;
  fullStart: Readonly<number>; // Start offset with trivias counted
  endPos: Readonly<Position>;
  end: Readonly<number>;
  fullEnd: Readonly<number>; // End offset with trivias counted
  symbol?: NodeSymbol;
  referee?: NodeSymbol; // The symbol that this syntax node refers to

  // args must be passed in order of appearance in the node
  constructor (
    id: SyntaxNodeId,
    kind: SyntaxNodeKind,
    args: Readonly<SyntaxToken | SyntaxNode | undefined>[],
  ) {
    this.id = id;
    this.kind = kind;

    const firstValid = args.find((sub) => sub !== undefined && !Number.isNaN(sub.start));
    if (!firstValid) {
      this.startPos = {
        offset: NaN,
        column: NaN,
        line: NaN,
      };
      this.fullStart = NaN;
    } else {
      this.startPos = firstValid.startPos;
      this.fullStart = firstValid instanceof SyntaxToken
        ? getTokenFullStart(firstValid)
        : (firstValid as SyntaxNode).fullStart;
    }

    const lastValid = [...args]
      .reverse()
      .find((sub) => sub !== undefined && !Number.isNaN(sub.end));
    if (!lastValid) {
      this.endPos = {
        offset: NaN,
        column: NaN,
        line: NaN,
      };
      this.fullEnd = NaN;
    } else {
      this.endPos = lastValid.endPos;
      this.fullEnd = lastValid instanceof SyntaxToken
        ? getTokenFullEnd(lastValid)
        : (lastValid as SyntaxNode).fullEnd;
    }

    this.start = this.startPos.offset;
    this.end = this.endPos.offset;
  }
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
  COMMA_EXPRESSION = '<comma-expression>',
  DUMMY = '<dummy>',
  ARRAY = '<array>',
}

// Form: <element-declaration>*
// The root node of a DBML program containing top-level element declarations
export class ProgramNode extends SyntaxNode {
  body: ElementDeclarationNode[];

  eof?: SyntaxToken;

  constructor (
    { body = [], eof }: { body?: ElementDeclarationNode[]; eof?: SyntaxToken },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.PROGRAM, [...body, eof]);
    this.body = body;
    this.eof = eof;
  }
}

// Form: <type> [<name>] [as <alias>] [<attribute-list>] (: <body> | { <body> })
// A declaration of a DBML element like Table, Ref, Enum, etc.
// e.g. Table users { ... }
// e.g. Ref: users.id > posts.user_id
export class ElementDeclarationNode extends SyntaxNode {
  type?: SyntaxToken;

  name?: NormalExpressionNode;

  as?: SyntaxToken;

  alias?: NormalExpressionNode;

  attributeList?: ListExpressionNode;

  bodyColon?: SyntaxToken;

  parent?: ElementDeclarationNode | ProgramNode; // The enclosing element/program

  body?: FunctionApplicationNode | BlockExpressionNode;

  constructor (
    {
      type,
      name,
      as,
      alias,
      attributeList,
      bodyColon,
      body,
    }: {
      type?: SyntaxToken;
      name?: NormalExpressionNode;
      as?: SyntaxToken;
      alias?: NormalExpressionNode;
      attributeList?: ListExpressionNode;
      bodyColon?: SyntaxToken;
      body?: BlockExpressionNode | FunctionApplicationNode;
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.ELEMENT_DECLARATION, [
      type,
      name,
      as,
      alias,
      attributeList,
      bodyColon,
      body,
    ]);

    if (
      body && bodyColon
      && !(body instanceof FunctionApplicationNode || body instanceof ElementDeclarationNode)
    ) {
      throw new Error('If an element has a simple body, it must be a function application node');
    }

    this.type = type;
    this.name = name;
    this.as = as;
    this.alias = alias;
    this.attributeList = attributeList;
    this.bodyColon = bodyColon;
    this.body = body;
  }
}

// Form: <identifier> <identifier>*
// A contiguous stream of identifiers (space-separated)
// e.g. primary key
// e.g. no action
export class IdentiferStreamNode extends SyntaxNode {
  identifiers: SyntaxToken[];

  constructor ({ identifiers = [] }: { identifiers?: SyntaxToken[] }, id: SyntaxNodeId) {
    super(id, SyntaxNodeKind.IDENTIFIER_STREAM, identifiers || []);
    this.identifiers = identifiers;
  }
}

// Form: <name> [: <value>]
// An attribute within a list expression (inside square brackets)
// e.g. primary key
// e.g. ref: users.id
// e.g. note: 'some note'
export class AttributeNode extends SyntaxNode {
  name?: IdentiferStreamNode | PrimaryExpressionNode;

  colon?: SyntaxToken;

  value?: NormalExpressionNode | IdentiferStreamNode;

  constructor (
    {
      name,
      colon,
      value,
    }: {
      name?: IdentiferStreamNode | PrimaryExpressionNode;
      colon?: SyntaxToken;
      value?: NormalExpressionNode | IdentiferStreamNode;
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.ATTRIBUTE, [name, colon, value]);
    this.name = name;
    this.value = value;
    this.colon = colon;
  }
}

// A normal expression is the regular expression we encounter in most programming languages
// ex. 1 + 2, 1 * 2, (1 / 3) - 4, a.b
// Function application and literal element expressions are not considered one
export type NormalExpressionNode =
  | PrefixExpressionNode
  | InfixExpressionNode
  | PostfixExpressionNode
  | BlockExpressionNode
  | ListExpressionNode
  | TupleExpressionNode
  | CommaExpressionNode
  | CallExpressionNode
  | PrimaryExpressionNode
  | FunctionExpressionNode
  | DummyNode
  | ArrayNode;

export type ExpressionNode =
  | ElementDeclarationNode
  | NormalExpressionNode
  | FunctionApplicationNode;

// Form: <op> <expression>
// A unary prefix expression
// e.g. -5
// e.g. !flag
export class PrefixExpressionNode extends SyntaxNode {
  op?: SyntaxToken;

  expression?: NormalExpressionNode;

  constructor (
    { op, expression }: { op?: SyntaxToken; expression?: NormalExpressionNode },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.PREFIX_EXPRESSION, [op, expression]);
    this.op = op;
    this.expression = expression;
  }
}

// Form: <left-expression> <op> <right-expression>
// A binary infix expression
// e.g. 1 + 2
// e.g. a.b
// e.g. x > y
export class InfixExpressionNode extends SyntaxNode {
  op?: SyntaxToken;

  leftExpression?: NormalExpressionNode;

  rightExpression?: NormalExpressionNode;

  constructor (
    {
      op,
      leftExpression,
      rightExpression,
    }: {
      op?: SyntaxToken;
      leftExpression?: NormalExpressionNode;
      rightExpression?: NormalExpressionNode;
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.INFIX_EXPRESSION, [leftExpression, op, rightExpression]);
    this.op = op;
    this.leftExpression = leftExpression;
    this.rightExpression = rightExpression;
  }
}

// Form: <expression> <op>
// A unary postfix expression
// e.g. x++
export class PostfixExpressionNode extends SyntaxNode {
  op?: SyntaxToken;

  expression?: NormalExpressionNode;

  constructor (
    { op, expression }: { op?: SyntaxToken; expression?: NormalExpressionNode },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.POSTFIX_EXPRESSION, [expression, op]);
    this.op = op;
    this.expression = expression;
  }
}

// Form: `<expression>`
// A backtick-quoted function/SQL expression
// e.g. `now()`
// e.g. `id * 2`
export class FunctionExpressionNode extends SyntaxNode {
  value?: SyntaxToken;

  constructor ({ value }: { value?: SyntaxToken }, id: SyntaxNodeId) {
    super(id, SyntaxNodeKind.FUNCTION_EXPRESSION, [value]);
    this.value = value;
  }
}

// Form: <callee> <arg>* | <callee> <comma-expr>
// A function application with space-separated arguments or comma-separated expressions
// e.g. id integer [primary key]
// e.g. Note 'This is a note'
// e.g. sample_data 1, 2, 3
export class FunctionApplicationNode extends SyntaxNode {
  callee?: ExpressionNode;

  args: ExpressionNode[];

  constructor (
    { callee, args = [] }: { callee?: ExpressionNode; args?: ExpressionNode[] },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.FUNCTION_APPLICATION, [callee, ...args]);
    this.callee = callee;
    this.args = args;
  }
}

// Form: { <body>* }
// A block containing element declarations or function applications
// e.g. { id integer }
// e.g. { Note: 'text' }
export class BlockExpressionNode extends SyntaxNode {
  blockOpenBrace?: SyntaxToken;

  body: (ElementDeclarationNode | FunctionApplicationNode)[];

  blockCloseBrace?: SyntaxToken;

  constructor (
    {
      blockOpenBrace,
      body = [],
      blockCloseBrace,
    }: {
      blockOpenBrace?: SyntaxToken;
      body?: (ElementDeclarationNode | FunctionApplicationNode)[];
      blockCloseBrace?: SyntaxToken;
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.BLOCK_EXPRESSION, [blockOpenBrace, ...body, blockCloseBrace]);
    this.blockOpenBrace = blockOpenBrace;
    this.body = body;
    this.blockCloseBrace = blockCloseBrace;
  }
}

// Form: [ <attribute> [, <attribute>]* ]
// A bracketed list of attributes
// e.g. [primary key]
// e.g. [ref: users.id, note: 'foreign key']
export class ListExpressionNode extends SyntaxNode {
  listOpenBracket?: SyntaxToken;

  elementList: AttributeNode[];

  commaList: SyntaxToken[];

  listCloseBracket?: SyntaxToken;

  constructor (
    {
      listOpenBracket,
      elementList = [],
      commaList = [],
      listCloseBracket,
    }: {
      listOpenBracket?: SyntaxToken;
      elementList?: AttributeNode[];
      commaList?: SyntaxToken[];
      listCloseBracket?: SyntaxToken;
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.LIST_EXPRESSION, [
      listOpenBracket,
      ...interleave(elementList, commaList),
      listCloseBracket,
    ]);
    this.listOpenBracket = listOpenBracket;
    this.elementList = elementList;
    this.commaList = commaList;
    this.listCloseBracket = listCloseBracket;
  }
}

// Form: ( <normal-expr> [, <normal-expr>]* )
// A parenthesized comma-separated list of expressions
// e.g. (1, 2, 3)
// e.g. (a, b)
export class TupleExpressionNode extends SyntaxNode {
  tupleOpenParen?: SyntaxToken;

  elementList: NormalExpressionNode[];

  commaList: SyntaxToken[];

  tupleCloseParen?: SyntaxToken;

  constructor (
    {
      tupleOpenParen,
      elementList = [],
      commaList = [],
      tupleCloseParen,
    }: {
      tupleOpenParen?: SyntaxToken;
      elementList?: NormalExpressionNode[];
      commaList?: SyntaxToken[];
      tupleCloseParen?: SyntaxToken;
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.TUPLE_EXPRESSION, [
      tupleOpenParen,
      ...interleave(elementList, commaList),
      tupleCloseParen,
    ]);
    this.tupleOpenParen = tupleOpenParen;
    this.elementList = elementList;
    this.commaList = commaList;
    this.tupleCloseParen = tupleCloseParen;
  }
}

// Form: <normal-expr> , <normal-expr> [, <normal-expr>]*
// A comma-separated list of expressions without delimiters (CSV-like)
// Used inside function applications for multi-value arguments
// e.g. 1, 2, 3
// e.g. 'a', 'b', 'c'
export class CommaExpressionNode extends SyntaxNode {
  elementList: NormalExpressionNode[];

  commaList: SyntaxToken[];

  constructor (
    {
      elementList = [],
      commaList = [],
    }: {
      elementList?: NormalExpressionNode[];
      commaList?: SyntaxToken[];
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.COMMA_EXPRESSION, [
      ...interleave(elementList, commaList),
    ]);
    this.elementList = elementList;
    this.commaList = commaList;
  }
}

// Form: ( <expression> )
// A parenthesized expression (single element, no commas)
// e.g. (1 + 2)
// e.g. (a.b)
export class GroupExpressionNode extends TupleExpressionNode {
  constructor (
    {
      groupOpenParen,
      expression,
      groupCloseParen,
    }: {
      groupOpenParen?: SyntaxToken;
      expression?: NormalExpressionNode;
      groupCloseParen?: SyntaxToken;
    },
    id: SyntaxNodeId,
  ) {
    super(
      {
        tupleOpenParen: groupOpenParen,
        elementList: expression && [expression],
        commaList: [],
        tupleCloseParen: groupCloseParen,
      },
      id,
    );
    this.kind = SyntaxNodeKind.GROUP_EXPRESSION;
  }
}

// Form: <callee> ( <arguments> )
// A function call with parenthesized arguments
// e.g. func(a, b, c)
// e.g. now()
export class CallExpressionNode extends SyntaxNode {
  callee?: NormalExpressionNode;

  argumentList?: TupleExpressionNode;

  constructor (
    {
      callee,
      argumentList,
    }: {
      callee?: NormalExpressionNode;
      argumentList?: TupleExpressionNode;
    },
    id: SyntaxNodeId,
  ) {
    super(id, SyntaxNodeKind.CALL_EXPRESSION, [callee, argumentList]);
    this.callee = callee;
    this.argumentList = argumentList;
  }
}

// Form: <number> | <string> | <color>
// A literal value
// e.g. 123
// e.g. 'hello'
// e.g. #ff0000
export class LiteralNode extends SyntaxNode {
  literal?: SyntaxToken;

  constructor ({ literal }: { literal?: SyntaxToken }, id: SyntaxNodeId) {
    super(id, SyntaxNodeKind.LITERAL, [literal]);
    this.literal = literal;
  }
}

// Form: <identifier> | <quoted-string>
// A variable reference
// e.g. users
// e.g. "table name"
export class VariableNode extends SyntaxNode {
  variable?: SyntaxToken;

  constructor ({ variable }: { variable?: SyntaxToken }, id: SyntaxNodeId) {
    super(id, SyntaxNodeKind.VARIABLE, [variable]);
    this.variable = variable;
  }
}

// Form: <literal> | <variable>
// A primary expression (leaf node in expression tree)
// e.g. 123
// e.g. users
export class PrimaryExpressionNode extends SyntaxNode {
  expression?: LiteralNode | VariableNode;

  constructor ({ expression }: { expression?: LiteralNode | VariableNode }, id: SyntaxNodeId) {
    super(id, SyntaxNodeKind.PRIMARY_EXPRESSION, [expression]);
    this.expression = expression;
  }
}

// Form: (empty)
// A placeholder for missing operands during error recovery
export class DummyNode extends SyntaxNode {
  constructor ({ pre }: { pre: Readonly<SyntaxNode> | Readonly<SyntaxToken> }, id: SyntaxNodeId) {
    const nextToken = SyntaxToken.create(SyntaxTokenKind.SPACE, pre.endPos, pre.endPos, ' ', false);
    super(id, SyntaxNodeKind.DUMMY, [nextToken]);
  }
}

// Form: <expression> [ <indexer> ]
// An array access expression
// e.g. arr[0]
// e.g. matrix[i]
export class ArrayNode extends SyntaxNode {
  array?: NormalExpressionNode;
  indexer?: ListExpressionNode;

  constructor ({ expression, indexer }: { expression?: NormalExpressionNode; indexer: ListExpressionNode }, id: SyntaxNodeId) {
    super(id, SyntaxNodeKind.ARRAY, [expression, indexer]);
    this.array = expression;
    this.indexer = indexer;
  }
}

function interleave (
  arr1: (SyntaxNode | SyntaxToken)[] | undefined,
  arr2: (SyntaxNode | SyntaxToken)[] | undefined,
): (SyntaxNode | SyntaxToken)[] {
  if (!arr1 || arr1.length === 0) {
    return arr2 || [];
  }
  if (!arr2 || arr2.length === 0) {
    return arr1 || [];
  }
  const [e1] = arr1;
  const [e2] = arr2;

  return (e1.start < e2.start ? flatten(zip(arr1, arr2)) : flatten(zip(arr2, arr1))).filter(
    (e) => e !== null,
  ) as (SyntaxNode | SyntaxToken)[];
}
