import { isElementNode, isExpressionAVariableNode, isAccessExpression } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import { AttributeNode, ElementDeclarationNode } from '@/core/parser/nodes';
import type { InfixExpressionNode, SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { DEFAULT_SCHEMA_NAME, PASS_THROUGH, UNHANDLED, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import type { Ref } from '@/core/types/schemaJson';
import { lookupMember, nodeRefereeOfLeftExpression } from '../utils';
import { extractVarNameFromPrimaryVariable } from '@/core/utils/expression';
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
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Ref)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report(compiler.symbolFactory.create(NodeSymbol, {
      kind: SymbolKind.Ref,
      declaration: node,
    }, node.filepath));
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Ref)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report([]);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node) && !isAccessExpression(node)) return Report.create(PASS_THROUGH);
    if (!isInsideRefBody(node)) return Report.create(PASS_THROUGH);

    // Skip variables that are inside setting attribute values (e.g. delete: cascade)
    if (node.parentOfKind(AttributeNode)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parse(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();
    if (globalSymbol === UNHANDLED) return Report.create(undefined);

    return nodeRefereeOfRefEndpoint(compiler, globalSymbol, node);
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Ref)) {
      return Report.create(PASS_THROUGH);
    }
    return new Report([]);
  },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Ref)) return Report.create(PASS_THROUGH);
    return Report.create(
      undefined,
      new RefBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<Ref | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Ref)) return Report.create(PASS_THROUGH);
    if (compiler.bind(node).getErrors().length + compiler.validate(node).getErrors().length > 0) return Report.create(undefined);
    return new RefInterpreter(compiler, node).interpret();
  },
};

function getDefaultSchemaSymbol (compiler: Compiler, globalSymbol: NodeSymbol): NodeSymbol | undefined {
  const members = compiler.symbolMembers(globalSymbol);
  if (members.hasValue(UNHANDLED)) return undefined;

  return members.getValue().find((m: NodeSymbol) =>
    m instanceof SchemaSymbol && m.name === DEFAULT_SCHEMA_NAME,
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
      const tableResult = compiler.nodeReferee(leftExpr);
      if (!tableResult.hasValue(UNHANDLED) && tableResult.getValue()?.isKind(SymbolKind.Table)) {
        return lookupMember(compiler, tableResult.getValue()!, name, { kinds: [SymbolKind.Column], errorNode: node });
      }
    }
    return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Column], ignoreNotFound: true, errorNode: node });
  }

  // Right side of access expression - resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return lookupMember(compiler, left, name, { kinds: [SymbolKind.Table, SymbolKind.Schema], errorNode: node });
    }
    if (left.isKind(SymbolKind.Table)) {
      return lookupMember(compiler, left, name, { kinds: [SymbolKind.Column], errorNode: node });
    }
    return new Report(undefined);
  }

  // Left side of access expression - look up as Table or Schema
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If parent is also left side of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Schema], errorNode: node });
    }
    // Otherwise look up as Table (by name or alias) in public schema, then program scope
    const schemaSymbol = getDefaultSchemaSymbol(compiler, globalSymbol);
    if (schemaSymbol) {
      const result = lookupMember(compiler, schemaSymbol, name, { kinds: [SymbolKind.Table], ignoreNotFound: true, errorNode: node });
      if (result.getValue()) return result;
    }
    return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Table], errorNode: node });
  }

  return new Report(undefined);
}
