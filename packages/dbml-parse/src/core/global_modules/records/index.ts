import {
  isElementNode,
  isExpressionAVariableNode,
  isAccessExpression,
  destructureMemberAccessExpression,
  extractVarNameFromPrimaryVariable,
} from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import {
  CallExpressionNode,
  ElementDeclarationNode,
  InfixExpressionNode,
  TupleExpressionNode,
} from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, UNHANDLED, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import { lookupMember, lookupInDefaultSchema, nodeRefereeOfLeftExpression } from '../utils';
import { CompileError, CompileErrorCode } from '@/core/errors';
import type { TableRecord } from '@/core/types/schemaJson';
import RecordsBinder from './bind';
import RecordsInterpreter from './interpret';

export const recordsModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Records)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report(compiler.symbolFactory.create(NodeSymbol, {
      kind: SymbolKind.Records,
      declaration: node,
    }, node.filepath));
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Records)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report([]); // Records do not have any members
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Records)) {
      return Report.create(PASS_THROUGH);
    }
    return new Report([]);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return Report.create(PASS_THROUGH);

    const recordsNode = node.parentOfKind(ElementDeclarationNode);
    if (!recordsNode?.isKind(ElementKind.Records)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();
    if (globalSymbol === UNHANDLED) return Report.create(undefined);

    // Case 1: Column in tuple directly under records: (col1, col2)
    const tupleParent = node.parentOfKind(TupleExpressionNode);
    if (tupleParent?.parentNode === recordsNode) {
      return nodeRefereeOfTupleColumn(compiler, recordsNode, node);
    }

    // Case 2: Column in call expression args: [schema*].table(col1, col2)
    const callParent = node.parentOfKind(CallExpressionNode);
    if (callParent?.parentNode === recordsNode && tupleParent?.parentNode === callParent) {
      return nodeRefereeOfCallColumn(compiler, callParent, node);
    }

    // Case 3: Table/schema in call expression callee: [schema*].table(...)
    if (callParent?.parentNode === recordsNode && callParent.callee?.containsEq(node)) {
      return nodeRefereeOfRecordsName(compiler, globalSymbol, node);
    }

    // Case 4: Data row values - enum.field or schema.enum.field
    return nodeRefereeOfEnumValue(compiler, globalSymbol, node);
  },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Records)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new RecordsBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind());
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<TableRecord | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Records)) return Report.create(PASS_THROUGH);
    if (compiler.bind(node).getErrors().length + compiler.validate(node).getErrors().length > 0) return Report.create(undefined);
    return new RecordsInterpreter(compiler, node).interpret();
  },
};

// nodeReferee utils
function nodeRefereeOfTupleColumn (compiler: Compiler, recordsNode: ElementDeclarationNode, node: SyntaxNode): Report<NodeSymbol | undefined> {
  const tableNode = recordsNode.parent;
  if (tableNode instanceof ElementDeclarationNode && tableNode.isKind(ElementKind.Table)) {
    const tableSymbol = compiler.nodeSymbol(tableNode);
    if (!tableSymbol.hasValue(UNHANDLED)) {
      return nodeRefereeOfRecordsColumn(compiler, tableSymbol.getValue(), node);
    }
  }
  return new Report(undefined);
}

function nodeRefereeOfCallColumn (compiler: Compiler, callParent: CallExpressionNode, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (callParent.callee) {
    let tableSymbol: NodeSymbol | undefined;
    if (isExpressionAVariableNode(callParent.callee)) {
      const tableReferee = compiler.nodeReferee(callParent.callee);
      if (!tableReferee.hasValue(UNHANDLED)) tableSymbol = tableReferee.getValue() ?? undefined;
    } else {
      const fragments = destructureMemberAccessExpression(callParent.callee);
      if (fragments && fragments.length > 0) {
        const lastFragment = fragments[fragments.length - 1];
        const tableReferee = compiler.nodeReferee(lastFragment);
        if (!tableReferee.hasValue(UNHANDLED)) tableSymbol = tableReferee.getValue() ?? undefined;
      }
    }
    if (tableSymbol) {
      return nodeRefereeOfRecordsColumn(compiler, tableSymbol, node);
    }
  }
  return new Report(undefined);
}

// Records name callee: [schema*].table
// Standalone: look up as table or schema
// In access: left is schema -> table/schema
function nodeRefereeOfRecordsName (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  if (!isAccessExpression(node.parentNode)) {
    return lookupInDefaultSchema(compiler, globalSymbol, name, { kinds: [SymbolKind.Table, SymbolKind.Schema] });
  }

  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (!left) {
    return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Table, SymbolKind.Schema] });
  }

  if (left.isKind(SymbolKind.Schema)) {
    return lookupMember(compiler, left, name, { kinds: [SymbolKind.Table, SymbolKind.Schema] });
  }

  return new Report(undefined);
}

// Records column ref: column name inside (col1, col2) tuple
// Resolves against the parent table's columns
function nodeRefereeOfRecordsColumn (compiler: Compiler, tableSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';
  return lookupMember(compiler, tableSymbol, name, { kinds: [SymbolKind.Column] });
}

// Records body enum value: enum.field or schema.enum.field
function nodeRefereeOfEnumValue (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: ignore (could be a literal like null/true/false)
  if (!isAccessExpression(node.parentNode)) {
    return new Report(undefined);
  }

  // Right side of access: resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return lookupMember(compiler, left, name, { kinds: [SymbolKind.Enum, SymbolKind.Schema] });
    }
    if (left.isKind(SymbolKind.Enum)) {
      return lookupMember(compiler, left, name, { kinds: [SymbolKind.EnumField] });
    }
    return new Report(undefined);
  }

  // Left side of access: look up as Enum or Schema in program scope
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If our parent is also the left side of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Schema] });
    }
    // Look up as Enum in default (public) schema first, then fall back to program scope
    const result = lookupInDefaultSchema(compiler, globalSymbol, name, { kinds: [SymbolKind.Enum], ignoreNotFound: true });
    const sym = result.getValue();
    if (sym && sym.declaration) {
      // Verify the enum is not schema-qualified when accessed without schema
      const fn = compiler.fullname(sym.declaration);
      if (!fn.hasValue(UNHANDLED) && fn.getValue() && fn.getValue()!.length > 1) {
        // Schema-qualified enum accessed without schema prefix - report error
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.BINDING_ERROR,
            `Enum '${name}' does not exist in Schema 'public'`,
            node,
          ),
        ]);
      }
      return result;
    }
    // Not found at all - report error
    return lookupInDefaultSchema(compiler, globalSymbol, name, { kinds: [SymbolKind.Enum] });
  }

  return new Report(undefined);
}
