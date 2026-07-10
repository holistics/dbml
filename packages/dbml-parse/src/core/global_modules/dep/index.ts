import type Compiler from '@/compiler/index';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { DepMetadata } from '@/core/types/symbol/metadata';
import type { NodeMetadata } from '@/core/types/symbol/metadata';
import { PASS_THROUGH, type PassThrough, UNHANDLED } from '@/core/types/module';
import {
  AttributeNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  InfixExpressionNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { SchemaElement } from '@/core/types/schemaJson';
import { SymbolKind, type NodeSymbol } from '@/core/types/symbol';
import type { SyntaxToken } from '@/core/types/tokens';
import { extractStringFromIdentifierStream, extractVarNameFromPrimaryVariable, getBody } from '@/core/utils/expression';
import { isAccessExpression, isElementNode, isExpressionAVariableNode } from '@/core/utils/validate';
import { getDefaultSchemaSymbol } from '../ref';
import { nodeRefereeOfLeftExpression } from '../utils';
import type { GlobalModule } from '../types';
import DepBinder from './bind';
import { DepInterpreter } from './interpret';

function isInsideDepBody (node: SyntaxNode): boolean {
  let current: SyntaxNode | undefined = node.parent;
  while (current) {
    if (current instanceof ElementDeclarationNode && current.isKind(ElementKind.Dep)) {
      return current.body?.containsEq(node) ?? false;
    }
    current = current.parent;
  }
  return false;
}

export const depModule: GlobalModule = {
  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node) && !isAccessExpression(node)) return Report.create(PASS_THROUGH);
    if (!isInsideDepBody(node)) return Report.create(PASS_THROUGH);
    if (node.parentOfKind(AttributeNode)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();
    if (globalSymbol === UNHANDLED) return Report.create(undefined);

    return nodeRefereeOfDepEndpoint(compiler, globalSymbol, node);
  },

  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      const fields = getBody(node);
      if (fields.length === 0) return Report.create(PASS_THROUGH);
      const hasAnyEdge = fields.some((f) => f instanceof FunctionApplicationNode && f.callee instanceof InfixExpressionNode);
      if (!hasAnyEdge) return Report.create(PASS_THROUGH);
      return Report.create(new DepMetadata(node));
    }

    if (node instanceof AttributeNode) {
      if (!(node.name instanceof IdentifierStreamNode)) return Report.create(PASS_THROUGH);
      const name = extractStringFromIdentifierStream(node.name)?.toLowerCase();
      if (name !== SettingName.Dep) return Report.create(PASS_THROUGH);
      return Report.create(new DepMetadata(node));
    }

    return Report.create(PASS_THROUGH);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Dep)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new DepBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata instanceof DepMetadata) {
      return new DepInterpreter(compiler, metadata, filepath).interpret();
    }
    return Report.create(PASS_THROUGH);
  },
};

function nodeRefereeOfDepEndpoint (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  if (!isAccessExpression(node.parentNode)) {
    const defaultSchema = getDefaultSchemaSymbol(compiler, globalSymbol);
    if (defaultSchema) {
      const symbol = compiler.lookupMembers(defaultSchema, SymbolKind.Table, name);
      if (symbol) return Report.create(symbol);
    }
    const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Table, name);
    if (symbol) return Report.create(symbol);
    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  const parent = node.parentNode as InfixExpressionNode;

  if (parent.rightExpression === node) {
    const left = nodeRefereeOfLeftExpression(compiler, node);
    if (left?.isKind(SymbolKind.Schema)) {
      const symbol = compiler.lookupMembers(left, [
        SymbolKind.Table,
        SymbolKind.Schema,
      ], name);
      if (symbol) return Report.create(symbol);
      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Table or schema '${name}' does not exist`, node),
      ]);
    }
    if (left?.isKind(SymbolKind.Table)) {
      const symbol = compiler.lookupMembers(left, SymbolKind.Column, name);
      if (symbol) return Report.create(symbol);
      const fullname = left.declaration
        ? compiler.nodeFullname(left.declaration).getFiltered(UNHANDLED)?.join('.') ?? left.name
        : left.name;
      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in Table '${fullname}'`, node),
      ]);
    }
    return new Report(undefined);
  }

  if (parent.leftExpression === node) {
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
      if (symbol) return Report.create(symbol);
      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist`, node),
      ]);
    }
    const schemaSymbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
    if (schemaSymbol) return Report.create(schemaSymbol);

    const defaultSchema = getDefaultSchemaSymbol(compiler, globalSymbol);
    if (defaultSchema) {
      const tableSymbol = compiler.lookupMembers(defaultSchema, SymbolKind.Table, name);
      if (tableSymbol) return Report.create(tableSymbol);
    }
    const tableSymbol = compiler.lookupMembers(globalSymbol, SymbolKind.Table, name);
    if (tableSymbol) return Report.create(tableSymbol);

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Schema or Table '${name}' does not exist`, node),
    ]);
  }

  return new Report(undefined);
}
