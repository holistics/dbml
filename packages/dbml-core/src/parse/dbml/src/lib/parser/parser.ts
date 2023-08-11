import { convertFuncAppToElem, isAsKeyword } from './utils';
import { CompileError, CompileErrorCode } from '../errors';
import { SyntaxToken, SyntaxTokenKind, isOpToken } from '../lexer/tokens';
import Report from '../report';
import { ParsingContext, ParsingContextStack, SynchronizeHook } from './contextStack';
import { last } from '../utils';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  GroupExpressionNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  NormalFormExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from './nodes';

export default class Parser {
  private tokens: SyntaxToken[];

  private current: number = 0;

  private errors: CompileError[] = []; // A list of errors during parsing

  // A list of tokens/nodes not end up in the ast
  private invalid: (SyntaxToken | SyntaxNode)[] = [];

  // Keep track of which context we're parsing in
  private contextStack: ParsingContextStack = new ParsingContextStack();

  constructor(tokens: SyntaxToken[]) {
    this.tokens = tokens;
  }

  private isAtEnd(): boolean {
    return (
      this.current >= this.tokens.length || this.tokens[this.current].kind === SyntaxTokenKind.EOF
    );
  }

  private advance(): SyntaxToken {
    if (this.isAtEnd()) {
      return last(this.tokens)!; // The EOF
    }

    return this.tokens[this.current++];
  }

  private peek(lookahead: number = 0): SyntaxToken {
    if (lookahead + this.current >= this.tokens.length) {
      return last(this.tokens)!; // The EOF
    }

    return this.tokens[this.current + lookahead];
  }

  private match(...kind: SyntaxTokenKind[]): boolean {
    const res = this.check(...kind);
    if (res) {
      this.advance();
    }

    return res;
  }

  private check(...kind: SyntaxTokenKind[]): boolean {
    const currentToken = this.peek();

    return kind.includes(currentToken.kind);
  }

  private previous(): SyntaxToken {
    return this.tokens[this.current - 1];
  }

  private consume(message: string, ...kind: SyntaxTokenKind[]) {
    if (!this.match(...kind)) {
      this.logAndThrowError(this.peek(), CompileErrorCode.UNEXPECTED_TOKEN, message);
    }
  }

  // Discard tokens until one of `kind` is found
  // If any tokens are discarded, the error message is logged
  private discardUntil(message: string, ...kind: SyntaxTokenKind[]): boolean {
    if (!this.check(...kind)) {
      this.logError(this.advance(), CompileErrorCode.UNEXPECTED_TOKEN, message);
      while (!this.isAtEnd() && !this.check(...kind)) {
        this.invalid.push(this.advance());
      }

      return false;
    }

    return true;
  }

  parse(): Report<ProgramNode, CompileError> {
    const body = this.program();
    const eof = this.advance();
    const program = new ProgramNode({ body, eof, invalid: this.invalid });

    return new Report(program, this.errors);
  }

  /* Parsing and synchronizing ProgramNode */

  private program = this.contextStack.withContextDo(undefined, (synchronizeHook) => {
    const body: ElementDeclarationNode[] = [];
    while (!this.isAtEnd()) {
      synchronizeHook(() => body.push(this.elementDeclaration()), this.synchronizeProgram);
    }

    return body;
  });

  private synchronizeProgram() {
    const invalidToken = this.peek();
    if (invalidToken.kind !== SyntaxTokenKind.EOF) {
      this.invalid.push(this.advance());
    } else {
      this.logError(invalidToken, CompileErrorCode.UNEXPECTED_EOF, 'Unexpected EOF');
    }
  }

  /* Parsing and synchronizing top-level ElementDeclarationNode */

  private elementDeclaration = this.contextStack.withContextDo(undefined, (synchronizeHook) => {
    this.consume('Expect identifier', SyntaxTokenKind.IDENTIFIER);
    const type = this.previous();

    const name = this.elementDeclarationName(synchronizeHook);
    const { as, alias } = this.elementDeclarationAlias(synchronizeHook);

    // Parsing attribute list for complex element declarations
    // e.g Table Users [headercolor: #abc] { }
    const attributeList = this.check(SyntaxTokenKind.LBRACKET) ? this.listExpression() : undefined;

    this.discardUntil('Expect { or :', SyntaxTokenKind.LBRACE, SyntaxTokenKind.COLON);

    const { bodyOpenColon, body } = this.elementDeclarationBody();

    return new ElementDeclarationNode({
      type,
      name,
      as,
      alias,
      attributeList,
      bodyOpenColon,
      body,
    });
  });

  elementDeclarationName(synchronizeHook: SynchronizeHook): NormalFormExpressionNode | undefined {
    let name: NormalFormExpressionNode | undefined;
    if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
      synchronizeHook(
        // eslint-disable-next-line no-return-assign
        () => (name = this.normalFormExpression()),
        this.synchronizeElementDeclarationName,
      );
    }

    return name;
  }

  synchronizeElementDeclarationName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (
        isAsKeyword(token) ||
        this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)
      ) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  elementDeclarationAlias(synchronizeHook: SynchronizeHook): {
    as?: SyntaxToken;
    alias?: NormalFormExpressionNode;
  } {
    let as: SyntaxToken | undefined;
    let alias: NormalFormExpressionNode | undefined;

    if (isAsKeyword(this.peek())) {
      as = this.advance();
      if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
        synchronizeHook(
          // eslint-disable-next-line no-return-assign
          () => (alias = this.normalFormExpression()),
          this.synchronizeElementDeclarationAlias,
        );
      }
    }

    return { as, alias };
  }

  synchronizeElementDeclarationAlias = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  elementDeclarationBody(): { bodyOpenColon?: SyntaxToken; body: ExpressionNode } {
    let body: ExpressionNode | BlockExpressionNode | undefined;
    let bodyOpenColon: SyntaxToken | undefined;

    if (this.match(SyntaxTokenKind.COLON)) {
      bodyOpenColon = this.previous();
      body = this.expression();
    } else {
      body = this.blockExpression();
    }

    return {
      bodyOpenColon,
      body,
    };
  }

  /* Parsing nested element declarations with simple body */

  // e.g
  // ```
  //  Table Users {
  //    Note: 'This is a note'  // fieldDeclaration() handles this
  //  }
  private fieldDeclaration(): ElementDeclarationNode {
    this.consume('Expect identifier', SyntaxTokenKind.IDENTIFIER);
    const type = this.previous();
    this.consume('Expect :', SyntaxTokenKind.COLON);
    const bodyOpenColon = this.previous();
    const body = this.expression();

    return new ElementDeclarationNode({
      type,
      bodyOpenColon,
      body,
    });
  }

  /* Parsing any ExpressionNode, including non-NormalFormExpression */

  private expression(): ExpressionNode {
    // Since function application expression is the most generic form
    // by default, we'll interpret any expression as a function application
    const callee: NormalFormExpressionNode = this.normalFormExpression();
    const args: NormalFormExpressionNode[] = [];

    // If there are newlines after the callee, then it's a simple expression
    // such as a PrefixExpression, InfixExpression, ...
    // e.g
    // indexes {
    //   (id, `id * 2`)
    // }
    // Note {
    //   'This is a note'
    // }
    if (this.hasTrailingNewLines(this.previous())) {
      return callee;
    }

    let prevNode = callee;

    while (!this.isAtEnd() && !this.hasTrailingNewLines(this.previous())) {
      if (!this.hasTrailingSpaces(this.previous())) {
        this.logError(prevNode, CompileErrorCode.MISSING_SPACES, 'Expect a following space');
      }
      prevNode = this.normalFormExpression();
      args.push(prevNode);
    }

    // Try interpreting the function application as an element declaration expression
    // if fail, fall back to the generic function application
    return convertFuncAppToElem(callee, args).unwrap_or(
      new FunctionApplicationNode({ callee, args }),
    );
  }

  private normalFormExpression(): NormalFormExpressionNode {
    return this.expression_bp(0);
  }

  // Pratt's parsing algorithm
  private expression_bp(mbp: number): NormalFormExpressionNode {
    let leftExpression: NormalFormExpressionNode | undefined;

    if (isOpToken(this.peek())) {
      const prefixOp = this.peek();
      const opPrefixPower = prefixBindingPower(prefixOp);

      if (opPrefixPower.right === null) {
        this.logAndThrowError(
          prefixOp,
          CompileErrorCode.UNKNOWN_PREFIX_OP,
          `Unexpected prefix ${prefixOp.value} in an expression`,
        );
      }

      this.advance();
      const prefixExpression = this.expression_bp(opPrefixPower.right);
      leftExpression = new PrefixExpressionNode({ op: prefixOp, expression: prefixExpression });
    } else {
      leftExpression = this.extractOperand();
    }

    while (!this.isAtEnd()) {
      const token = this.peek();

      if (token.kind === SyntaxTokenKind.LPAREN) {
        const { left } = postfixBindingPower(token);
        if ((left as number) < mbp) {
          break;
        }
        if (
          // When '(' is encountered,
          // consider it part of another expression if
          // it's at the start of a new line
          // and we're currently not having unmatched '(' or '['
          this.isAtStartOfLine(this.previous(), token) &&
          !this.contextStack.isWithinGroupExpressionContext() &&
          !this.contextStack.isWithinListExpressionContext()
        ) {
          break;
        }
        const argumentList = this.tupleExpression();
        leftExpression = new CallExpressionNode({
          callee: leftExpression,
          argumentList,
        });
      } else if (!isOpToken(token)) {
        break;
      } else {
        const op = token;
        const opPostfixPower = postfixBindingPower(op);

        if (opPostfixPower.left !== null) {
          if (opPostfixPower.left <= mbp) {
            break;
          }
          this.advance();
          leftExpression = new PostfixExpressionNode({ expression: leftExpression!, op });
        } else {
          const opInfixPower = infixBindingPower(op);
          if (opInfixPower.left === null || opInfixPower.left <= mbp) {
            break;
          }
          this.advance();
          const rightExpression = this.expression_bp(opInfixPower.right);
          leftExpression = new InfixExpressionNode({
            leftExpression: leftExpression!,
            op,
            rightExpression,
          });
        }
      }
    }

    return leftExpression;
  }

  // Extract an operand to be used in a normal form expression
  // e.g (1 + 2) in (1 + 2) * 3
  // e.g [1, 2, 3, 4]
  // e.g { ... }
  private extractOperand():
    | PrimaryExpressionNode
    | ListExpressionNode
    | BlockExpressionNode
    | TupleExpressionNode
    | FunctionExpressionNode
    | GroupExpressionNode {
    if (
      this.check(
        SyntaxTokenKind.NUMERIC_LITERAL,
        SyntaxTokenKind.STRING_LITERAL,
        SyntaxTokenKind.COLOR_LITERAL,
        SyntaxTokenKind.QUOTED_STRING,
        SyntaxTokenKind.IDENTIFIER,
      )
    ) {
      return this.primaryExpression();
    }

    if (this.check(SyntaxTokenKind.FUNCTION_EXPRESSION)) {
      return this.functionExpression();
    }

    if (this.check(SyntaxTokenKind.LBRACKET)) {
      return this.listExpression();
    }

    if (this.check(SyntaxTokenKind.LBRACE)) {
      return this.blockExpression();
    }

    if (this.check(SyntaxTokenKind.LPAREN)) {
      return this.tupleExpression();
    }

    // The error is thrown here to communicate failure of operand extraction to `expression_bp`
    this.logAndThrowError(
      this.peek(),
      CompileErrorCode.INVALID_OPERAND,
      `Invalid start of operand "${this.peek().value}"`,
    );
  }

  /* Parsing FunctionExpression */

  private functionExpression(): FunctionExpressionNode {
    this.consume('Expect a function expression', SyntaxTokenKind.FUNCTION_EXPRESSION);

    return new FunctionExpressionNode({ value: this.previous() });
  }

  /* Parsing and synchronizing BlockExpression */

  private blockExpression = this.contextStack.withContextDo(
    ParsingContext.BlockExpression,
    (synchronizeHook) => {
      const body: ExpressionNode[] = [];

      this.consume('Expect {', SyntaxTokenKind.LBRACE);
      const blockOpenBrace = this.previous();
      while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACE)) {
        if (this.canBeField()) {
          body.push(this.fieldDeclaration());
        } else {
          synchronizeHook(() => body.push(this.expression()), this.synchronizeBlock);
        }
      }
      this.consume('Expect }', SyntaxTokenKind.RBRACE);
      const blockCloseBrace = this.previous();

      return new BlockExpressionNode({ blockOpenBrace, body, blockCloseBrace });
    },
  );

  private canBeField(): boolean {
    return (
      this.peek().kind === SyntaxTokenKind.IDENTIFIER && this.peek(1).kind === SyntaxTokenKind.COLON
    );
  }

  private synchronizeBlock = () => {
    if (this.check(SyntaxTokenKind.RBRACE)) {
      return;
    }
    // This early advance is to prevent the case where the violating token is at the start of line
    // where an infinite loop may occur
    // e.g
    // Table Math {
    //    ** 2 + 3 // ** is not valid here but is at the start of line
    //             // since we're synchronizing until the start of line
    //             // the loop would terminate immediately
    // }
    this.advance();
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.RBRACE) || this.isAtStartOfLine(this.previous(), token)) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  /* Parsing PrimaryExpression */

  private primaryExpression(): PrimaryExpressionNode {
    // Primary expression containing a nested LiteralNode
    if (
      this.match(
        SyntaxTokenKind.COLOR_LITERAL,
        SyntaxTokenKind.STRING_LITERAL,
        SyntaxTokenKind.NUMERIC_LITERAL,
      )
    ) {
      return new PrimaryExpressionNode({
        expression: new LiteralNode({ literal: this.previous() }),
      });
    }

    // Primary expression containing a nested VariableNode
    if (this.match(SyntaxTokenKind.QUOTED_STRING, SyntaxTokenKind.IDENTIFIER)) {
      return new PrimaryExpressionNode({
        expression: new VariableNode({ variable: this.previous() }),
      });
    }

    // The error is thrown here because this method is considered a "low-level one",
    // it should not resolve the error on its own
    // and should forward the error to higher-level ones which has more context information
    // to handle the error properly
    this.logAndThrowError(
      this.peek(),
      CompileErrorCode.UNEXPECTED_TOKEN,
      'Expect a variable or literal',
    );
  }

  /* Parsing and synchronizing TupleExpression */

  private tupleExpression = this.contextStack.withContextDo(
    ParsingContext.GroupExpression,
    (synchronizeHook) => {
      const elementList: NormalFormExpressionNode[] = [];
      const commaList: SyntaxToken[] = [];

      this.consume('Expect (', SyntaxTokenKind.LPAREN);
      const tupleOpenParen = this.previous();

      if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
        synchronizeHook(() => elementList.push(this.normalFormExpression()), this.synchronizeTuple);
      }

      while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
        synchronizeHook(() => {
          this.consume('Expect ,', SyntaxTokenKind.COMMA);
          commaList.push(this.previous());
          elementList.push(this.normalFormExpression());
        }, this.synchronizeTuple);
      }

      synchronizeHook(
        () => this.consume('Expect )', SyntaxTokenKind.RPAREN),
        this.synchronizeTuple,
      );

      const tupleCloseParen = this.previous();

      if (elementList.length === 1) {
        return new GroupExpressionNode({
          groupOpenParen: tupleOpenParen,
          expression: elementList[0],
          groupCloseParen: tupleCloseParen,
        });
      }

      return new TupleExpressionNode({
        tupleOpenParen,
        elementList,
        commaList,
        tupleCloseParen,
      });
    },
  );

  private synchronizeTuple = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.RPAREN, SyntaxTokenKind.COMMA)) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  /* Parsing and synchronizing ListExpression */

  private listExpression = this.contextStack.withContextDo(
    ParsingContext.ListExpression,
    (synchronizeHook) => {
      this.consume('Expect a [', SyntaxTokenKind.LBRACKET);
      const listOpenBracket = this.previous();

      const elementList: AttributeNode[] = [];
      const commaList: SyntaxToken[] = [];

      if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
        const attribute = this.attribute();
        if (attribute) {
          elementList.push(attribute);
        }
      }

      while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
        synchronizeHook(() => {
          this.consume('Expect a ,', SyntaxTokenKind.COMMA);
          commaList.push(this.previous());
          const attribute = this.attribute();
          if (attribute) {
            elementList.push(attribute);
          }
        }, this.synchronizeList);
      }

      synchronizeHook(
        () => this.consume('Expect a ]', SyntaxTokenKind.RBRACKET),
        this.synchronizeList,
      );
      const listCloseBracket = this.previous();

      return new ListExpressionNode({
        listOpenBracket,
        elementList,
        commaList,
        listCloseBracket,
      });
    },
  );

  private synchronizeList = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET)) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private attribute(): AttributeNode | undefined {
    let valueOpenColon: SyntaxToken | undefined;
    let value: NormalFormExpressionNode | SyntaxToken[] | undefined;

    if (this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.RBRACKET, SyntaxTokenKind.COMMA)) {
      const token = this.peek();
      this.logError(
        token,
        CompileErrorCode.EMPTY_ATTRIBUTE_NAME,
        'Expect a non-empty attribute name',
      );
    }

    const ignoredInvalidTokenKinds = [
      SyntaxTokenKind.STRING_LITERAL,
      SyntaxTokenKind.NUMERIC_LITERAL,
      SyntaxTokenKind.FUNCTION_EXPRESSION,
      SyntaxTokenKind.QUOTED_STRING,
    ];
    const name = this.attributeName(ignoredInvalidTokenKinds);

    if (this.match(SyntaxTokenKind.COLON)) {
      valueOpenColon = this.previous();
      value = this.attributeValue(ignoredInvalidTokenKinds);
    }

    const attribute = new AttributeNode({ name, valueOpenColon, value });
    if (name.length === 0) {
      this.invalid.push(attribute);

      return undefined;
    }

    return attribute;
  }

  private attributeName(ignoredInvalidTokenKinds: SyntaxTokenKind[]): SyntaxToken[] {
    return this.extractIdentifierStream(
      SyntaxTokenKind.RBRACKET,
      SyntaxTokenKind.COMMA,
      ignoredInvalidTokenKinds,
      this.synchronizeAttributeName,
    );
  }

  private synchronizeAttributeName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET, SyntaxTokenKind.COLON)) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private attributeValue(
    ignoredInvalidTokenKinds: SyntaxTokenKind[],
  ): NormalFormExpressionNode | SyntaxToken[] | undefined {
    if (
      this.peek().kind === SyntaxTokenKind.IDENTIFIER &&
      this.peek(1).kind === SyntaxTokenKind.IDENTIFIER
    ) {
      return this.extractIdentifierStream(
        SyntaxTokenKind.RBRACKET,
        SyntaxTokenKind.COMMA,
        ignoredInvalidTokenKinds,
        this.synchronizeAttributeValue,
      );
    }

    try {
      return this.normalFormExpression();
    } catch (e) {
      if (!(e instanceof CompileError)) {
        throw e;
      }

      this.synchronizeAttributeValue();
    }
  }

  private synchronizeAttributeValue = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET)) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  // Extract contiguous identifiers until the `closing` or `separator` is encountered
  // e.g [primary key] -> ["primary", "key"]
  private extractIdentifierStream(
    closing: SyntaxTokenKind,
    separator: SyntaxTokenKind,
    ignoredInvalidTokenKinds: SyntaxTokenKind[],
    synchronizeCallback: () => void,
  ): SyntaxToken[] {
    const stream: SyntaxToken[] = [];
    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.COLON, closing, separator)) {
      try {
        this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
        stream.push(this.previous());
      } catch (e) {
        if (
          e instanceof CompileError &&
          e.value instanceof SyntaxToken &&
          ignoredInvalidTokenKinds.includes(e.value.kind)
        ) {
          synchronizeCallback();
        } else {
          throw e;
        }
      }
    }

    return stream;
  }

  // eslint-disable-next-line class-methods-use-this
  private hasTrailingNewLines(token: SyntaxToken): boolean {
    return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;
  }

  private isAtStartOfLine(previous: SyntaxToken, token: SyntaxToken): boolean {
    const hasLeadingNewLines =
      token.leadingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;

    return hasLeadingNewLines || this.hasTrailingNewLines(previous);
  }

  // eslint-disable-next-line class-methods-use-this
  private hasTrailingSpaces(token: SyntaxToken): boolean {
    return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.SPACE) !== undefined;
  }

  // This method is expected to called when the error is resolved
  private logError(tokenOrNode: SyntaxToken | SyntaxNode, code: CompileErrorCode, message: string) {
    const e =
      tokenOrNode instanceof SyntaxToken ?
        new CompileError(
            code,
            message,
            tokenOrNode.offset,
            tokenOrNode.offset + tokenOrNode.length,
            tokenOrNode,
          ) :
        new CompileError(code, message, tokenOrNode.start, tokenOrNode.end, tokenOrNode);
    this.errors.push(e);
  }

  // This method does not push to `this.invalid`
  // as the error is rethrown and only where the error is handled
  // and synchronized would that token be pushed onto `this.invalid`
  private logAndThrowError(
    tokenOrNode: SyntaxToken | SyntaxNode,
    code: CompileErrorCode,
    message: string,
  ): never {
    const e =
      tokenOrNode instanceof SyntaxToken ?
        new CompileError(
            code,
            message,
            tokenOrNode.offset,
            tokenOrNode.offset + tokenOrNode.length,
            tokenOrNode,
          ) :
        new CompileError(code, message, tokenOrNode.start, tokenOrNode.end, tokenOrNode);
    this.errors.push(e);
    throw e;
  }
}

const infixBindingPowerMap: {
  [index: string]: { left: number; right: number } | undefined;
} = {
  '+': { left: 9, right: 10 },
  '*': { left: 11, right: 12 },
  '-': { left: 9, right: 10 },
  '/': { left: 11, right: 12 },
  '%': { left: 11, right: 12 },
  '<': { left: 7, right: 8 },
  '<=': { left: 7, right: 8 },
  '>': { left: 7, right: 8 },
  '>=': { left: 7, right: 8 },
  '<>': { left: 7, right: 8 },
  '=': { left: 2, right: 3 },
  '==': { left: 4, right: 5 },
  '!=': { left: 4, right: 5 },
  '.': { left: 16, right: 17 },
};

function infixBindingPower(
  token: SyntaxToken,
): { left: null; right: null } | { left: number; right: number } {
  const power = infixBindingPowerMap[token.value];

  return power || { left: null, right: null };
}

const prefixBindingPowerMap: {
  [index: string]: { left: null; right: number } | undefined;
} = {
  '+': { left: null, right: 15 },
  '-': { left: null, right: 15 },
  '<': { left: null, right: 15 },
  '>': { left: null, right: 15 },
  '<>': { left: null, right: 15 },
  '!': { left: null, right: 15 },
};

function prefixBindingPower(token: SyntaxToken): { left: null; right: null | number } {
  const power = prefixBindingPowerMap[token.value];

  return power || { left: null, right: null };
}

const postfixBindingPowerMap: {
  [index: string]: { left: number; right: null } | undefined;
} = {
  '(': { left: 14, right: null },
};

function postfixBindingPower(token: SyntaxToken): { left: null | number; right: null } {
  const power = postfixBindingPowerMap[token.value];

  return power || { left: null, right: null };
}
