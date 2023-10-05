import _ from 'lodash';
import {
  convertFuncAppToElem,
  createDummyOperand,
  isAsKeyword,
  isDummyOperand,
  markInvalid,
} from './utils';
import { CompileError, CompileErrorCode } from '../errors';
import { SyntaxToken, SyntaxTokenKind, isOpToken } from '../lexer/tokens';
import Report from '../report';
import { ParsingContext, ParsingContextStack } from './contextStack';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
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
import { hasTrailingNewLines, hasTrailingSpaces, isAtStartOfLine } from '../lexer/utils';

/* eslint-disable no-loop-func */

// A class of errors that represent a parsing failure and contain the node that was partially parsed
class PartialParsingError<T extends SyntaxNode | undefined> {
  partialNode: T;
  token: Readonly<SyntaxToken>;
  handlerContext: null | ParsingContext;

  constructor(token: Readonly<SyntaxToken>, partialNode: T, handlerContext: null | ParsingContext) {
    this.token = token;
    this.partialNode = partialNode;
    this.handlerContext = handlerContext;
  }
}

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
      return _.last(this.tokens)!; // The EOF
    }

    // eslint-disable-next-line no-plusplus
    return this.tokens[this.current++];
  }

  private peek(lookahead: number = 0): SyntaxToken {
    if (lookahead + this.current >= this.tokens.length) {
      return _.last(this.tokens)!; // The EOF
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

  private canHandle<T extends SyntaxNode>(e: PartialParsingError<T>): boolean {
    return e.handlerContext === null || e.handlerContext === this.contextStack.top();
  }

  private consume(message: string, ...kind: SyntaxTokenKind[]) {
    if (!this.match(...kind)) {
      this.logError(this.peek(), CompileErrorCode.UNEXPECTED_TOKEN, message);
      throw new PartialParsingError(
        this.peek(),
        undefined,
        this.contextStack.findHandlerContext(this.tokens, this.current),
      );
    }
  }

  private consumeReturn(message: string, ...kind: SyntaxTokenKind[]): SyntaxToken {
    this.consume(message, ...kind);

    return this.previous();
  }

  // Discard tokens until one of `kind` is found
  // If any tokens are discarded, the error message is logged
  // Return whether the token of one of the listed kinds are eventually reached
  private discardUntil(message: string, ...kind: SyntaxTokenKind[]): boolean {
    if (this.isAtEnd() || !this.check(...kind)) {
      markInvalid(this.peek());
      this.logError(this.advance(), CompileErrorCode.UNEXPECTED_TOKEN, message);
      while (!this.isAtEnd() && !this.check(...kind)) {
        markInvalid(this.advance());
      }

      return !this.isAtEnd();
    }

    return true;
  }

  private gatherInvalid() {
    const tokens: SyntaxToken[] = [];

    const firstInvalidList = [];
    let curValid: SyntaxToken | undefined;
    let i = 0;
    for (; i < this.tokens.length; i += 1) {
      if (this.tokens[i].isInvalid) {
        firstInvalidList.push(this.tokens[i]);
      } else {
        break;
      }
    }

    curValid = this.tokens[i];
    curValid.leadingInvalid = firstInvalidList;
    tokens.push(curValid);
    for (i += 1; i < this.tokens.length; i += 1) {
      const curToken = this.tokens[i];
      if (curToken.isInvalid) {
        curValid.trailingInvalid.push(curToken);
      } else {
        curValid = curToken;
        tokens.push(curValid);
      }
    }

    _.remove(this.tokens);
    this.tokens.push(...tokens);
  }

  // Invoke a parsing callback
  // If the parsing callback fails,
  // the node that was partially parsed (contained in the PartialParsingError)
  // will be passed to a partial-handler
  // If the current context can handle the error
  // we simply synchronize
  // otherwise, we wrap the partial in a PartialParsingError and throw to the upper contexts
  synchWrap<T extends SyntaxNode>(
    parsingCallback: () => void,
    handlePartial: (subPartial: unknown) => void,
    constructPartial: (subPartial: unknown) => T,
    synchronizeCallback?: () => void,
  ) {
    try {
      parsingCallback();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }

      if (!this.canHandle(e) || !synchronizeCallback) {
        handlePartial(e.partialNode);
        throw new PartialParsingError(e.token, constructPartial(e.partialNode), e.handlerContext);
      }

      synchronizeCallback();
      handlePartial(e.partialNode);
    }
  }

  // Invoke a parsing callback
  // Then invoke `assignCallback` with the value of the parsing callback
  // If the parsing callback fails,
  // `assignCallback` is invoked with the partial instead
  // Otherwise the same as `synchWrap`
  synchAssignWrap<T extends SyntaxNode, V>(
    parsingCallback: () => V,
    assignCallback: (value: V, isPartial: boolean) => void,
    constructPartial: (subPartial: V) => T,
    synchronizeCallback?: () => void,
  ) {
    try {
      // eslint-disable-next-line no-param-reassign
      assignCallback(parsingCallback(), false);
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }

      // eslint-disable-next-line no-param-reassign
      assignCallback(e.partialNode, true);

      if (!this.canHandle(e) || !synchronizeCallback) {
        throw new PartialParsingError(e.token, constructPartial(e.partialNode), e.handlerContext);
      }

      synchronizeCallback();
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
      try {
        const elem = this.elementDeclaration();
        body.push(elem);
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        body.push(e.partialNode);
        this.synchronizeProgram();
      }
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

  private elementDeclaration(): ElementDeclarationNode {
    const args: {
      type: SyntaxToken | undefined;
      name: NormalExpressionNode | undefined;
      as: SyntaxToken | undefined;
      alias: NormalExpressionNode | undefined;
      attributeList: ListExpressionNode | undefined;
      bodyColon: SyntaxToken | undefined;
      body: FunctionApplicationNode | BlockExpressionNode | ElementDeclarationNode | undefined;
    } = {} as any;
    const buildElement = () => this.nodeFactory.create(ElementDeclarationNode, args);

    this.synchAssignWrap(
      () => this.consumeReturn('Expect an identifier', SyntaxTokenKind.IDENTIFIER),
      (value) => {
        args.type = value;
      },
      buildElement,
    );

    if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
      this.synchAssignWrap(
        () => this.normalExpression(),
        (value) => {
          args.name = value;
        },
        buildElement,
        this.synchronizeElementDeclarationName,
      );
    }

    if (isAsKeyword(this.peek())) {
      args.as = this.advance();
      if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
        this.synchAssignWrap(
          () => this.normalExpression(),
          (value) => {
            args.alias = value;
          },
          buildElement,
          this.synchronizeElementDeclarationAlias,
        );
      } else {
        this.logError(this.peek(), CompileErrorCode.UNEXPECTED_TOKEN, 'Expect an alias');
      }
    }

    this.synchAssignWrap(
      () => (this.check(SyntaxTokenKind.LBRACKET) ? this.listExpression() : undefined),
      (value) => {
        args.attributeList = value;
      },
      buildElement,
    );

    if (
      !this.discardUntil(
        "Expect an opening brace '{' or a colon ':'",
        SyntaxTokenKind.LBRACE,
        SyntaxTokenKind.COLON,
      )
    ) {
      return buildElement();
    }

    if (this.match(SyntaxTokenKind.COLON)) {
      args.bodyColon = this.previous();
      this.synchAssignWrap(
        () => this.expression(),
        (value) => {
          args.body = value;
        },
        buildElement,
      );
    } else {
      this.synchAssignWrap(
        () => this.blockExpression(),
        (value) => {
          args.body = value;
        },
        buildElement,
      );
    }

    return this.nodeFactory.create(ElementDeclarationNode, args);
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

  /* Parsing nested element declarations with simple body */

  // e.g
  // ```
  //  Table Users {
  //    Note: 'This is a note'  // fieldDeclaration() handles this
  //  }
  private fieldDeclaration(): ElementDeclarationNode {
    const args: {
      type: SyntaxToken | undefined;
      name: NormalExpressionNode | undefined;
      bodyColon: SyntaxToken | undefined;
      body: FunctionApplicationNode | ElementDeclarationNode | undefined;
    } = {} as any;
    const buildElement = () => this.nodeFactory.create(ElementDeclarationNode, args);

    this.synchAssignWrap(
      () => this.consumeReturn('Expect an identifier', SyntaxTokenKind.IDENTIFIER),
      (value) => {
        args.type = value;
      },
      buildElement,
    );
    this.synchAssignWrap(
      () => this.consumeReturn("Expect a colon ':'", SyntaxTokenKind.COLON),
      (value) => {
        args.bodyColon = value;
      },
      buildElement,
    );
    this.synchAssignWrap(
      () => this.expression(),
      (value) => {
        args.body = value;
      },
      buildElement,
    );

    return this.nodeFactory.create(ElementDeclarationNode, args);
  }

  /* Parsing any ExpressionNode, including non-NormalExpression */

  private expression(): FunctionApplicationNode | ElementDeclarationNode {
    // Since function application expression is the most generic form
    // by default, we'll interpret any expression as a function application
    const args: {
      callee: NormalExpressionNode | undefined;
      args: NormalExpressionNode[];
    } = { args: [] } as any;

    // Try interpreting the function application as an element declaration expression
    // if fail, fall back to the generic function application
    const buildExpression = () =>
      convertFuncAppToElem(args.callee, args.args, this.nodeFactory).unwrap_or(
        this.nodeFactory.create(FunctionApplicationNode, args),
      );

    this.synchAssignWrap(
      () => this.normalExpression(),
      (value) => {
        args.callee = value;
      },
      buildExpression,
    );

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
      return buildExpression();
    }

    let prevNode = args.callee!;
    while (!this.shouldStopExpression()) {
      if (!hasTrailingSpaces(this.previous())) {
        this.logError(prevNode, CompileErrorCode.MISSING_SPACES, 'Expect a following space');
      }

      this.synchAssignWrap(
        () => this.normalExpression(),
        (value) => {
          prevNode = value;
          args.args.push(prevNode);
        },
        buildExpression,
      );
    }

    return buildExpression();
  }

  private shouldStopExpression(): boolean {
    if (this.isAtEnd() || hasTrailingNewLines(this.previous())) {
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
    let leftExpression: NormalExpressionNode = this.leftExpression_bp();

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
          isAtStartOfLine(this.previous(), token) &&
          !this.contextStack.isWithinGroupExpressionContext() &&
          !this.contextStack.isWithinListExpressionContext()
        ) {
          break;
        }
        this.synchAssignWrap(
          () => this.tupleExpression(),
          (value) => {
            leftExpression = this.nodeFactory.create(CallExpressionNode, {
              callee: leftExpression,
              argumentList: value,
            });
          },
          () => leftExpression,
        );
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
          this.synchAssignWrap(
            () =>
              (op.value === '.' ? this.extractOperand() : this.expression_bp(opInfixPower.right)),
            (value) => {
              leftExpression = this.nodeFactory.create(InfixExpressionNode, {
                leftExpression: leftExpression!,
                op,
                rightExpression: value,
              });
            },
            () => leftExpression,
          );
        }
      }
    }

    return leftExpression;
  }

  private leftExpression_bp(): NormalExpressionNode {
    let leftExpression: NormalExpressionNode | undefined;

    if (isOpToken(this.peek())) {
      const args: {
        op: SyntaxToken | undefined;
        expression: NormalExpressionNode | undefined;
      } = {} as any;

      args.op = this.peek();
      const opPrefixPower = prefixBindingPower(args.op);

      if (opPrefixPower.right === null) {
        this.logError(
          args.op,
          CompileErrorCode.UNKNOWN_PREFIX_OP,
          `Unexpected '${args.op.value}' in an expression`,
        );

        this.throwDummyOperand(args.op);
      }
      this.advance();

      this.synchAssignWrap(
        () => this.expression_bp(opPrefixPower.right as number),
        (value) => {
          args.expression = value;
        },
        () => this.nodeFactory.create(PrefixExpressionNode, args),
      );

      leftExpression = this.nodeFactory.create(PrefixExpressionNode, args);
    } else {
      leftExpression = this.extractOperand();
      if (isDummyOperand(leftExpression)) {
        this.throwDummyOperand(this.peek());
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
    this.logError(
      this.peek(),
      CompileErrorCode.INVALID_OPERAND,
      `Invalid start of operand "${this.peek().value}"`,
    );

    return createDummyOperand(this.nodeFactory);
  }

  private throwDummyOperand(token: SyntaxToken): never {
    throw new PartialParsingError(
      token,
      createDummyOperand(this.nodeFactory),
      this.contextStack.findHandlerContext(this.tokens, this.current),
    );
  }

  /* Parsing FunctionExpression */

  private functionExpression(): FunctionExpressionNode {
    const args: { value: SyntaxToken | undefined } = { value: undefined };
    this.synchAssignWrap(
      () => this.consumeReturn('Expect a function expression', SyntaxTokenKind.FUNCTION_EXPRESSION),
      (value) => {
        args.value = value;
      },
      () => this.nodeFactory.create(FunctionExpressionNode, args),
    );

    return this.nodeFactory.create(FunctionExpressionNode, args);
  }

  /* Parsing and synchronizing BlockExpression */

  private blockExpression = this.contextStack.withContextDo(ParsingContext.BlockExpression, () => {
    const args: {
      blockOpenBrace: SyntaxToken | undefined;
      body: (ElementDeclarationNode | FunctionApplicationNode)[];
      blockCloseBrace: SyntaxToken | undefined;
    } = { body: [] } as any;
    const buildBlock = () => this.nodeFactory.create(BlockExpressionNode, args);

    this.synchAssignWrap(
      () => this.consumeReturn("Expect an opening brace '{'", SyntaxTokenKind.LBRACE),
      (value) => {
        args.blockOpenBrace = value;
      },
      buildBlock,
      this.synchronizeBlock,
    );

    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACE)) {
      this.synchAssignWrap(
        () => (this.canBeField() ? this.fieldDeclaration() : this.expression()),
        (value) => args.body.push(value),
        buildBlock,
        this.synchronizeBlock,
      );
    }

    this.synchAssignWrap(
      () => this.consumeReturn("Expect a closing brace '}'", SyntaxTokenKind.RBRACE),
      (value) => {
        args.blockCloseBrace = value;
      },
      buildBlock,
      this.synchronizeBlock,
    );

    return buildBlock();
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
      if (this.check(SyntaxTokenKind.RBRACE) || isAtStartOfLine(this.previous(), token)) {
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

    this.logError(this.peek(), CompileErrorCode.UNEXPECTED_TOKEN, 'Expect a variable or literal');

    throw new PartialParsingError(
      this.peek(),
      this.nodeFactory.create(PrimaryExpressionNode, {
        expression: this.nodeFactory.create(VariableNode, {}),
      }),
      this.contextStack.findHandlerContext(this.tokens, this.current),
    );
  }

  /* Parsing and synchronizing TupleExpression */

  private tupleExpression = this.contextStack.withContextDo(ParsingContext.GroupExpression, () => {
    const args: {
      tupleOpenParen: SyntaxToken | undefined;
      elementList: NormalExpressionNode[];
      commaList: SyntaxToken[];
      tupleCloseParen: SyntaxToken | undefined;
    } = { elementList: [], commaList: [] } as any;
    const buildGroup = () =>
      this.nodeFactory.create(GroupExpressionNode, {
        groupOpenParen: args.tupleOpenParen,
        groupCloseParen: args.tupleCloseParen,
        expression: args.elementList[0],
      });
    const buildTuple = () => this.nodeFactory.create(TupleExpressionNode, args);

    this.synchAssignWrap(
      () => this.consumeReturn("Expect an opening parenthesis '('", SyntaxTokenKind.LPAREN),
      (value) => {
        args.tupleOpenParen = value;
      },
      buildTuple,
      this.synchronizeTuple,
    );

    if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
      this.synchAssignWrap(
        () => this.normalExpression(),
        (value) => args.elementList.push(value),
        buildGroup,
        this.synchronizeTuple,
      );
    }

    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
      this.synchWrap(
        () => {
          args.commaList.push(this.consumeReturn("Expect a comma ','", SyntaxTokenKind.COMMA));
          args.elementList.push(this.normalExpression());
        },
        (partial: unknown) => {
          if (partial instanceof SyntaxNode) {
            args.elementList.push(partial);
          }
        },
        buildTuple,
        this.synchronizeTuple,
      );
    }

    this.synchAssignWrap(
      () => this.consumeReturn("Expect a closing parenthesis '('", SyntaxTokenKind.RPAREN),
      (value) => {
        args.tupleCloseParen = value;
      },
      buildTuple,
      this.synchronizeTuple,
    );

    return args.elementList.length === 1 ? buildGroup() : buildTuple();
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
    const args: {
      listOpenBracket: SyntaxToken | undefined;
      elementList: AttributeNode[];
      commaList: SyntaxToken[];
      listCloseBracket: SyntaxToken | undefined;
    } = { elementList: [], commaList: [] } as any;
    const buildList = () => this.nodeFactory.create(ListExpressionNode, args);

    this.synchAssignWrap(
      () => this.consumeReturn("Expect a closing bracket '['", SyntaxTokenKind.LBRACKET),
      (value) => {
        args.listOpenBracket = value;
      },
      buildList,
      this.synchronizeList,
    );

    if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
      this.synchAssignWrap(
        () => this.attribute(),
        (value) => args.elementList.push(value),
        buildList,
        this.synchronizeList,
      );
    }

    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
      this.synchWrap(
        () => {
          args.commaList.push(this.consumeReturn("Expect a comma ','", SyntaxTokenKind.COMMA));
          args.elementList.push(this.attribute());
        },
        (partial: unknown) => partial instanceof SyntaxNode && args.elementList.push(partial),
        buildList,
        this.synchronizeList,
      );
    }

    this.synchAssignWrap(
      () => this.consumeReturn("Expect a closing bracket ']'", SyntaxTokenKind.RBRACKET),
      (value) => {
        args.listCloseBracket = value;
      },
      buildList,
      this.synchronizeList,
    );

    return buildList();
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

  private attribute(): AttributeNode {
    const args: {
      name: IdentiferStreamNode | undefined;
      colon: SyntaxToken | undefined;
      value: NormalExpressionNode | IdentiferStreamNode | undefined;
    } = {} as any;

    if (this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.RBRACKET, SyntaxTokenKind.COMMA)) {
      const token = this.peek();
      this.logError(
        token,
        CompileErrorCode.EMPTY_ATTRIBUTE_NAME,
        'Expect a non-empty attribute name',
      );
      args.name = this.nodeFactory.create(IdentiferStreamNode, { identifiers: [] });
    } else {
      this.synchAssignWrap(
        () => this.extractIdentifierStream(),
        (value) => {
          args.name = value;
        },
        () => this.nodeFactory.create(AttributeNode, args),
        this.synchronizeAttributeName,
      );
    }

    if (this.match(SyntaxTokenKind.COLON)) {
      args.colon = this.previous();
      args.value = this.attributeValue();
    }

    return this.nodeFactory.create(AttributeNode, args);
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

  private attributeValue(): NormalExpressionNode | IdentiferStreamNode {
    let value: NormalExpressionNode | IdentiferStreamNode | undefined;
    this.synchAssignWrap(
      () =>
        (this.peek().kind === SyntaxTokenKind.IDENTIFIER &&
        this.peek(1).kind === SyntaxTokenKind.IDENTIFIER ?
          this.extractIdentifierStream() :
          this.normalExpression()),
      (_value) => {
        value = _value;
      },
      () => value as any,
      this.synchronizeAttributeValue,
    );

    return value as any;
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

  private extractIdentifierStream(): IdentiferStreamNode {
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
        markInvalid(this.previous());
        this.logError(this.previous(), CompileErrorCode.UNEXPECTED_TOKEN, 'Expect an identifier');
      } else {
        this.synchAssignWrap(
          () => this.consumeReturn('Expect an identifier', SyntaxTokenKind.IDENTIFIER),
          (value) => value && identifiers.push(value),
          () => this.nodeFactory.create(IdentiferStreamNode, { identifiers }),
        );
      }
    }

    return this.nodeFactory.create(IdentiferStreamNode, { identifiers });
  }

  private logError(nodeOrToken: SyntaxToken | SyntaxNode, code: CompileErrorCode, message: string) {
    this.errors.push(new CompileError(code, message, nodeOrToken));
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

/* eslint-enable */
