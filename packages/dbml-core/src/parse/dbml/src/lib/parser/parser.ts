import {
  canBuildAttributeNode,
  convertFuncAppToElem,
  isAsKeyword,
  isInvalidToken,
  markInvalid,
} from './utils';
import { CompileError, CompileErrorCode } from '../errors';
import { SyntaxToken, SyntaxTokenKind, isOpToken } from '../lexer/tokens';
import Report from '../report';
import { ParsingContext, ParsingContextStack } from './contextStack';
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
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  NormalExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  SyntaxNodeIdGenerator,
  TupleExpressionNode,
  VariableNode,
} from './nodes';
import NodeFactory from './factory';

export default class Parser {
  private tokens: SyntaxToken[];

  private current: number = 0;

  private errors: CompileError[] = []; // A list of errors during parsing

  // Keep track of which context we're parsing in
  private contextStack: ParsingContextStack = new ParsingContextStack();

  private nodeFactory: NodeFactory;

  constructor(tokens: SyntaxToken[], nodeIdGenerator: SyntaxNodeIdGenerator) {
    this.tokens = tokens;
    this.nodeFactory = new NodeFactory(nodeIdGenerator);
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
      markInvalid(this.peek());
      this.logError(this.advance(), CompileErrorCode.UNEXPECTED_TOKEN, message);
      while (!this.isAtEnd() && !this.check(...kind)) {
        markInvalid(this.advance());
      }

      return false;
    }

    return true;
  }

  private markInvalidFrom(start: number) {
    for (let i = start; i < this.current; i += 1) {
      markInvalid(this.tokens[i]);
    }
  }

  // Call a node parsing callback
  // If an error occurs, `this.contextStack.synchronizeHook`
  // will determine the appropriate ParsingContext to handle the error
  // If the current context is the one capable
  // mark all pending tokens as invalid - the one from which we started parsing this node
  // and then synchronize
  private synchronize(parsingCallback: () => void, synchronizeCallback: () => void) {
    const start = this.current;
    this.contextStack.synchronizeHook(parsingCallback, () => {
      this.markInvalidFrom(start);
      synchronizeCallback();
    });
  }

  gatherInvalid() {
    let i;

    const leadingInvalidList: SyntaxToken[] = [];
    for (i = 0; i < this.tokens.length && isInvalidToken(this.tokens[i]); i += 1) {
      leadingInvalidList.push(this.tokens[i]);
    }

    let prevValidToken = this.tokens[i];
    prevValidToken.leadingTrivia = [...leadingInvalidList, ...prevValidToken.leadingTrivia];

    for (i += 1; i < this.tokens.length; i += 1) {
      const token = this.tokens[i];
      if (token.kind === SyntaxTokenKind.INVALID) {
        prevValidToken.trailingTrivia.push(token);
      } else {
        prevValidToken = token;
      }
    }
  }

  parse(): Report<ProgramNode, CompileError> {
    const body = this.program();
    const eof = this.advance();
    const program = this.nodeFactory.create(ProgramNode, { body, eof });
    this.gatherInvalid();

    return new Report(program, this.errors);
  }

  /* Parsing and synchronizing ProgramNode */

  private program() {
    const body: ElementDeclarationNode[] = [];
    while (!this.isAtEnd()) {
      this.synchronize(() => body.push(this.elementDeclaration()), this.synchronizeProgram);
    }

    return body;
  }

  private synchronizeProgram = () => {
    const invalidToken = this.peek();
    if (invalidToken.kind !== SyntaxTokenKind.EOF) {
      markInvalid(this.advance());
    } else {
      markInvalid(this.peek());
      this.logError(invalidToken, CompileErrorCode.UNEXPECTED_EOF, 'Unexpected EOF');
    }
  };

  /* Parsing and synchronizing top-level ElementDeclarationNode */

  private elementDeclaration() {
    this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
    const type = this.previous();

    const name = this.elementDeclarationName();
    const { as, alias } = this.elementDeclarationAlias();
    const attributeList = this.check(SyntaxTokenKind.LBRACKET) ? this.listExpression() : undefined;

    this.discardUntil(
      "Expect an opening brace '{' or a colon ':'",
      SyntaxTokenKind.LBRACE,
      SyntaxTokenKind.COLON,
    );
    const { bodyColon, body } = this.elementDeclarationBody();

    return this.nodeFactory.create(ElementDeclarationNode, {
      type,
      name,
      as,
      alias,
      attributeList,
      bodyColon,
      body,
    });
  }

  private elementDeclarationName(): NormalExpressionNode | undefined {
    let name: NormalExpressionNode | undefined;
    if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
      this.synchronize(
        // eslint-disable-next-line no-return-assign
        () => (name = this.normalExpression()),
        this.synchronizeElementDeclarationName,
      );
    }

    return name;
  }

  private synchronizeElementDeclarationName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (
        isAsKeyword(token) ||
        this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)
      ) {
        break;
      }
      markInvalid(token);
      this.advance();
    }
  };

  private elementDeclarationAlias(): {
    as?: SyntaxToken;
    alias?: NormalExpressionNode;
  } {
    let as: SyntaxToken | undefined;
    let alias: NormalExpressionNode | undefined;

    if (isAsKeyword(this.peek())) {
      as = this.advance();
      if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
        this.synchronize(
          // eslint-disable-next-line no-return-assign
          () => (alias = this.normalExpression()),
          this.synchronizeElementDeclarationAlias,
        );
      }
    }

    return { as, alias };
  }

  private synchronizeElementDeclarationAlias = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
        break;
      }
      markInvalid(token);
      this.advance();
    }
  };

  private elementDeclarationBody(): { bodyColon?: SyntaxToken; body: ExpressionNode } {
    let body: ExpressionNode | BlockExpressionNode | undefined;
    let bodyColon: SyntaxToken | undefined;

    if (this.match(SyntaxTokenKind.COLON)) {
      bodyColon = this.previous();
      body = this.expression();
    } else {
      body = this.blockExpression();
    }

    return {
      bodyColon,
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
    this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
    const type = this.previous();
    this.consume("Expect a colon ':'", SyntaxTokenKind.COLON);
    const bodyColon = this.previous();
    const body = this.expression();

    return this.nodeFactory.create(ElementDeclarationNode, {
      type,
      bodyColon,
      body,
    });
  }

  /* Parsing any ExpressionNode, including non-NormalExpression */

  private expression(): ExpressionNode {
    // Since function application expression is the most generic form
    // by default, we'll interpret any expression as a function application
    const callee: NormalExpressionNode = this.normalExpression();
    const args: NormalExpressionNode[] = [];

    // If there are newlines after the callee, then it's a simple expression
    // such as a PrefixExpression, InfixExpression, ...
    // e.g
    // indexes {
    //   (id, `id * 2`)
    // }
    // Note {
    //   'This is a note'
    // }
    if (this.shouldStopExpression()) {
      return callee;
    }

    let prevNode = callee;

    while (!this.isAtEnd() && !this.shouldStopExpression()) {
      if (!this.hasTrailingSpaces(this.previous())) {
        this.logError(prevNode, CompileErrorCode.MISSING_SPACES, 'Expect a following space');
      }
      prevNode = this.normalExpression();
      args.push(prevNode);
    }

    // Try interpreting the function application as an element declaration expression
    // if fail, fall back to the generic function application
    return convertFuncAppToElem(callee, args, this.nodeFactory).unwrap_or(
      this.nodeFactory.create(FunctionApplicationNode, { callee, args }),
    );
  }

  private shouldStopExpression() {
    if (this.hasTrailingNewLines(this.previous())) {
      return true;
    }

    const nextTokenKind = this.peek().kind;

    return (
      nextTokenKind === SyntaxTokenKind.RBRACE ||
      nextTokenKind === SyntaxTokenKind.RBRACKET ||
      nextTokenKind === SyntaxTokenKind.RPAREN ||
      nextTokenKind === SyntaxTokenKind.COMMA ||
      nextTokenKind === SyntaxTokenKind.COLON
    );
  }

  private normalExpression(): NormalExpressionNode {
    return this.expression_bp(0);
  }

  // Pratt's parsing algorithm
  private expression_bp(mbp: number): NormalExpressionNode {
    let leftExpression: NormalExpressionNode | undefined;

    if (isOpToken(this.peek())) {
      const prefixOp = this.peek();
      const opPrefixPower = prefixBindingPower(prefixOp);

      if (opPrefixPower.right === null) {
        this.logAndThrowError(
          prefixOp,
          CompileErrorCode.UNKNOWN_PREFIX_OP,
          `Unexpected prefix '${prefixOp.value}' in an expression`,
        );
      }

      this.advance();
      const prefixExpression = this.expression_bp(opPrefixPower.right);
      leftExpression = this.nodeFactory.create(PrefixExpressionNode, {
        op: prefixOp,
        expression: prefixExpression,
      });
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
        leftExpression = this.nodeFactory.create(CallExpressionNode, {
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
          leftExpression = this.nodeFactory.create(PostfixExpressionNode, {
            expression: leftExpression!,
            op,
          });
        } else {
          const opInfixPower = infixBindingPower(op);
          if (opInfixPower.left === null || opInfixPower.left <= mbp) {
            break;
          }
          this.advance();
          const rightExpression = this.expression_bp(opInfixPower.right);
          leftExpression = this.nodeFactory.create(InfixExpressionNode, {
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

    return this.nodeFactory.create(FunctionExpressionNode, { value: this.previous() });
  }

  /* Parsing and synchronizing BlockExpression */

  private blockExpression = this.contextStack.withContextDo(ParsingContext.BlockExpression, () => {
    const body: ExpressionNode[] = [];

    this.consume("Expect an opening brace '{'", SyntaxTokenKind.LBRACE);
    const blockOpenBrace = this.previous();
    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACE)) {
      if (this.canBeField()) {
        body.push(this.fieldDeclaration());
      } else {
        this.synchronize(() => body.push(this.expression()), this.synchronizeBlock);
      }
    }
    this.consume("Expect a closing brace '}'", SyntaxTokenKind.RBRACE);
    const blockCloseBrace = this.previous();

    return this.nodeFactory.create(BlockExpressionNode, { blockOpenBrace, body, blockCloseBrace });
  });

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
    markInvalid(this.advance());
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.RBRACE) || this.isAtStartOfLine(this.previous(), token)) {
        break;
      }
      markInvalid(token);
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
      return this.nodeFactory.create(PrimaryExpressionNode, {
        expression: this.nodeFactory.create(LiteralNode, { literal: this.previous() }),
      });
    }

    // Primary expression containing a nested VariableNode
    if (this.match(SyntaxTokenKind.QUOTED_STRING, SyntaxTokenKind.IDENTIFIER)) {
      return this.nodeFactory.create(PrimaryExpressionNode, {
        expression: this.nodeFactory.create(VariableNode, { variable: this.previous() }),
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

  private tupleExpression = this.contextStack.withContextDo(ParsingContext.GroupExpression, () => {
    const elementList: NormalExpressionNode[] = [];
    const commaList: SyntaxToken[] = [];

    this.consume("Expect an opening parenthese '('", SyntaxTokenKind.LPAREN);
    const tupleOpenParen = this.previous();

    if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
      this.synchronize(() => elementList.push(this.normalExpression()), this.synchronizeTuple);
    }

    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
      this.synchronize(() => {
        this.consume("Expect a comma ','", SyntaxTokenKind.COMMA);
        commaList.push(this.previous());
        elementList.push(this.normalExpression());
      }, this.synchronizeTuple);
    }

    this.synchronize(
      () => this.consume("Expect a closing parenthese ')'", SyntaxTokenKind.RPAREN),
      this.synchronizeTuple,
    );

    const tupleCloseParen = this.previous();

    if (elementList.length === 1) {
      return this.nodeFactory.create(GroupExpressionNode, {
        groupOpenParen: tupleOpenParen,
        expression: elementList[0],
        groupCloseParen: tupleCloseParen,
      });
    }

    return this.nodeFactory.create(TupleExpressionNode, {
      tupleOpenParen,
      elementList,
      commaList,
      tupleCloseParen,
    });
  });

  private synchronizeTuple = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.RPAREN, SyntaxTokenKind.COMMA)) {
        break;
      }
      markInvalid(token);
      this.advance();
    }
  };

  /* Parsing and synchronizing ListExpression */

  private listExpression = this.contextStack.withContextDo(ParsingContext.ListExpression, () => {
    this.consume("Expect a closing bracket '['", SyntaxTokenKind.LBRACKET);
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
      this.synchronize(() => {
        this.consume("Expect a comma ','", SyntaxTokenKind.COMMA);
        commaList.push(this.previous());
        const attribute = this.attribute();
        if (attribute) {
          elementList.push(attribute);
        }
      }, this.synchronizeList);
    }

    this.synchronize(
      () => this.consume("Expect a closing bracket ']'", SyntaxTokenKind.RBRACKET),
      this.synchronizeList,
    );
    const listCloseBracket = this.previous();

    return this.nodeFactory.create(ListExpressionNode, {
      listOpenBracket,
      elementList,
      commaList,
      listCloseBracket,
    });
  });

  private synchronizeList = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET)) {
        break;
      }
      markInvalid(token);
      this.advance();
    }
  };

  private attribute(): AttributeNode | undefined {
    let name: IdentiferStreamNode | undefined;
    if (this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.RBRACKET, SyntaxTokenKind.COMMA)) {
      const token = this.peek();
      this.logError(
        token,
        CompileErrorCode.EMPTY_ATTRIBUTE_NAME,
        'Expect a non-empty attribute name',
      );
    } else {
      name = this.attributeName();
    }

    let colon: SyntaxToken | undefined;
    let value: NormalExpressionNode | IdentiferStreamNode | undefined;
    if (this.match(SyntaxTokenKind.COLON)) {
      colon = this.previous();
      value = this.attributeValue();
    }

    if (!canBuildAttributeNode(name, colon, value)) {
      markInvalid(name);
      markInvalid(colon);
      markInvalid(value);

      return undefined;
    }

    return this.nodeFactory.create(AttributeNode, { name, colon, value });
  }

  private attributeName(): IdentiferStreamNode | undefined {
    let name: IdentiferStreamNode | undefined;
    this.synchronize(() => {
      name = this.extractIdentifierStream();
    }, this.synchronizeAttributeName);

    return name;
  }

  private synchronizeAttributeName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET, SyntaxTokenKind.COLON)) {
        break;
      }
      markInvalid(token);
      this.advance();
    }
  };

  private attributeValue(): NormalExpressionNode | IdentiferStreamNode | undefined {
    let value: NormalExpressionNode | IdentiferStreamNode | undefined;
    this.synchronize(() => {
      if (
        this.peek().kind === SyntaxTokenKind.IDENTIFIER &&
        this.peek(1).kind === SyntaxTokenKind.IDENTIFIER
      ) {
        value = this.extractIdentifierStream();
      } else {
        value = this.normalExpression();
      }
    }, this.synchronizeAttributeValue);

    return value;
  }

  private synchronizeAttributeValue = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (this.check(SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET)) {
        break;
      }
      markInvalid(token);
      this.advance();
    }
  };

  private extractIdentifierStream(): IdentiferStreamNode | undefined {
    const identifiers: SyntaxToken[] = [];
    while (
      !this.isAtEnd() &&
      !this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET)
    ) {
      if (
        this.match(
          SyntaxTokenKind.QUOTED_STRING,
          SyntaxTokenKind.STRING_LITERAL,
          SyntaxTokenKind.NUMERIC_LITERAL,
        )
      ) {
        this.logError(this.previous(), CompileErrorCode.UNEXPECTED_TOKEN, 'Expect an identifier');
      } else {
        this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
        identifiers.push(this.previous());
      }
    }

    return identifiers.length === 0 ?
      undefined :
      this.nodeFactory.create(IdentiferStreamNode, { identifiers });
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

  private logError(nodeOrToken: SyntaxToken | SyntaxNode, code: CompileErrorCode, message: string) {
    this.errors.push(new CompileError(code, message, nodeOrToken));
  }

  private logAndThrowError(
    nodeOrToken: SyntaxToken | SyntaxNode,
    code: CompileErrorCode,
    message: string,
  ): never {
    const e = new CompileError(code, message, nodeOrToken);
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
