import { ParsingError, ParsingErrorCode } from '../errors';
import { SyntaxToken, SyntaxTokenKind, isOpToken } from '../lexer/tokens';
import Result from '../result';
import { ParsingContext, ParsingContextStack } from './contextStack';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FieldDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  GroupExpressionNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralElementExpressionNode,
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

  private errors: ParsingError[] = [];

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
    this.contextStack = new ParsingContextStack();
  }

  private advance(): SyntaxToken {
    return this.tokens[this.current++];
  }

  private peek(lookahead: number = 0): SyntaxToken | undefined {
    if (lookahead + this.current >= this.tokens.length) {
      return undefined;
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
    if (!currentToken) {
      return false;
    }

    return kind.includes(currentToken.kind);
  }

  private previous(): SyntaxToken {
    return this.tokens[this.current - 1];
  }

  private consume(message: string, ...kind: SyntaxTokenKind[]) {
    if (!this.match(...kind)) {
      const invalidToken = this.peek()!;
      const error = new ParsingError(
        ParsingErrorCode.EXPECTED_THINGS,
        message,
        invalidToken.offset,
        invalidToken.offset + invalidToken.length,
        invalidToken,
      );
      this.invalid.push(invalidToken);
      this.errors.push(error);
      throw error;
    }
  }

  parse(): Result<SyntaxNode & { kind: SyntaxNodeKind.PROGRAM }> {
    const body: ElementDeclarationNode[] = [];

    this.init();

    while (this.peek() && this.peek()?.kind !== SyntaxTokenKind.EOF) {
      try {
        body.push(this.elementDeclaration());
      } catch (e) {
        if (!(e instanceof ParsingError)) {
          throw e;
        }
        if (!(this.peek()?.kind === SyntaxTokenKind.EOF)) {
          this.invalid.push(this.advance());
        } else {
          const eof = this.peek()!;
          this.invalid.push(eof);
          this.errors.push(
            this.generateTokenError(eof, ParsingErrorCode.INVALID, 'Unexpected EOF'),
          );
        }
      }
    }

    const eof = this.advance();
    const program = new ProgramNode({ body, eof, invalid: this.invalid });

    return new Result(program, this.errors);
  }

  private elementDeclaration(): ElementDeclarationNode {
    this.consume('Expect identifier', SyntaxTokenKind.IDENTIFIER);
    const type = this.previous();
    let name: NormalFormExpressionNode | undefined;
    let as: SyntaxToken | undefined;
    let alias: NormalFormExpressionNode | undefined;

    if (
      this.peek()?.kind !== SyntaxTokenKind.COLON &&
      this.peek()?.kind !== SyntaxTokenKind.LBRACE
    ) {
      try {
        name = this.normalFormExpression();
      } catch (e) {
        if (e instanceof ParsingError) {
          this.synchronizeElementDeclarationName();
        } else {
          throw e;
        }
      }

      const nextWord = this.peek();
      if (nextWord?.kind === SyntaxTokenKind.IDENTIFIER && nextWord?.value === 'as') {
        as = this.advance();
        try {
          alias = this.normalFormExpression();
        } catch (e) {
          if (e instanceof ParsingError) {
            this.synchronizeElementDeclarationAlias();
          } else {
            throw e;
          }
        }
      }
    }

    let attributeList: ListExpressionNode | undefined;
    if (this.check(SyntaxTokenKind.LBRACKET)) {
      attributeList = this.listExpression();
    }

    let body: ExpressionNode | BlockExpressionNode | undefined;
    let bodyOpenColon: SyntaxToken | undefined;

    if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE)) {
      const token = this.peek()!;
      this.invalid.push(token);
      this.errors.push(
        this.generateTokenError(token, ParsingErrorCode.EXPECTED_THINGS, 'Expect { or :'),
      );
      while (!this.isAtEnd() && !this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE)) {
        this.advance();
      }
    }

    if (this.match(SyntaxTokenKind.COLON)) {
      bodyOpenColon = this.previous();
      body = this.normalFormExpression();
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
  }

  synchronizeElementDeclarationName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek()!;
      if (
        (token.kind === SyntaxTokenKind.IDENTIFIER && token.value === 'as') ||
        token.kind === SyntaxTokenKind.LBRACE ||
        token.kind === SyntaxTokenKind.COLON
      ) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  synchronizeElementDeclarationAlias = () => {
    while (!this.isAtEnd()) {
      const token = this.peek()!;
      if (token.kind === SyntaxTokenKind.LBRACE || token.kind === SyntaxTokenKind.COLON) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  synchronizeElementDeclarationBody = () => {
    while (!this.isAtEnd()) {
      const token = this.peek()!;
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

  private fieldDeclaration(): FieldDeclarationNode {
    this.consume('Expect identifier', SyntaxTokenKind.IDENTIFIER);
    const name = this.previous();
    this.consume('Expect :', SyntaxTokenKind.COLON);
    const valueOpenColon = this.previous();
    const value = this.normalFormExpression();
    let attributeList: ListExpressionNode | undefined;
    if (this.check(SyntaxTokenKind.LBRACKET)) {
      attributeList = this.listExpression();
    }

    return new FieldDeclarationNode({
      name,
      valueOpenColon,
      value,
      attributeList,
    });
  }

  private expression(): ExpressionNode {
    const args: ExpressionNode[] = [];

    const callee: ExpressionNode = this.normalFormExpression();

    if (this.hasTrailingNewLines(this.previous())) {
      return callee;
    }

    let previousComponent: ExpressionNode = callee;
    let previousToken = this.previous();

    while (!this.isAtEnd() && !this.hasTrailingNewLines(previousToken)) {
      if (!this.hasTrailingSpaces(previousToken)) {
        this.invalid.push(previousComponent);
        this.errors.push(
          this.generateNodeError(
            previousComponent,
            ParsingErrorCode.EXPECTED_THINGS,
            'Expect a following space',
          ),
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
    args: ExpressionNode[],
  ): LiteralElementExpressionNode | undefined {
    if (
      args.length === 2 &&
      args[0] instanceof ListExpressionNode &&
      args[1] instanceof BlockExpressionNode
    ) {
      return new LiteralElementExpressionNode({
        type: callee,
        attributeList: args[0],
        body: args[1],
      });
    }
    if (args.length === 1 && args[0] instanceof BlockExpressionNode) {
      return new LiteralElementExpressionNode({ type: callee, body: args[0] });
    }

    return undefined;
  }

  private normalFormExpression(): NormalFormExpressionNode {
    const expression = this.expression_bp(0);

    return expression;
  }

  private expression_bp(mbp: number): NormalFormExpressionNode {
    let leftExpression: NormalFormExpressionNode | undefined;

    if (isOpToken(this.peek()) && this.peek()!.kind !== SyntaxTokenKind.LPAREN) {
      const prefixOp = this.peek()!;
      const opPrefixPower = prefixBindingPower(prefixOp);

      if (opPrefixPower.right === null) {
        const error = this.generateTokenError(
          prefixOp,
          ParsingErrorCode.UNEXPECTED_THINGS,
          `Unexpected prefix ${prefixOp.value} in an expression`,
        );
        this.invalid.push(prefixOp);
        this.errors.push(error);
        throw error;
      }

      this.advance();
      const prefixExpression = this.expression_bp(opPrefixPower.right);
      leftExpression = new PrefixExpressionNode({ op: prefixOp, expression: prefixExpression });
    } else {
      leftExpression = this.extractOperand();
    }

    while (!this.isAtEnd()) {
      const c = this.peek()!;
      if (!isOpToken(c)) {
        break;
      } else {
        const previousOp = this.previous();
        const op = c;
        const opPostfixPower = postfixBindingPower(op);

        if (opPostfixPower.left !== null) {
          if (opPostfixPower.left <= mbp) {
            break;
          }

          if (op.kind === SyntaxTokenKind.LPAREN) {
            if (
              this.isAtStartOfLine(previousOp, op) &&
              !this.contextStack.isWithinGroupExpressionContext() &&
              !this.contextStack.isWithinGroupExpressionContext()
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

    const token = this.peek()!;
    const error = this.generateTokenError(
      token,
      ParsingErrorCode.UNEXPECTED_THINGS,
      `Invalid start of operand "${token.value}"`,
    );
    this.invalid.push(token);
    this.errors.push(error);
    throw error;
  }

  private functionExpression(): FunctionExpressionNode {
    this.consume('Expect a function expression', SyntaxTokenKind.FUNCTION_EXPRESSION);

    return new FunctionExpressionNode({ value: this.previous() });
  }

  private blockExpression = this.contextStack.withContextDo(
    ParsingContext.BlockExpression,
    (synchronizationPoint) => {
      const body: (ExpressionNode | FieldDeclarationNode)[] = [];

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
    while (!this.isAtEnd()) {
      const token = this.peek()!;
      if (
        token.kind === SyntaxTokenKind.RBRACE ||
        this.isAtStartOfLine(this.previous(), token) ||
        token.kind === SyntaxTokenKind.RPAREN ||
        token.kind === SyntaxTokenKind.RBRACKET
      ) {
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
    const token = this.peek()!;
    const error = this.generateTokenError(
      token,
      ParsingErrorCode.EXPECTED_THINGS,
      'Expect a variable or literal',
    );
    this.invalid.push(token);
    this.errors.push(error);
    throw error;
  }

  private tupleExpression = this.contextStack.withContextDo(
    ParsingContext.GroupExpression,
    (synchronizationPoint) => {
      const elementList: NormalFormExpressionNode[] = [];
      const commaList: SyntaxToken[] = [];

      this.consume('Expect (', SyntaxTokenKind.LPAREN);
      const tupleOpenParen = this.previous();

      this.contextStack.push(ParsingContext.GroupExpression);

      if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
        elementList.push(this.normalFormExpression());
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

      this.contextStack.pop();

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
      const token = this.peek()!;
      if (
        token.kind === SyntaxTokenKind.RPAREN ||
        this.isAtStartOfLine(this.previous(), token) ||
        token.kind === SyntaxTokenKind.COMMA ||
        token.kind === SyntaxTokenKind.RBRACE ||
        token.kind === SyntaxTokenKind.RBRACKET
      ) {
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
      const token = this.peek()!;
      if (
        token.kind === SyntaxTokenKind.COMMA ||
        token.kind === SyntaxTokenKind.RBRACKET ||
        token.kind === SyntaxTokenKind.RBRACE ||
        token.kind === SyntaxTokenKind.RPAREN
      ) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private attribute(closing?: SyntaxTokenKind, separator?: SyntaxTokenKind): AttributeNode {
    const name: SyntaxToken[] = [];
    let valueOpenColon: SyntaxToken | undefined;
    let value: NormalFormExpressionNode | undefined;

    if (
      this.check(SyntaxTokenKind.COLON) ||
      (closing && separator && this.check(closing, separator))
    ) {
      const token = this.peek()!;
      this.invalid.push(token);
      this.errors.push(
        this.generateTokenError(
          token,
          ParsingErrorCode.INVALID,
          'Expect a non-empty attribute name',
        ),
      );
    }

    while (
      !this.isAtEnd() &&
      !this.check(SyntaxTokenKind.COLON) &&
      (!closing || !separator || !this.check(closing, separator))
    ) {
      try {
        this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
        name.push(this.previous());
      } catch (e) {
        if (
          !(e instanceof ParsingError) ||
          !(e.value instanceof SyntaxToken) ||
          (e.value.kind !== SyntaxTokenKind.STRING_LITERAL &&
            e.value.kind !== SyntaxTokenKind.NUMERIC_LITERAL &&
            e.value.kind !== SyntaxTokenKind.FUNCTION_EXPRESSION &&
            e.value.kind !== SyntaxTokenKind.QUOTED_STRING)
        ) {
          throw e;
        }
        this.synchronizeAttributeName();
      }
    }

    if (this.match(SyntaxTokenKind.COLON)) {
      valueOpenColon = this.previous();
      try {
        value = this.normalFormExpression();
      } catch (e) {
        if (
          !(e instanceof ParsingError) ||
          !(e.value instanceof SyntaxToken) ||
          (e.value.kind !== SyntaxTokenKind.STRING_LITERAL &&
            e.value.kind !== SyntaxTokenKind.NUMERIC_LITERAL &&
            e.value.kind !== SyntaxTokenKind.FUNCTION_EXPRESSION &&
            e.value.kind !== SyntaxTokenKind.QUOTED_STRING)
        ) {
          throw e;
        }
        this.synchronizeAttributeValue();
      }
    }

    return new AttributeNode({ name, valueOpenColon, value });
  }

  synchronizeAttributeName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek()!;
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
      const token = this.peek()!;
      if (token.kind === SyntaxTokenKind.COMMA || token.kind === SyntaxTokenKind.RBRACKET) {
        break;
      }
      this.invalid.push(token);
      this.advance();
    }
  };

  private canBeField() {
    return (
      this.peek()?.kind === SyntaxTokenKind.IDENTIFIER &&
      this.peek(1)?.kind === SyntaxTokenKind.COLON
    );
  }

  private isAtEndOfLine(token: SyntaxToken): boolean {
    return this.hasTrailingNewLines(token) || this.peek()?.kind === SyntaxTokenKind.EOF;
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

  private generateTokenError(
    token: SyntaxToken,
    code: ParsingErrorCode,
    message: string,
  ): ParsingError {
    return new ParsingError(code, message, token.offset, token.offset + token.length, token);
  }

  private generateNodeError(
    node: SyntaxNode,
    code: ParsingErrorCode,
    message: string,
  ): ParsingError {
    return new ParsingError(code, message, node.start, node.end, node);
  }
}

const infixBindingPowerMap: {
  [index: string]: { left: number; right: number } | undefined;
} = {
  [SyntaxTokenKind.CROSS]: { left: 9, right: 10 },
  [SyntaxTokenKind.ASTERISK]: { left: 11, right: 12 },
  [SyntaxTokenKind.MINUS]: { left: 9, right: 10 },
  [SyntaxTokenKind.FORWARDSLASH]: { left: 11, right: 12 },
  [SyntaxTokenKind.PERCENT]: { left: 11, right: 12 },
  [SyntaxTokenKind.LT]: { left: 7, right: 8 },
  [SyntaxTokenKind.LE]: { left: 7, right: 8 },
  [SyntaxTokenKind.GT]: { left: 7, right: 8 },
  [SyntaxTokenKind.GE]: { left: 7, right: 8 },
  [SyntaxTokenKind.EQUAL]: { left: 2, right: 3 },
  [SyntaxTokenKind.DOUBLE_EQUAL]: { left: 4, right: 5 },
  [SyntaxTokenKind.NOT_EQUAL]: { left: 4, right: 5 },
  [SyntaxTokenKind.DOT]: { left: 16, right: 17 },
};

function infixBindingPower(
  token: SyntaxToken,
): { left: null; right: null } | { left: number; right: number } {
  const power = infixBindingPowerMap[token.kind];

  return power || { left: null, right: null };
}

const prefixBindingPowerMap: {
  [index: string]: { left: null; right: number } | undefined;
} = {
  [SyntaxTokenKind.CROSS]: { left: null, right: 15 },
  [SyntaxTokenKind.MINUS]: { left: null, right: 15 },
  [SyntaxTokenKind.LT]: { left: null, right: 15 },
  [SyntaxTokenKind.GT]: { left: null, right: 15 },
  [SyntaxTokenKind.EXCLAMATION]: { left: null, right: 15 },
};

function prefixBindingPower(token: SyntaxToken): { left: null; right: null | number } {
  const power = prefixBindingPowerMap[token.kind];

  return power || { left: null, right: null };
}

const postfixBindingPowerMap: {
  [index: string]: { left: number; right: null } | undefined;
} = {
  [SyntaxTokenKind.LPAREN]: { left: 14, right: null },
};

function postfixBindingPower(token: SyntaxToken): { left: null | number; right: null } {
  const power = postfixBindingPowerMap[token.kind];

  return power || { left: null, right: null };
}
