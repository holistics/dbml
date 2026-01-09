import { last } from 'lodash-es';
import {
  convertFuncAppToElem,
  isAsKeyword,
  markInvalid,
} from '@/core/parser/utils';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { SyntaxToken, SyntaxTokenKind, isOpToken } from '@/core/lexer/tokens';
import Report from '@/core/report';
import { ParsingContext, ParsingContextStack } from '@/core/parser/contextStack';
import {
  ArrayNode,
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  DummyNode,
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
  PartialInjectionNode,
} from '@/core/parser/nodes';
import NodeFactory from '@/core/parser/factory';
import { hasTrailingNewLines, hasTrailingSpaces, isAtStartOfLine } from '@/core/lexer/utils';

// A class of errors that represent a parsing failure and contain the node that was partially parsed
class PartialParsingError<T extends SyntaxNode> {
  partialNode?: T;
  token: Readonly<SyntaxToken>;
  handlerContext: undefined | ParsingContext;

  constructor (token: Readonly<SyntaxToken>, partialNode: T | undefined, handlerContext: undefined | ParsingContext) {
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

  constructor (tokens: SyntaxToken[], nodeIdGenerator: SyntaxNodeIdGenerator) {
    this.tokens = tokens;
    this.nodeFactory = new NodeFactory(nodeIdGenerator);
  }

  private isAtEnd (): boolean {
    return (
      this.current >= this.tokens.length || this.tokens[this.current].kind === SyntaxTokenKind.EOF
    );
  }

  private advance (): SyntaxToken {
    if (this.isAtEnd()) {
      return last(this.tokens)!; // The EOF
    }

    return this.tokens[this.current++];
  }

  private peek (lookahead: number = 0): SyntaxToken {
    if (lookahead + this.current >= this.tokens.length) {
      return last(this.tokens)!; // The EOF
    }

    return this.tokens[this.current + lookahead];
  }

  private match (...kind: SyntaxTokenKind[]): boolean {
    const res = this.check(...kind);
    if (res) {
      this.advance();
    }

    return res;
  }

  private check (...kind: SyntaxTokenKind[]): boolean {
    const currentToken = this.peek();

    return kind.includes(currentToken.kind);
  }

  private previous (): SyntaxToken {
    return this.tokens[this.current - 1];
  }

  private canHandle<T extends SyntaxNode>(e: PartialParsingError<T>): boolean {
    return e.handlerContext === undefined || e.handlerContext === this.contextStack.top();
  }

  private consume (message: string, ...kind: SyntaxTokenKind[]) {
    if (!this.match(...kind)) {
      this.logError(this.peek(), CompileErrorCode.UNEXPECTED_TOKEN, message);
      throw new PartialParsingError(
        this.peek(),
        undefined,
        this.contextStack.findHandlerContext(this.tokens, this.current),
      );
    }
  }

  // Discard tokens until one of `kind` is found
  // If any tokens are discarded, the error message is logged
  // Return whether the token of one of the listed kinds are eventually reached
  private discardUntil (message: string, ...kind: SyntaxTokenKind[]): boolean {
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

  private gatherInvalid () {
    const tokens: SyntaxToken[] = [];

    const firstInvalidList: SyntaxToken[] = [];
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

    this.tokens = tokens;
  }

  parse (): Report<{ ast: ProgramNode; tokens: SyntaxToken[] }, CompileError> {
    const body = this.program();
    const eof = this.advance();
    const program = this.nodeFactory.create(ProgramNode, { body, eof });
    this.gatherInvalid();

    return new Report({ ast: program, tokens: this.tokens }, this.errors);
  }

  /* Parsing and synchronizing ProgramNode */

  private program () {
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

  private elementDeclaration (): ElementDeclarationNode {
    const args: {
      type?: SyntaxToken;
      name?: NormalExpressionNode;
      as?: SyntaxToken;
      alias?: NormalExpressionNode;
      attributeList?: ListExpressionNode;
      bodyColon?: SyntaxToken;
      body?: FunctionApplicationNode | BlockExpressionNode;
    } = {};
    const buildElement = () => this.nodeFactory.create(ElementDeclarationNode, args);

    try {
      this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
      args.type = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.type = e.partialNode;
      throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
    }

    if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
      try {
        args.name = this.normalExpression();
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        args.name = e.partialNode;
        if (!this.canHandle(e)) {
          throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
        }
        this.synchronizeElementDeclarationName();
      }
    }

    if (isAsKeyword(this.peek())) {
      args.as = this.advance();
      if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)) {
        try {
          args.alias = this.normalExpression();
        } catch (e) {
          if (!(e instanceof PartialParsingError)) {
            throw e;
          }
          args.alias = e.partialNode;
          if (!this.canHandle(e)) {
            throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
          }
          this.synchronizeElementDeclarationAlias();
        }
      } else {
        this.logError(this.peek(), CompileErrorCode.UNEXPECTED_TOKEN, 'Expect an alias');
      }
    }

    try {
      args.attributeList = this.check(SyntaxTokenKind.LBRACKET) ? this.listExpression() : undefined;
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.attributeList = e.partialNode;
      throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
    }

    if (
      !this.discardUntil(
        'Expect an opening brace \'{\' or a colon \':\'',
        SyntaxTokenKind.LBRACE,
        SyntaxTokenKind.COLON,
      )
    ) {
      return buildElement();
    }

    try {
      if (this.match(SyntaxTokenKind.COLON)) {
        args.bodyColon = this.previous();
        const expr = this.expression();
        if (expr instanceof ElementDeclarationNode) {
          markInvalid(expr);
          this.logError(expr, CompileErrorCode.UNEXPECTED_ELEMENT_DECLARATION, 'An element\'s simple body must not be an element declaration');
        } else {
          args.body = expr;
        }
      } else {
        args.body = this.blockExpression();
      }
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.body = e.partialNode;
      throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
    }

    return this.nodeFactory.create(ElementDeclarationNode, args);
  }

  private synchronizeElementDeclarationName = () => {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (
        isAsKeyword(token)
        || this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE, SyntaxTokenKind.LBRACKET)
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
  private fieldDeclaration (): ElementDeclarationNode {
    const args: {
      type?: SyntaxToken;
      name?: NormalExpressionNode;
      bodyColon?: SyntaxToken;
      body?: FunctionApplicationNode | BlockExpressionNode;
    } = {};
    const buildElement = () => this.nodeFactory.create(ElementDeclarationNode, args);

    try {
      this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
      args.type = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.type = e.partialNode;
      throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
    }

    try {
      this.consume('Expect a colon \':\'', SyntaxTokenKind.COLON);
      args.bodyColon = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.bodyColon = e.partialNode;
      throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
    }

    try {
      const expr = this.expression();
      if (expr instanceof ElementDeclarationNode) {
        this.errors.push(new CompileError(CompileErrorCode.INVALID_ELEMENT_IN_SIMPLE_BODY, 'Simple body cannot be an element declaration', expr));
      } else {
        args.body = expr;
      }
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.body = e.partialNode;
      throw new PartialParsingError(e.token, buildElement(), e.handlerContext);
    }

    return this.nodeFactory.create(ElementDeclarationNode, args);
  }

  /* Parsing any ExpressionNode, including non-NormalExpression */

  private expression (): FunctionApplicationNode | ElementDeclarationNode {
    // Since function application expression is the most generic form
    // by default, we'll interpret any expression as a function application
    const args: {
      callee?: NormalExpressionNode;
      args: NormalExpressionNode[];
    } = { args: [] };

    // Try interpreting the function application as an element declaration expression
    // if fail, fall back to the generic function application
    const buildExpression = () => convertFuncAppToElem(args.callee, args.args, this.nodeFactory).unwrap_or(
      this.nodeFactory.create(FunctionApplicationNode, args),
    );

    try {
      args.callee = this.normalExpression();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.callee = e.partialNode;
      throw new PartialParsingError(e.token, buildExpression(), e.handlerContext);
    }

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

      try {
        prevNode = this.normalExpression();
        args.args.push(prevNode);
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        prevNode = e.partialNode;
        args.args.push(prevNode);
        throw new PartialParsingError(e.token, buildExpression(), e.handlerContext);
      }
    }

    return buildExpression();
  }

  private shouldStopExpression (): boolean {
    if (this.isAtEnd() || hasTrailingNewLines(this.previous())) {
      return true;
    }

    const nextTokenKind = this.peek().kind;

    return (
      nextTokenKind === SyntaxTokenKind.RBRACE
      || nextTokenKind === SyntaxTokenKind.RBRACKET
      || nextTokenKind === SyntaxTokenKind.RPAREN
      || nextTokenKind === SyntaxTokenKind.COMMA
      || nextTokenKind === SyntaxTokenKind.COLON
    );
  }

  private normalExpression (): NormalExpressionNode {
    return this.expression_bp(0);
  }

  // Pratt's parsing algorithm
  private expression_bp (mbp: number): NormalExpressionNode {
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
          isAtStartOfLine(this.previous(), token)
          && !this.contextStack.isWithinGroupExpressionContext()
          && !this.contextStack.isWithinListExpressionContext()
        ) {
          break;
        }
        try {
          leftExpression = this.nodeFactory.create(CallExpressionNode, {
            callee: leftExpression,
            argumentList: this.tupleExpression(),
          });
        } catch (e) {
          if (!(e instanceof PartialParsingError)) {
            throw e;
          }
          leftExpression = this.nodeFactory.create(CallExpressionNode, {
            callee: leftExpression,
            argumentList: e.partialNode,
          });
          throw new PartialParsingError(e.token, leftExpression, e.handlerContext);
        }
      } else if (token.kind === SyntaxTokenKind.LBRACKET) {
        if (hasTrailingSpaces(this.previous())) {
          break;
        }
        try {
          leftExpression = this.nodeFactory.create(ArrayNode, {
            expression: leftExpression,
            indexer: this.listExpression(),
          });
        } catch (e) {
          if (!(e instanceof PartialParsingError)) {
            throw e;
          }
          leftExpression = this.nodeFactory.create(ArrayNode, {
            expression: leftExpression,
            indexer: e.partialNode,
          });
          throw new PartialParsingError(e.token, leftExpression, e.handlerContext);
        }
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
          try {
            leftExpression = this.nodeFactory.create(InfixExpressionNode, {
              leftExpression: leftExpression!,
              op,
              rightExpression:
                op.value === '.' ? this.extractOperand() : this.expression_bp(opInfixPower.right),
            });
          } catch (e) {
            if (!(e instanceof PartialParsingError)) {
              throw e;
            }
            leftExpression = this.nodeFactory.create(InfixExpressionNode, {
              leftExpression: leftExpression!,
              op,
              rightExpression: e.partialNode,
            });
            throw new PartialParsingError(e.token, leftExpression, e.handlerContext);
          }
        }
      }
    }

    return leftExpression;
  }

  private leftExpression_bp (): NormalExpressionNode {
    let leftExpression: NormalExpressionNode | undefined;

    if (isOpToken(this.peek())) {
      const args: {
        op?: SyntaxToken;
        expression?: NormalExpressionNode;
      } = {};

      args.op = this.peek();
      const opPrefixPower = prefixBindingPower(args.op);

      if (opPrefixPower.right === null) {
        this.logError(
          args.op,
          CompileErrorCode.UNKNOWN_PREFIX_OP,
          `Unexpected '${args.op.value}' in an expression`,
        );

        throw new PartialParsingError(
          args.op,
          this.nodeFactory.create(DummyNode, { pre: args.op }),
          this.contextStack.findHandlerContext(this.tokens, this.current),
        );
      }
      this.advance();

      try {
        args.expression = this.expression_bp(opPrefixPower.right as number);
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        args.expression = e.partialNode;
        throw new PartialParsingError(
          e.token,
          this.nodeFactory.create(PrefixExpressionNode, args),
          e.handlerContext,
        );
      }

      leftExpression = this.nodeFactory.create(PrefixExpressionNode, args);
    } else {
      leftExpression = this.extractOperand();
      if (leftExpression instanceof DummyNode) {
        throw new PartialParsingError(
          this.peek(),
          this.nodeFactory.create(DummyNode, { pre: this.peek() }),
          this.contextStack.findHandlerContext(this.tokens, this.current),
        );
      }
    }

    return leftExpression;
  }

  // Extract an operand to be used in a normal form expression
  // e.g (1 + 2) in (1 + 2) * 3
  // e.g [1, 2, 3, 4]
  // e.g { ... }
  private extractOperand ():
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

    if (this.peek().kind === SyntaxTokenKind.EOF) {
      this.logError(
        this.peek(),
        CompileErrorCode.UNEXPECTED_EOF,
        'Unexpected EOF',
      );
    } else {
      this.logError(
        this.peek(),
        CompileErrorCode.INVALID_OPERAND,
        `Invalid start of operand "${this.peek().value}"`,
      );
    }

    return this.nodeFactory.create(DummyNode, { pre: this.previous() });
  }

  /* Parsing FunctionExpression */

  private functionExpression (): FunctionExpressionNode {
    const args: { value?: SyntaxToken } = {};
    try {
      this.consume('Expect a function expression', SyntaxTokenKind.FUNCTION_EXPRESSION);
      args.value = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.value = e.partialNode;
      throw new PartialParsingError(
        e.token,
        this.nodeFactory.create(FunctionExpressionNode, args),
        e.handlerContext,
      );
    }

    return this.nodeFactory.create(FunctionExpressionNode, args);
  }

  private variable (): VariableNode {
    this.consume('Expect a variable', SyntaxTokenKind.IDENTIFIER);
    const variableToken = this.previous();
    return this.nodeFactory.create(VariableNode, { variable: variableToken });
  }

  /* Parsing and synchronizing BlockExpression */

  private blockExpression = this.contextStack.withContextDo(ParsingContext.BlockExpression, () => {
    const args: {
      blockOpenBrace?: SyntaxToken;
      body: (ElementDeclarationNode | FunctionApplicationNode)[];
      blockCloseBrace?: SyntaxToken;
    } = { body: [] };
    const buildBlock = () => this.nodeFactory.create(BlockExpressionNode, args);

    try {
      this.consume('Expect an opening brace \'{\'', SyntaxTokenKind.LBRACE);
      args.blockOpenBrace = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.blockOpenBrace = e.partialNode;
      if (!this.canHandle(e)) {
        throw new PartialParsingError(e.token, buildBlock(), e.handlerContext);
      }
      this.synchronizeBlock();
    }

    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACE)) {
      try {
        if (this.match(SyntaxTokenKind.TILDE)) { // Check for partial injection
          const tildeToken = this.previous();
          const variable = this.variable();
          const partialInjection = this.nodeFactory.create(PartialInjectionNode, { op: tildeToken, partial: variable });
          args.body.push(partialInjection);
        } else {
          args.body.push(this.canBeField() ? this.fieldDeclaration() : this.expression());
        }
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        args.body.push(e.partialNode);
        if (!this.canHandle(e)) {
          throw new PartialParsingError(e.token, buildBlock(), e.handlerContext);
        }
        this.synchronizeBlock();
      }
    }

    try {
      this.consume('Expect a closing brace \'}\'', SyntaxTokenKind.RBRACE);
      args.blockCloseBrace = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.blockCloseBrace = e.partialNode;
      if (!this.canHandle(e)) {
        throw new PartialParsingError(e.token, buildBlock(), e.handlerContext);
      }
      this.synchronizeBlock();
    }

    return buildBlock();
  });

  private canBeField (): boolean {
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

  private primaryExpression (): PrimaryExpressionNode {
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
      undefined,
      this.contextStack.findHandlerContext(this.tokens, this.current),
    );
  }

  /* Parsing and synchronizing TupleExpression */

  private tupleExpression = this.contextStack.withContextDo(ParsingContext.GroupExpression, () => {
    const args: {
      tupleOpenParen?: SyntaxToken;
      elementList: NormalExpressionNode[];
      commaList: SyntaxToken[];
      tupleCloseParen?: SyntaxToken;
    } = { elementList: [], commaList: [] };
    const buildGroup = () => this.nodeFactory.create(GroupExpressionNode, {
      groupOpenParen: args.tupleOpenParen,
      groupCloseParen: args.tupleCloseParen,
      expression: args.elementList[0],
    });
    const buildTuple = () => this.nodeFactory.create(TupleExpressionNode, args);

    try {
      this.consume('Expect an opening parenthesis \'(\'', SyntaxTokenKind.LPAREN);
      args.tupleOpenParen = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.tupleOpenParen = e.partialNode;
      if (!this.canHandle(e)) {
        throw new PartialParsingError(e.token, buildTuple(), e.handlerContext);
      }
      this.synchronizeTuple();
    }

    if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
      try {
        args.elementList.push(this.normalExpression());
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        args.elementList.push(e.partialNode);
        if (!this.canHandle(e)) {
          throw new PartialParsingError(e.token, buildGroup(), e.handlerContext);
        }
        this.synchronizeTuple();
      }
    }

    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RPAREN)) {
      try {
        this.consume('Expect a comma \',\'', SyntaxTokenKind.COMMA);
        args.commaList.push(this.previous());
        args.elementList.push(this.normalExpression());
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        if (e.partialNode instanceof SyntaxNode) {
          args.elementList.push(e.partialNode);
        }
        if (!this.canHandle(e)) {
          throw new PartialParsingError(e.token, buildTuple(), e.handlerContext);
        }
        this.synchronizeTuple();
      }
    }

    try {
      this.consume('Expect a closing parenthesis \')\'', SyntaxTokenKind.RPAREN);
      args.tupleCloseParen = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.tupleCloseParen = e.partialNode;
      if (!this.canHandle(e)) {
        throw new PartialParsingError(e.token, buildTuple(), e.handlerContext);
      }
      this.synchronizeTuple();
    }

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
      listOpenBracket?: SyntaxToken;
      elementList: AttributeNode[];
      commaList: SyntaxToken[];
      listCloseBracket?: SyntaxToken;
    } = { elementList: [], commaList: [] };
    const buildList = () => this.nodeFactory.create(ListExpressionNode, args);

    try {
      this.consume('Expect an opening bracket \'[\'', SyntaxTokenKind.LBRACKET);
      args.listOpenBracket = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.listOpenBracket = e.partialNode;
      if (!this.canHandle(e)) {
        throw new PartialParsingError(e.token, buildList(), e.handlerContext);
      }
      this.synchronizeList();
    }

    if (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
      try {
        args.elementList.push(this.attribute());
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        args.elementList.push(e.partialNode);
        if (!this.canHandle(e)) {
          throw new PartialParsingError(e.token, buildList(), e.handlerContext);
        }
        this.synchronizeList();
      }
    }

    while (!this.isAtEnd() && !this.check(SyntaxTokenKind.RBRACKET)) {
      try {
        this.consume('Expect a comma \',\'', SyntaxTokenKind.COMMA);
        args.commaList.push(this.previous());
        args.elementList.push(this.attribute());
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        if (e.partialNode instanceof SyntaxNode) {
          args.elementList.push(e.partialNode);
        }
        if (!this.canHandle(e)) {
          throw new PartialParsingError(e.token, buildList(), e.handlerContext);
        }
        this.synchronizeList();
      }
    }

    try {
      this.consume('Expect a closing bracket \']\'', SyntaxTokenKind.RBRACKET);
      args.listCloseBracket = this.previous();
    } catch (e) {
      if (!(e instanceof PartialParsingError)) {
        throw e;
      }
      args.listCloseBracket = e.partialNode;
      if (!this.canHandle(e)) {
        throw new PartialParsingError(e.token, buildList(), e.handlerContext);
      }
      this.synchronizeList();
    }

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

  private attribute (): AttributeNode {
    const args: {
      name?: IdentiferStreamNode | PrimaryExpressionNode;
      colon?: SyntaxToken;
      value?: NormalExpressionNode | IdentiferStreamNode;
    } = {};

    if (this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.RBRACKET, SyntaxTokenKind.COMMA)) {
      const token = this.peek();
      this.logError(
        token,
        CompileErrorCode.EMPTY_ATTRIBUTE_NAME,
        'Expect a non-empty attribute name',
      );
      args.name = this.nodeFactory.create(IdentiferStreamNode, { identifiers: [] });
    } else {
      try {
        args.name = this.attributeName();
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        args.name = e.partialNode;
        if (!this.canHandle(e)) {
          throw new PartialParsingError(
            e.token,
            this.nodeFactory.create(AttributeNode, args),
            e.handlerContext,
          );
        }
        this.synchronizeAttributeName();
      }
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

  private attributeValue (): NormalExpressionNode | IdentiferStreamNode {
    let value: NormalExpressionNode | IdentiferStreamNode | undefined;
    try {
      value = this.peek().kind === SyntaxTokenKind.IDENTIFIER
        && this.peek(1).kind === SyntaxTokenKind.IDENTIFIER
        ? this.attributeName()
        : this.normalExpression();
    } catch (e) {
      if (!(e instanceof PartialParsingError) || !this.canHandle(e)) {
        throw e;
      }
      value = e.partialNode;
      this.synchronizeAttributeValue();
    }

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

  private attributeName (): IdentiferStreamNode | PrimaryExpressionNode {
    const identifiers: SyntaxToken[] = [];

    if (this.peek().kind !== SyntaxTokenKind.IDENTIFIER) {
      return this.primaryExpression();
    }

    while (
      !this.isAtEnd()
      && !this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.COMMA, SyntaxTokenKind.RBRACKET)
    ) {
      try {
        this.consume('Expect an identifier', SyntaxTokenKind.IDENTIFIER);
        identifiers.push(this.previous());
      } catch (e) {
        if (!(e instanceof PartialParsingError)) {
          throw e;
        }
        throw new PartialParsingError(
          e.token,
          this.nodeFactory.create(IdentiferStreamNode, { identifiers }),
          e.handlerContext,
        );
      }
    }

    return this.nodeFactory.create(IdentiferStreamNode, { identifiers });
  }

  private logError (nodeOrToken: SyntaxToken | SyntaxNode, code: CompileErrorCode, message: string) {
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

function infixBindingPower (
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

function prefixBindingPower (token: SyntaxToken): { left: null; right: null | number } {
  const power = prefixBindingPowerMap[token.value];

  return power || { left: null, right: null };
}

const postfixBindingPowerMap: {
  [index: string]: { left: number; right: null } | undefined;
} = {
  '(': { left: 14, right: null },
};

function postfixBindingPower (token: SyntaxToken): { left: null | number; right: null } {
  const power = postfixBindingPowerMap[token.value];

  return power || { left: null, right: null };
}
