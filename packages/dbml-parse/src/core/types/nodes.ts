import {
  flatten, zip,
} from 'lodash-es';
import {
  SyntaxToken, SyntaxTokenKind,
} from '@/core/types/tokens';
import { ElementKind, ImportKind } from '@/core/types/keywords';
import { NodeSymbol } from '@/core/types/symbol/symbols';
import { Position } from '@/core/types/position';
import type { SymbolKind } from '@/core/types/symbol';
import {
  getTokenFullEnd, getTokenFullStart,
} from '@/core/lexer/utils';
import { Filepath } from '@/core/types/filepath';
import { type Internable } from '@/core/types/internable';
import { isReuseKeyword } from '@/core/utils/expression';

export type SyntaxNodeId = number;
export type InternedSyntaxNode = string;
export class SyntaxNodeIdGenerator {
  private id = 0;

  reset () {
    this.id = 0;
  }

  nextId (): SyntaxNodeId {
    return this.id++;
  }
}

export class SyntaxNode implements Internable<InternedSyntaxNode> {
  id: Readonly<SyntaxNodeId>;
  kind: SyntaxNodeKind;
  readonly filepath: Filepath;

  startPos: Readonly<Position>;
  start: Readonly<number>;
  fullStart: Readonly<number>; // Start offset with trivias counted
  endPos: Readonly<Position>;
  end: Readonly<number>;
  fullEnd: Readonly<number>; // End offset with trivias counted
  parentNode?: SyntaxNode;

  // args must be passed in order of appearance in the node
  constructor (
    id: number,
    kind: SyntaxNodeKind,
    filepath: Filepath,
    args: Readonly<SyntaxToken | SyntaxNode | undefined>[],
  ) {
    this.id = id;
    this.kind = kind;
    this.filepath = filepath;

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

  intern (): InternedSyntaxNode {
    return `node@${this.filepath.intern()}:${this.id}` as InternedSyntaxNode;
  }

  // Walk up the tree to find the nearest enclosing element or program
  get parent (): ElementDeclarationNode | ProgramNode | undefined {
    let current: SyntaxNode | undefined = this.parentNode;
    while (current) {
      if (current instanceof ElementDeclarationNode || current instanceof ProgramNode) {
        return current;
      }
      current = current.parentNode;
    }
    return undefined;
  }

  parentOfKind<T extends SyntaxNode> (cls: (new (...args: any[]) => T)): T | undefined {
    let current: SyntaxNode | undefined = this;
    while (current) {
      if (current instanceof cls) {
        return current;
      }
      current = current.parentNode;
    }
    return undefined;
  }

  // Return if `otherNode` is strictly contained inside this node
  strictlyContains (otherNode: SyntaxNode): boolean {
    const thisSmallerStart = this.start < otherNode.start;
    const thisSmallerEqStart = thisSmallerStart || this.start === otherNode.start;
    const thisGreaterEnd = this.end > otherNode.end;
    const thisGreaterEqEnd = thisGreaterEnd || this.end === otherNode.end;
    return (thisSmallerStart && thisGreaterEqEnd) || (thisSmallerEqStart && thisGreaterEnd);
  }

  // Return if `otherNode` is contained inside this node or equals this node
  containsEq (otherNode: SyntaxNode): boolean {
    return this.start <= otherNode.start
      && this.end >= otherNode.end;
  }
}

export enum SyntaxNodeKind {
  PROGRAM = '<program>',
  ELEMENT_DECLARATION = '<element-declaration>',
  USE_DECLARATION = '<use-declaration>',
  USE_SPECIFIER = '<use-specifier>',
  USE_SPECIFIER_LIST = '<use-specifier-list>',
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
  EMPTY = '<dummy>',
  ARRAY = '<array>',

  WILDCARD = '<wildcard>',
}

// Form: (<element-declaration> | <use-declaration>)*
// The root node of a DBML program containing top-level statements in source order.
export class ProgramNode extends SyntaxNode {
  body: (UseDeclarationNode | ElementDeclarationNode)[];

  eof?: SyntaxToken;

  source: string;

  constructor (
    {
      body = [],
      eof,
      source,
    }: {
      body?: (UseDeclarationNode | ElementDeclarationNode)[];
      eof?: SyntaxToken;
      source: string;
    },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.PROGRAM,
      filepath,
      [...body, eof],
    );
    this.source = source;
    this.body = body;
    this.eof = eof;
  }

  get declarations (): ElementDeclarationNode[] {
    return this.body.filter((s): s is ElementDeclarationNode => s.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
  }

  get uses (): UseDeclarationNode[] {
    return this.body.filter((s): s is UseDeclarationNode => s.kind === SyntaxNodeKind.USE_DECLARATION);
  }
}

// Form: use { <specifiers> } from <path>  (selective)
//    or: use * from <path>                (entire-file)
//    or: reuse { <specifiers> } from <path>  (selective re-export)
//    or: reuse * from <path>                 (entire-file re-export)
// A top-level import statement bringing named elements into scope
// e.g. use { table users, enum status } from './schema'
// e.g. use * from './common'
// e.g. reuse { table users } from './schema'
export class UseDeclarationNode extends SyntaxNode {
  useKeyword?: SyntaxToken; // 'use' or 'reuse'

  specifiers?: UseSpecifierListNode | WildcardNode;

  fromKeyword?: SyntaxToken;

  importPath?: SyntaxToken;

  constructor (
    {
      useKeyword,
      specifiers,
      fromKeyword,
      importPath,
    }: {
      useKeyword?: SyntaxToken;
      specifiers?: UseSpecifierListNode | WildcardNode;
      fromKeyword?: SyntaxToken;
      importPath?: SyntaxToken;
    },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.USE_DECLARATION,
      filepath,
      [useKeyword, specifiers, fromKeyword, importPath],
    );
    this.useKeyword = useKeyword;
    this.specifiers = specifiers;
    this.fromKeyword = fromKeyword;
    this.importPath = importPath;
  }

  get isReuse (): boolean {
    return isReuseKeyword(this.useKeyword);
  }
}

// Form: <kind> <name> [as <alias>]
// A single specifier inside a use statement
// e.g. table users
// e.g. enum status
// e.g. table users as u
export class UseSpecifierNode extends SyntaxNode {
  importKind?: SyntaxToken;

  name?: NormalExpressionNode;

  asKeyword?: SyntaxToken;

  alias?: NormalExpressionNode;

  constructor (
    { importKind, name, asKeyword, alias }: {
      importKind?: SyntaxToken;
      name?: NormalExpressionNode;
      asKeyword?: SyntaxToken;
      alias?: NormalExpressionNode;
    },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.USE_SPECIFIER,
      filepath,
      [importKind, name, asKeyword, alias],
    );
    this.importKind = importKind;
    this.name = name;
    this.asKeyword = asKeyword;
    this.alias = alias;
  }

  isKind (...importKinds: ImportKind[]): boolean {
    return this.importKind?.value !== undefined && importKinds.map((k) => k.toLowerCase()).includes(this.importKind.value.toLowerCase());
  }

  getImportKind (): ImportKind | undefined {
    const importKind = Object.values(ImportKind).find((k) => this.isKind(k));
    return importKind;
  }

  getSymbolKind (): SymbolKind | undefined {
    const importKind = this.getImportKind();
    if (importKind === undefined) return undefined;
    // Inline to avoid circular dep: nodes ↔ symbols
    const map: Record<ImportKind, SymbolKind> = {
      [ImportKind.Table]: 'Table' as SymbolKind,
      [ImportKind.Enum]: 'Enum' as SymbolKind,
      [ImportKind.TableGroup]: 'TableGroup' as SymbolKind,
      [ImportKind.TablePartial]: 'TablePartial' as SymbolKind,
      [ImportKind.Note]: 'Note' as SymbolKind,
      [ImportKind.Schema]: 'Schema' as SymbolKind,
    };
    return map[importKind];
  }
}

// Form: { <specifier> [, <specifier>]* }
// The braced list of specifiers in a use statement
// e.g. { table users, enum status }
export class UseSpecifierListNode extends SyntaxNode {
  openBrace?: SyntaxToken;

  specifiers: UseSpecifierNode[];

  commaList: SyntaxToken[];

  closeBrace?: SyntaxToken;

  constructor (
    {
      openBrace,
      specifiers = [],
      commaList = [],
      closeBrace,
    }: {
      openBrace?: SyntaxToken;
      specifiers?: UseSpecifierNode[];
      commaList?: SyntaxToken[];
      closeBrace?: SyntaxToken;
    },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.USE_SPECIFIER_LIST,
      filepath,
      [
        openBrace,
        ...interleave(specifiers, commaList),
        closeBrace,
      ],
    );
    this.openBrace = openBrace;
    this.specifiers = specifiers;
    this.commaList = commaList;
    this.closeBrace = closeBrace;
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
    id: number,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.ELEMENT_DECLARATION,
      filepath,
      [
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

  isKind (...kinds: ElementKind[]): boolean {
    return kinds.some((kind) => this.type?.value.toLowerCase() === kind);
  }
}

// Form: <identifier> <identifier>*
// A contiguous stream of identifiers (space-separated)
// e.g. primary key
// e.g. no action
export class IdentiferStreamNode extends SyntaxNode {
  identifiers: SyntaxToken[];

  constructor (
    { identifiers = [] }: { identifiers?: SyntaxToken[] },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.IDENTIFIER_STREAM,
      filepath,
      identifiers || [],
    );
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
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.ATTRIBUTE,
      filepath,
      [name, colon, value],
    );
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
  | EmptyNode
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
    {
      op, expression,
    }: { op?: SyntaxToken;
      expression?: NormalExpressionNode; },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.PREFIX_EXPRESSION,
      filepath,
      [op, expression],
    );
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
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.INFIX_EXPRESSION,
      filepath,
      [leftExpression, op, rightExpression],
    );
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
    {
      op, expression,
    }: { op?: SyntaxToken;
      expression?: NormalExpressionNode; },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(id, SyntaxNodeKind.POSTFIX_EXPRESSION, filepath, [expression, op]);
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

  constructor (
    { value }: { value?: SyntaxToken },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.FUNCTION_EXPRESSION,
      filepath,
      [value],
    );
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
    {
      callee, args = [],
    }: { callee?: ExpressionNode;
      args?: ExpressionNode[]; },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.FUNCTION_APPLICATION,
      filepath,
      [callee, ...args],
    );
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
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.BLOCK_EXPRESSION,
      filepath,
      [blockOpenBrace, ...body, blockCloseBrace],
    );
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
    filepath: Filepath,
  ) {
    super(id, SyntaxNodeKind.LIST_EXPRESSION, filepath, [listOpenBracket, ...interleave(elementList, commaList), listCloseBracket]);
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
    filepath: Filepath,
  ) {
    super(id, SyntaxNodeKind.TUPLE_EXPRESSION, filepath, [tupleOpenParen, ...interleave(elementList, commaList), tupleCloseParen]);
    this.tupleOpenParen = tupleOpenParen;
    this.elementList = elementList;
    this.commaList = commaList;
    this.tupleCloseParen = tupleCloseParen;
  }
}

// Form: <normal-expr> , <normal-expr> [, <normal-expr>]*
// A comma-separated list of expressions without delimiters (CSV-like)
// Used inside function applications for multi-value arguments
// Empty fields (consecutive commas) are represented by DummyNode
// e.g. 1, 2, 3
// e.g. 'a', 'b', 'c'
// e.g. 1, , 3 (empty field in middle)
// e.g. 1, 2, (trailing comma)
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
    filepath: Filepath,
  ) {
    super(id, SyntaxNodeKind.COMMA_EXPRESSION, filepath, [...interleave(elementList, commaList)]);
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
    filepath: Filepath,
  ) {
    super(
      {
        tupleOpenParen: groupOpenParen,
        elementList: expression && [expression],
        commaList: [],
        tupleCloseParen: groupCloseParen,
      },
      id,
      filepath,
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
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.CALL_EXPRESSION,
      filepath,
      [callee, argumentList],
    );
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

  constructor (
    { literal }: { literal?: SyntaxToken },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.LITERAL,
      filepath,
      [literal],
    );
    this.literal = literal;
  }
}

// A wildcard pattern (*) expression
// Currently, also support standalone (*)
export class WildcardNode extends SyntaxNode {
  token?: SyntaxToken;

  constructor (
    { token }: { token?: SyntaxToken },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.WILDCARD,
      filepath,
      [token],
    );
    this.token = token;
  }
}

// Form: <identifier> | <quoted-string>
// A variable reference
// e.g. users
// e.g. "table name"
export class VariableNode extends SyntaxNode {
  variable?: SyntaxToken;

  constructor (
    { variable }: { variable?: SyntaxToken },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.VARIABLE,
      filepath,
      [variable],
    );
    this.variable = variable;
  }
}

// Form: <literal> | <variable>
// A primary expression (leaf node in expression tree)
// e.g. 123
// e.g. users
export class PrimaryExpressionNode extends SyntaxNode {
  expression?: LiteralNode | VariableNode;

  constructor (
    { expression }: { expression?: LiteralNode | VariableNode },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    super(
      id,
      SyntaxNodeKind.PRIMARY_EXPRESSION,
      filepath,
      [expression],
    );
    this.expression = expression;
  }
}

// Form: (empty)
// A placeholder node used for:
// - Missing operands during error recovery
// - Empty fields in comma expressions (e.g. 1, , 3)
// - Trailing commas in comma expressions (e.g. 1, 2,)
export class EmptyNode extends SyntaxNode {
  constructor (
    { prevToken }: { prevToken: Readonly<SyntaxNode> | Readonly<SyntaxToken> },
    id: SyntaxNodeId,
    filepath: Filepath,
  ) {
    const nextToken = SyntaxToken.create(SyntaxTokenKind.SPACE, filepath, prevToken.endPos, prevToken.endPos, ' ', false);
    super(
      id,
      SyntaxNodeKind.EMPTY,
      filepath,
      [nextToken],
    );
  }
}

// Form: <expression> [ <indexer> ]
// An array access expression
// e.g. arr[0]
// e.g. matrix[i]
export class ArrayNode extends SyntaxNode {
  array?: NormalExpressionNode;
  indexer?: ListExpressionNode;

  constructor ({
    expression, indexer,
  }: { expression?: NormalExpressionNode;
    indexer: ListExpressionNode; }, id: SyntaxNodeId, filepath: Filepath) {
    super(id, SyntaxNodeKind.ARRAY, filepath, [expression, indexer]);
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
