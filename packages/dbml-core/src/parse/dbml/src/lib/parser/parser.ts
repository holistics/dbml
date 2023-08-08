import { extractIdentifierFromNode, isIdentifierNode } from '../utils';
import { CompileError, CompileErrorCode } from '../errors';
import { SyntaxToken, SyntaxTokenKind, isOpToken } from '../lexer/tokens';
import Report from '../report';
import { ParsingContext, ParsingContextStack } from './contextStack';
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
  SyntaxNodeKind,
  TupleExpressionNode,
  VariableNode,
} from './nodes';

export default class Parser {
  private tokens: SyntaxToken[];

  private current: number = 0;

  private errors: CompileError[] = [];

  private invalid: (SyntaxToken | SyntaxNode)[] = [];

  private contextStack: ParsingContextStack = new ParsingContextStack();

  constructor(tokens: SyntaxToken[]) {
    this.tokens = tokens;
  }

  private isAtEnd(): boolean {
    return (
      this.current >= this.tokens.length || this.tokens[this.current].kind === SyntaxTokenKind.EOF
    );
  }

  private init() {
    this.current = 0;
    this.errors = [];
    this.invalid = [];
    if (this.tokens[this.tokens.length - 1].kind !== SyntaxTokenKind.EOF) {
      throw new Error('Expected EOF at the end of token stream');
    }
  }

  private advance(): SyntaxToken {
    if (this.isAtEnd()) {
      return this.tokens[this.tokens.length - 1]; // The EOF
    }

    return this.tokens[this.current++];
  }

  private peek(lookahead: number = 0): SyntaxToken {
    if (lookahead + this.current >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // The EOF
    }

    return this.tokens[this.current + lookahead];
  }

  private match(...kind: SyntaxTokenKind[]): boolean {
    const checkRes = this.check(...kind);
    if (checkRes) {
      this.advance();
    }

    return checkRes;
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
      this.logAndThrowError(this.peek(), CompileErrorCode.EXPECTED_THINGS, message);
    }
  }

  parse(): Report<ProgramNode, CompileError> {
    const body: ElementDeclarationNode[] = [];

    this.init();

    while (!this.isAtEnd()) {
      try {
        body.push(this.elementDeclaration());
      } catch (e) {
        if (!(e instanceof CompileError)) {
          throw e;
        }
        const invalidToken = this.peek();
        if (invalidToken.kind !== SyntaxTokenKind.EOF) {
          this.invalid.push(this.advance());
        } else {
          this.logError(invalidToken, CompileErrorCode.INVALID, 'Unexpected EOF');
        }
      }
    }

    const eof = this.advance();
    const program = new ProgramNode({ body, eof, invalid: this.invalid });

    return new Report(program, this.errors);
  }

  private elementDeclaration = this.contextStack.withContextDo(
    undefined,
    (synchronizationPoint) => {
      this.consume('Expect identifier', SyntaxTokenKind.IDENTIFIER);
      const type = this.previous();
      let name: NormalFormExpressionNode | undefined;
      let as: SyntaxToken | undefined;
      let alias: NormalFormExpressionNode | undefined;

      if (
        this.peek().kind !== SyntaxTokenKind.COLON &&
        this.peek().kind !== SyntaxTokenKind.LBRACE &&
        this.peek().kind !== SyntaxTokenKind.LBRACKET
      ) {
        // Parsing for element name, any normal expressions are accepted
        synchronizationPoint(
          // eslint-disable-next-line no-return-assign
          () => (name = this.normalFormExpression()),
          this.synchronizeElementDeclarationName,
        );

        // Parsing for potential aliases
        const nextWord = this.peek();
        if (nextWord.kind === SyntaxTokenKind.IDENTIFIER && nextWord.value === 'as') {
          as = this.advance();
          synchronizationPoint(
            // eslint-disable-next-line no-return-assign
            () => (alias = this.normalFormExpression()),
            this.synchronizeElementDeclarationAlias,
          );
        }
      }

      let attributeList: ListExpressionNode | undefined;
      // Parsing attribute list for complex element declarations
      // e.g Table Users [headercolor: #abc] { }
      if (this.check(SyntaxTokenKind.LBRACKET)) {
        attributeList = this.listExpression();
      }

      let body: ExpressionNode | BlockExpressionNode | undefined;
      let bodyOpenColon: SyntaxToken | undefined;

      // Discard tokens until { or : is met
      if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE)) {
        this.logError(this.advance(), CompileErrorCode.EXPECTED_THINGS, 'Expect { or :');
        while (!this.isAtEnd() && !this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE)) {
          this.invalid.push(this.advance());
        }
      }

      if (this.match(SyntaxTokenKind.COLON)) {
        bodyOpenColon = this.previous();
        body = this.normalFormExpression();
        // For simple element declarations,
        // the attribute list should follow the element value instead
        // e.g Ref users_id__product__uid: users.id < products.id [update: no action]
        if (attributeList) {
          this.logError(
            attributeList,
            CompileErrorCode.UNEXPECTED_THINGS,
            'This attribute list should follow the element value',
          );
        }
        // Recheck for attribute list anyways
        if (this.check(SyntaxTokenKind.LBRACKET)) {
          attributeList = this.listExpression();
        }
      } else {
        body = this.blockExpression();
      }

      return new ElementDeclarationNode({
        type,
        name,
        as,
        alias,
        attributeList,
        bodyOpenColon,
        body,
      });
    },
  );

  synchronizeElementDeclarationName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (
        (token.kind === SyntaxTokenKind.IDENTIFIER && token.value === 'as') ||
        token.kind === SyntaxTokenKind.LBRACE ||
        token.kind === SyntaxTokenKind.COLON ||
        token.kind === SyntaxTokenKind.LBRACKET
      ) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  synchronizeElementDeclarationAlias = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (
        token.kind === SyntaxTokenKind.LBRACE ||
        token.kind === SyntaxTokenKind.COLON ||
        token.kind === SyntaxTokenKind.LBRACKET
      ) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  synchronizeElementDeclarationBody = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (
        token.kind === SyntaxTokenKind.RBRACE ||
        token.kind === SyntaxTokenKind.COLON ||
        this.isAtStartOfLine(this.previous(), token)
      ) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  // For parsing nested element declarations with simple body
  // e.g
  // ```
  //  Table Users {
  //    Note: 'This is a note'  // fieldDeclaration() handles this
  //  }
  // ```
  private fieldDeclaration(): ElementDeclarationNode {
    this.consume('Expect identifier', SyntaxTokenKind.IDENTIFIER);
    const type = this.previous();
    this.consume('Expect :', SyntaxTokenKind.COLON);
    const bodyOpenColon = this.previous();
    const body = this.normalFormExpression();
    let attributeList: ListExpressionNode | undefined;
    if (this.check(SyntaxTokenKind.LBRACKET)) {
      attributeList = this.listExpression();
    }

    return new ElementDeclarationNode({
      type,
      bodyOpenColon,
      body,
      attributeList,
    });
  }

  private expression(): ExpressionNode {
    const args: NormalFormExpressionNode[] = [];

    const callee: NormalFormExpressionNode = this.normalFormExpression();

    if (this.hasTrailingNewLines(this.previous())) {
      return callee;
    }

    let previousComponent: NormalFormExpressionNode = callee;
    let previousToken = this.previous();

    while (!this.isAtEnd() && !this.hasTrailingNewLines(previousToken)) {
      if (!this.hasTrailingSpaces(previousToken)) {
        this.logError(
          previousComponent,
          CompileErrorCode.EXPECTED_THINGS,
          'Expect a following space',
        );
      }
      previousComponent = this.normalFormExpression();
      args.push(previousComponent);
      previousToken = this.previous();
    }

    const maybeLiteralElement = this.tryInterpretAsLiteralElement(callee, args);

    return maybeLiteralElement || new FunctionApplicationNode({ callee, args });
  }

  private tryInterpretAsLiteralElement(
    callee: ExpressionNode,
    args: NormalFormExpressionNode[],
  ): ElementDeclarationNode | undefined {
    if (!isIdentifierNode(callee) || args.length === 0) {
      return undefined;
    }

    const type = extractIdentifierFromNode(callee)!;

    let attributeList: ListExpressionNode | undefined;
    let alias: NormalFormExpressionNode | undefined;
    let as: SyntaxToken | undefined;
    let name: NormalFormExpressionNode | undefined;

    const cpArgs = [...args];

    const body = cpArgs.pop();
    if (!(body instanceof BlockExpressionNode)) {
      return undefined;
    }

    if (cpArgs[cpArgs.length - 1] instanceof ListExpressionNode) {
      attributeList = cpArgs.pop() as ListExpressionNode;
    }

    const maybeAlias = cpArgs.pop();
    const maybeAs = cpArgs[cpArgs.length - 1];
    if (extractIdentifierFromNode(maybeAs)?.value === 'as') {
      alias = maybeAlias;
      as = extractIdentifierFromNode(cpArgs.pop());
    } else {
      name = maybeAlias;
    }

    return cpArgs.length === 0 ?
      new ElementDeclarationNode({
          type,
          name,
          as,
          alias,
          attributeList,
          body,
        }) :
      undefined;
  }

  private normalFormExpression(): NormalFormExpressionNode {
    const expression = this.expression_bp(0);

    return expression;
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
          CompileErrorCode.UNEXPECTED_THINGS,
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
        continue;
      }

      if (!isOpToken(token)) {
        break;
      }

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

    return leftExpression;
  }

  // Extract an operand to be used in an expression
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
      CompileErrorCode.UNEXPECTED_THINGS,
      `Invalid start of operand "${this.peek().value}"`,
    );
  }

  private functionExpression(): FunctionExpressionNode {
    this.consume('Expect a function expression', SyntaxTokenKind.FUNCTION_EXPRESSION);

    return new FunctionExpressionNode({ value: this.previous() });
  }

  private blockExpression = this.contextStack.withContextDo(
    ParsingContext.BlockExpression,
    (synchronizationPoint) => {
      const body: ExpressionNode[] = [];

      this.consume('Expect {', SyntaxTokenKind.LBRACE);
      const blockOpenBrace = this.previous();
      while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACE)) {
        if (this.canBeField()) {
          body.push(this.fieldDeclaration());
        } else {
          synchronizationPoint(() => body.push(this.expression()), this.synchronizeBlock);
        }
      }
      this.consume('Expect }', SyntaxTokenKind.RBRACE);
      const blockCloseBrace = this.previous();

      return new BlockExpressionNode({ blockOpenBrace, body, blockCloseBrace });
    },
  );

  synchronizeBlock = () => {
    // This check is necessary to avoid the violating token being at the end of the line
    // ex: `** 1 + 2` -> The following loop would terminate without consuming the invalid token.
    if (this.peek().kind === SyntaxTokenKind.RBRACE) {
      return;
    }
    this.advance();
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.kind === SyntaxTokenKind.RBRACE || this.isAtStartOfLine(this.previous(), token)) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private primaryExpression(): PrimaryExpressionNode {
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
      CompileErrorCode.EXPECTED_THINGS,
      'Expect a variable or literal',
    );
  }

  private tupleExpression = this.contextStack.withContextDo(
    ParsingContext.GroupExpression,
    (synchronizationPoint) => {
      const elementList: NormalFormExpressionNode[] = [];
      const commaList: SyntaxToken[] = [];

      this.consume('Expect (', SyntaxTokenKind.LPAREN);
      const tupleOpenParen = this.previous();

      if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
        synchronizationPoint(
          () => elementList.push(this.normalFormExpression()),
          this.synchronizeTuple,
        );
      }
      while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
        synchronizationPoint(() => {
          this.consume('Expect ,', SyntaxTokenKind.COMMA);
          commaList.push(this.previous());
          elementList.push(this.normalFormExpression());
        }, this.synchronizeTuple);
      }

      synchronizationPoint(
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

  synchronizeTuple = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.kind === SyntaxTokenKind.RPAREN || token.kind === SyntaxTokenKind.COMMA) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private listExpression = this.contextStack.withContextDo(
    ParsingContext.ListExpression,
    (synchronizationPoint) => {
      const elementList: AttributeNode[] = [];
      const commaList: SyntaxToken[] = [];
      const separator = SyntaxTokenKind.COMMA;
      const closing = SyntaxTokenKind.RBRACKET;

      this.consume('Expect a [', SyntaxTokenKind.LBRACKET);
      const listOpenBracket = this.previous();

      if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
        elementList.push(this.attribute(closing, separator));
      }

      while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
        synchronizationPoint(() => {
          this.consume('Expect a ,', SyntaxTokenKind.COMMA);
          commaList.push(this.previous());
          elementList.push(this.attribute(closing, separator));
        }, this.synchronizeList);
      }

      synchronizationPoint(
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

  synchronizeList = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.kind === SyntaxTokenKind.COMMA || token.kind === SyntaxTokenKind.RBRACKET) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private attribute(
    closing: SyntaxTokenKind = SyntaxTokenKind.RBRACKET,
    separator: SyntaxTokenKind = SyntaxTokenKind.COMMA,
  ): AttributeNode {
    let valueOpenColon: SyntaxToken | undefined;
    let value: NormalFormExpressionNode | SyntaxToken[] | undefined;

    if (this.check(SyntaxTokenKind.COLON, closing, separator)) {
      const token = this.peek();
      this.logError(token, CompileErrorCode.INVALID, 'Expect a non-empty attribute name');
    }

    const name = this.attributeIdentifierStream(closing, separator);

    if (this.match(SyntaxTokenKind.COLON)) {
      valueOpenColon = this.previous();
      value = this.attributeValue(closing, separator);
    }

    return new AttributeNode({ name, valueOpenColon, value });
  }

  // Extract a stream of identifiers in the context of parsing attributes
  // e.g [primary key] -> id stream ["primary", "key"]
  // e.g [update: no action] -> id stream ["no", "action"]
  private attributeIdentifierStream(
    closing: SyntaxTokenKind,
    separator: SyntaxTokenKind,
  ): SyntaxToken[] {
    const stream: SyntaxToken[] = [];
    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.COLON, closing, separator)) {
      try {
        this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
        stream.push(this.previous());
      } catch (e) {
        this.tryRecoverFromInvalidTokenInAttribute(e, this.synchronizeAttributeName);
      }
    }

    return stream;
  }

  private attributeValue(
    closing: SyntaxTokenKind,
    separator: SyntaxTokenKind,
  ): NormalFormExpressionNode | SyntaxToken[] | undefined {
    if (
      this.peek().kind === SyntaxTokenKind.IDENTIFIER &&
      this.peek(1).kind === SyntaxTokenKind.IDENTIFIER
    ) {
      return this.attributeIdentifierStream(closing, separator);
    }
    try {
      return this.normalFormExpression();
    } catch (e) {
      this.tryRecoverFromInvalidTokenInAttribute(e, this.synchronizeAttributeValue);

      return undefined;
    }
  }

  // Throw on an unrecoverable invalid token
  // or synchronize on a recoverable one
  // when parsing attribute names or attribute values
  tryRecoverFromInvalidTokenInAttribute(e: unknown, recoverCallback: () => void): void {
    if (
      e instanceof CompileError &&
      e.value instanceof SyntaxToken &&
      // These types of invalid tokens are tolerable in attribute names & values
      // e.g ["name": 123], [123: 123] -> invalid attribute name, but tolerable
      // e.g ["name": 123 "abc"] -> invalid attribute value but tolerable, ignore the following ones
      // e.g [[abc]: [123]] -> Invalid and intolerable, rethrow the error to the upper methods
      (e.value.kind === SyntaxTokenKind.STRING_LITERAL ||
        e.value.kind === SyntaxTokenKind.NUMERIC_LITERAL ||
        e.value.kind === SyntaxTokenKind.FUNCTION_EXPRESSION ||
        e.value.kind === SyntaxTokenKind.QUOTED_STRING)
    ) {
      recoverCallback();
    } else {
      throw e;
    }
  }

  synchronizeAttributeName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (
        token.kind === SyntaxTokenKind.COMMA ||
        token.kind === SyntaxTokenKind.RBRACKET ||
        token.kind === SyntaxTokenKind.COLON
      ) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  synchronizeAttributeValue = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.kind === SyntaxTokenKind.COMMA || token.kind === SyntaxTokenKind.RBRACKET) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private canBeField() {
    return (
      this.peek().kind === SyntaxTokenKind.IDENTIFIER && this.peek(1).kind === SyntaxTokenKind.COLON
    );
  }

  private isAtEndOfLine(token: SyntaxToken): boolean {
    return this.hasTrailingNewLines(token) || this.peek().kind === SyntaxTokenKind.EOF;
  }

  private hasTrailingNewLines(token: SyntaxToken): boolean {
    return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;
  }

  private isAtStartOfLine(previous: SyntaxToken, token: SyntaxToken): boolean {
    const hasLeadingNewLines =
      token.leadingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;

    return hasLeadingNewLines || this.hasTrailingNewLines(previous);
  }

  private hasTrailingSpaces(token: SyntaxToken): boolean {
    return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.SPACE) !== undefined;
  }

  // This method is expected to called when the error is resolved
  private logError(tokenOrNode: SyntaxToken | SyntaxNode, code: CompileErrorCode, message: string) {
    this.invalid.push(tokenOrNode);
    if (tokenOrNode instanceof SyntaxToken) {
      this.errors.push(this.generateTokenError(tokenOrNode, code, message));
    } else {
      this.errors.push(this.generateNodeError(tokenOrNode, code, message));
    }
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
        this.generateTokenError(tokenOrNode, code, message) :
        this.generateNodeError(tokenOrNode, code, message);
    this.errors.push(e);
    throw e;
  }

  private generateTokenError(
    token: SyntaxToken,
    code: CompileErrorCode,
    message: string,
  ): CompileError {
    return new CompileError(code, message, token.offset, token.offset + token.length, token);
  }

  private generateNodeError(
    node: SyntaxNode,
    code: CompileErrorCode,
    message: string,
  ): CompileError {
    return new CompileError(code, message, node.start, node.end, node);
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
