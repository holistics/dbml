import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import type {
  RefMetadata, SymbolMetadata,
} from '@/core/types/metadata';
import {
  MetadataKind,
} from '@/core/types/metadata';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  AttributeNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, InfixExpressionNode, ListExpressionNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  extractVariableFromExpression, getBody, isAccessExpression, isElementNode, isExpressionAVariableNode,
} from '@/core/utils/expression';
import {
  extractStringFromIdentifierStream, extractVarNameFromPrimaryVariable,
} from '@/core/utils/expression';
import {
  aggregateSettingList,
} from '@/core/utils/validate';
import type {
  GlobalModule,
} from '../types';
import {
  parseColor,
} from '@/core/utils/interpret';
import {
  nodeRefereeOfLeftExpression,
} from '../utils';
import RefBinder from './bind';
import {
  RefInterpreter,
} from './interpret';

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

  emitMetadata (compiler: Compiler, node: SyntaxNode): Report<SymbolMetadata[]> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Ref)) return Report.create(PASS_THROUGH);

    const field = getBody(node)[0];
    if (!(field instanceof FunctionApplicationNode) || !field.callee) return Report.create(PASS_THROUGH);
    const infix = field.callee;
    if (!(infix instanceof InfixExpressionNode) || !infix.op) return Report.create(PASS_THROUGH);

    const op = infix.op.value;
    const relation = op as RefMetadata['relation'];

    // Resolve endpoint table symbols
    const resolveTable = (operand: SyntaxNode | undefined): NodeSymbol | undefined => {
      if (!operand) return undefined;
      const programNode = compiler.parseFile(node.filepath).getValue().ast;
      const globalSymbol = compiler.nodeSymbol(programNode).getValue();
      if (globalSymbol === UNHANDLED) return undefined;
      return nodeRefereeOfRefEndpoint(compiler, globalSymbol, operand).getValue();
    };

    const leftTable = resolveTable(infix.leftExpression);
    const rightTable = resolveTable(infix.rightExpression);
    if (!leftTable || !rightTable) return Report.create(PASS_THROUGH);

    // Extract settings
    let onDelete: string | undefined;
    let onUpdate: string | undefined;
    let color: string | undefined;
    if (field.args[0]) {
      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();
      const del = settingMap.delete?.at(0)?.value;
      onDelete = del instanceof IdentiferStreamNode
        ? extractStringFromIdentifierStream(del) ?? undefined
        : extractVariableFromExpression(del) ?? undefined;
      const upd = settingMap.update?.at(0)?.value;
      onUpdate = upd instanceof IdentiferStreamNode
        ? extractStringFromIdentifierStream(upd) ?? undefined
        : extractVariableFromExpression(upd) ?? undefined;
      color = settingMap.color?.length ? parseColor(settingMap.color?.at(0)?.value as any) : undefined;
    }

    const meta: RefMetadata = {
      kind: MetadataKind.Ref,
      target: leftTable,
      relation,
      onDelete,
      onUpdate,
      color,
      declaration: node,
    };

    // Emit to both endpoint tables
    const result: SymbolMetadata[] = [
      meta,
    ];
    if (rightTable.intern() !== leftTable.intern()) {
      result.push({
        ...meta,
        target: rightTable,
      });
    }
    return Report.create(result);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Ref)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new RefBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: SymbolMetadata): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata.kind !== MetadataKind.Ref) return Report.create(PASS_THROUGH);
    if (!(metadata.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);

    return new RefInterpreter(compiler, metadata.declaration).interpret();
  },
};

function getDefaultSchemaSymbol (compiler: Compiler, globalSymbol: NodeSymbol): NodeSymbol | undefined {
  const membersList = compiler.symbolMembers(globalSymbol).getFiltered(UNHANDLED);
  if (!membersList) return undefined;

  return membersList.find((m: NodeSymbol) =>
    m.isPublicSchema(),
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
      const tableSymbol = compiler.nodeReferee(leftExpr).getFiltered(UNHANDLED);
      if (tableSymbol?.isKind(SymbolKind.Table)) {
        return compiler.lookupMembers(tableSymbol, SymbolKind.Column, name, false, node);
      }
    }

    return Report.create(undefined);
  }

  // Right side of access expression - resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return compiler.lookupMembers(left, [
        SymbolKind.Table,
        SymbolKind.Schema,
      ], name, false, node);
    }
    if (left.isKind(SymbolKind.Table)) {
      return compiler.lookupMembers(left, SymbolKind.Column, name, false, node);
    }
    return new Report(undefined);
  }

  // Left side of access expression - look up as Table or Schema
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If parent is also left side of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      return compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name, false, node);
    }
    // Otherwise look up as Table (by name or alias) in public schema, then program scope
    const schemaSymbol = getDefaultSchemaSymbol(compiler, globalSymbol);
    if (schemaSymbol) {
      const result = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, name, true, node);
      if (result.getValue()) return result;
    }
    return compiler.lookupMembers(globalSymbol, SymbolKind.Table, name, false, node);
  }

  return new Report(undefined);
}
