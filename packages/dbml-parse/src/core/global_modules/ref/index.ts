import type Compiler from '@/compiler/index';
import type { Filepath } from '@/core/types/filepath';
import {
  ElementKind,
  SettingName,
} from '@/core/types/keywords';
import {
  PartialRefMetadata,
  RefMetadata,
} from '@/core/types/symbol/metadata';
import type { NodeMetadata } from '@/core/types/symbol/metadata';
import { PASS_THROUGH, type PassThrough, UNHANDLED } from '@/core/types/module';
import {
  AttributeNode, ElementDeclarationNode, FunctionApplicationNode, IdentifierStreamNode, InfixExpressionNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { SchemaElement } from '@/core/types/schemaJson';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbol';
import type { SyntaxToken } from '@/core/types/tokens';
import {
  extractStringFromIdentifierStream, getBody,
  extractVarNameFromPrimaryVariable,
} from '@/core/utils/expression';
import { isAccessExpression, isElementNode, isExpressionAVariableNode } from '@/core/utils/validate';
import { CompileError, CompileErrorCode } from '@/core/types';
import type { GlobalModule } from '../types';
import { nodeRefereeOfLeftExpression } from '../utils';
import RefBinder from './bind';
import { RefInterpreter } from './interpret';

// Check if a node is a descendant of a Ref element's body (not its name/alias)
function isInsideRefBody (node: SyntaxNode): boolean {
  let current: SyntaxNode | undefined = node.parent;
  while (current) {
    if (current instanceof ElementDeclarationNode && current.isKind(ElementKind.Ref)) {
      // Only if our ancestor path goes through the body, not the name
      return current.body?.containsEq(node) ?? false;
    }
    current = current.parent;
  }
  return false;
}

export const refModule: GlobalModule = {
  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node) && !isAccessExpression(node)) return Report.create(PASS_THROUGH);
    if (!isInsideRefBody(node)) return Report.create(PASS_THROUGH);

    // Skip variables that are inside setting attribute values (e.g. delete: cascade)
    if (node.parentOfKind(AttributeNode)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();
    if (globalSymbol === UNHANDLED) return Report.create(undefined);

    return nodeRefereeOfRefEndpoint(compiler, globalSymbol, node);
  },

  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    // Standalone ref: `Ref name: a.x > b.y`
    if (isElementNode(node, ElementKind.Ref)) {
      const field = getBody(node)[0];
      if (!(field instanceof FunctionApplicationNode) || !field.callee) return Report.create(PASS_THROUGH);
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode) || !infix.op) return Report.create(PASS_THROUGH);
      return Report.create(new RefMetadata(node));
    }

    // Inline ref: column setting `[ref: > b.y]`
    if (node instanceof AttributeNode) {
      if (!(node.name instanceof IdentifierStreamNode)) return Report.create(PASS_THROUGH);
      const name = extractStringFromIdentifierStream(node.name)?.toLowerCase();
      if (name !== SettingName.Ref) return Report.create(PASS_THROUGH);

      // Check if inside TablePartial vs Table
      const parentElement = node.parent;
      if (parentElement instanceof ElementDeclarationNode && parentElement.isKind(ElementKind.TablePartial)) {
        return Report.create(new PartialRefMetadata(node));
      }
      return Report.create(new RefMetadata(node));
    }

    return Report.create(PASS_THROUGH);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Ref)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new RefBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata instanceof RefMetadata) {
      return new RefInterpreter(
        compiler,
        metadata,
        filepath,
      ).interpret();
    }

    return Report.create(PASS_THROUGH);
  },
};

function getDefaultSchemaSymbol (compiler: Compiler, globalSymbol: NodeSymbol): NodeSymbol | undefined {
  const membersList = compiler.symbolMembers(globalSymbol).getFiltered(UNHANDLED);
  if (!membersList) return undefined;

  return membersList.find((m: NodeSymbol) =>
    m instanceof SchemaSymbol && m.isPublicSchema(),
  );
}

// Ref endpoint: table.column or schema.table.column
// Always report errors, never ignore not found
export function nodeRefereeOfRefEndpoint (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone variable
  if (!isAccessExpression(node.parentNode)) {
    // Check if inside a tuple that's the right side of an access: table.(col1, col2)
    const tupleParent = node.parentNode;
    if (tupleParent && isAccessExpression(tupleParent.parentNode) && (tupleParent.parentNode as InfixExpressionNode).rightExpression === tupleParent) {
      const leftExpr = (tupleParent.parentNode as InfixExpressionNode).leftExpression!;
      // If leftExpr is an access expression (e.g. schema.table), use its rightmost variable
      const tableNode = isAccessExpression(leftExpr)
        ? (leftExpr as InfixExpressionNode).rightExpression ?? leftExpr
        : leftExpr;
      const tableSymbol = compiler.nodeReferee(tableNode).getFiltered(UNHANDLED);
      if (tableSymbol?.isKind(SymbolKind.Table)) {
        const symbol = compiler.lookupMembers(tableSymbol, SymbolKind.Column, name);
        if (symbol) {
          return Report.create(symbol);
        }

        const fullname = tableSymbol.declaration
          ? compiler.nodeFullname(tableSymbol.declaration).getFiltered(UNHANDLED)?.join('.') ?? tableSymbol.name
          : tableSymbol.name;
        return new Report(undefined, [
          new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in Table '${fullname}'`, node),
        ]);
      }
    }

    return Report.create(undefined);
  }

  // Right side of access expression - resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      const symbol = compiler.lookupMembers(left, [
        SymbolKind.Table,
        SymbolKind.Schema,
      ], name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Table or schema '${name}' does not exist`, node),
      ]);
    }
    if (left.isKind(SymbolKind.Table)) {
      const symbol = compiler.lookupMembers(left, SymbolKind.Column, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in Table '${left.declaration ? compiler.nodeFullname(left.declaration).getFiltered(UNHANDLED)?.join('.') ?? left.name : left.name}'`, node),
      ]);
    }

    return new Report(undefined);
  }

  // Left side of access expression - look up as Table or Schema
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If parent is also left side of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist`, node),
      ]);
    }
    // Otherwise look up as Table (by name or alias) in public schema, then program scope
    const schemaSymbol = getDefaultSchemaSymbol(compiler, globalSymbol);
    if (schemaSymbol) {
      const symbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, name);
      if (symbol) return Report.create(symbol);
    }
    const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Table, name);
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  return new Report(undefined);
}
