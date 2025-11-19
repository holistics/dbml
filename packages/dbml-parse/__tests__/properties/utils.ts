import Lexer from '../../src/lib/lexer/lexer';
import Parser from '../../src/lib/parser/parser';
import {
  ProgramNode,
  SyntaxNode,
  SyntaxNodeIdGenerator,
  SyntaxNodeKind,
  ElementDeclarationNode,
  AttributeNode,
  IdentiferStreamNode,
  PrefixExpressionNode,
  InfixExpressionNode,
  PostfixExpressionNode,
  FunctionExpressionNode,
  FunctionApplicationNode,
  BlockExpressionNode,
  PartialInjectionNode,
  ListExpressionNode,
  TupleExpressionNode,
  CallExpressionNode,
  LiteralNode,
  VariableNode,
  PrimaryExpressionNode,
  ArrayNode,
} from '@/lib/parser/nodes';
import Report from '@/lib/report';
import { CompileError, SyntaxToken } from '@/index';

export function lex (source: string): Report<SyntaxToken[], CompileError> {
  return new Lexer(source).lex();
}

export function parse (source: string): Report<{ ast: ProgramNode; tokens: SyntaxToken[] }, CompileError> {
  return new Lexer(source).lex().chain((tokens) => new Parser(tokens, new SyntaxNodeIdGenerator()).parse());
}

export function flattenTokens (token: SyntaxToken): SyntaxToken[] {
  return [
    ...token.leadingInvalid.flatMap((t) => t.leadingTrivia.concat(t.trailingTrivia)),
    ...token.leadingTrivia,
    token,
    ...token.trailingTrivia,
    ...token.trailingInvalid.flatMap((t) => t.leadingTrivia.concat(t.trailingTrivia)),
  ];
}

export function print (source: string, ast: SyntaxNode): string {
  const tokens: SyntaxToken[] = [];

  function collectTokens (node: SyntaxNode | SyntaxToken | undefined): void {
    if (!node) return;

    if (node instanceof SyntaxToken) {
      tokens.push(...flattenTokens(node));
      return;
    }

    // Process different node types
    switch (node.kind) {
      case SyntaxNodeKind.PROGRAM: {
        const program = node as ProgramNode;
        program.body.forEach(collectTokens);
        if (program.eof) collectTokens(program.eof);
        break;
      }

      case SyntaxNodeKind.ELEMENT_DECLARATION: {
        const elem = node as ElementDeclarationNode;
        if (elem.type) collectTokens(elem.type);
        if (elem.name) collectTokens(elem.name);
        if (elem.as) collectTokens(elem.as);
        if (elem.alias) collectTokens(elem.alias);
        if (elem.attributeList) collectTokens(elem.attributeList);
        if (elem.bodyColon) collectTokens(elem.bodyColon);
        if (elem.body) collectTokens(elem.body);
        break;
      }

      case SyntaxNodeKind.ATTRIBUTE: {
        const attr = node as AttributeNode;
        if (attr.name) collectTokens(attr.name);
        if (attr.colon) collectTokens(attr.colon);
        if (attr.value) collectTokens(attr.value);
        break;
      }

      case SyntaxNodeKind.IDENTIFIER_STREAM: {
        const stream = node as IdentiferStreamNode;
        stream.identifiers.forEach(collectTokens);
        break;
      }

      case SyntaxNodeKind.PREFIX_EXPRESSION: {
        const expr = node as PrefixExpressionNode;
        if (expr.op) collectTokens(expr.op);
        if (expr.expression) collectTokens(expr.expression);
        break;
      }

      case SyntaxNodeKind.INFIX_EXPRESSION: {
        const expr = node as InfixExpressionNode;
        if (expr.leftExpression) collectTokens(expr.leftExpression);
        if (expr.op) collectTokens(expr.op);
        if (expr.rightExpression) collectTokens(expr.rightExpression);
        break;
      }

      case SyntaxNodeKind.POSTFIX_EXPRESSION: {
        const expr = node as PostfixExpressionNode;
        if (expr.expression) collectTokens(expr.expression);
        if (expr.op) collectTokens(expr.op);
        break;
      }

      case SyntaxNodeKind.FUNCTION_EXPRESSION: {
        const func = node as FunctionExpressionNode;
        if (func.value) collectTokens(func.value);
        break;
      }

      case SyntaxNodeKind.FUNCTION_APPLICATION: {
        const app = node as FunctionApplicationNode;
        if (app.callee) collectTokens(app.callee);
        app.args.forEach(collectTokens);
        break;
      }

      case SyntaxNodeKind.BLOCK_EXPRESSION: {
        const block = node as BlockExpressionNode;
        if (block.blockOpenBrace) collectTokens(block.blockOpenBrace);
        block.body.forEach(collectTokens);
        if (block.blockCloseBrace) collectTokens(block.blockCloseBrace);
        break;
      }

      case SyntaxNodeKind.PARTIAL_INJECTION: {
        const partial = node as PartialInjectionNode;
        if (partial.partial) collectTokens(partial.partial);
        break;
      }

      case SyntaxNodeKind.LIST_EXPRESSION: {
        const list = node as ListExpressionNode;
        if (list.listOpenBracket) collectTokens(list.listOpenBracket);
        list.elementList.forEach(collectTokens);
        list.commaList.forEach(collectTokens);
        if (list.listCloseBracket) collectTokens(list.listCloseBracket);
        break;
      }

      case SyntaxNodeKind.TUPLE_EXPRESSION:
      case SyntaxNodeKind.GROUP_EXPRESSION: {
        const tuple = node as TupleExpressionNode;
        if (tuple.tupleOpenParen) collectTokens(tuple.tupleOpenParen);
        tuple.elementList.forEach(collectTokens);
        tuple.commaList.forEach(collectTokens);
        if (tuple.tupleCloseParen) collectTokens(tuple.tupleCloseParen);
        break;
      }

      case SyntaxNodeKind.CALL_EXPRESSION: {
        const call = node as CallExpressionNode;
        if (call.callee) collectTokens(call.callee);
        if (call.argumentList) collectTokens(call.argumentList);
        break;
      }

      case SyntaxNodeKind.LITERAL: {
        const lit = node as LiteralNode;
        if (lit.literal) collectTokens(lit.literal);
        break;
      }

      case SyntaxNodeKind.VARIABLE: {
        const vari = node as VariableNode;
        if (vari.variable) collectTokens(vari.variable);
        break;
      }

      case SyntaxNodeKind.PRIMARY_EXPRESSION: {
        const primary = node as PrimaryExpressionNode;
        if (primary.expression) collectTokens(primary.expression);
        break;
      }

      case SyntaxNodeKind.ARRAY: {
        const arr = node as ArrayNode;
        if (arr.array) collectTokens(arr.array);
        if (arr.indexer) collectTokens(arr.indexer);
        break;
      }

      case SyntaxNodeKind.DUMMY:
        // Dummy nodes don't contribute to output
        break;

      default: {
        // TypeScript exhaustiveness check - this should never be reached
        const _exhaustiveCheck: never = node;
        console.warn('Unhandled node kind:', _exhaustiveCheck);
        break;
      }
    }
  }

  collectTokens(ast);

  return tokens.sort((a, b) => a.start - b.start).map((t) => source.slice(t.start, t.end)).join('');
}
