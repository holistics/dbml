import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  RecordsMetadata,
} from '@/core/types/symbol/metadata';
import type {
  NodeMetadata,
} from '@/core/types/symbol/metadata';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  CallExpressionNode,
  ElementDeclarationNode,
  InfixExpressionNode,
  TupleExpressionNode,
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
  destructureMemberAccessExpression,
  extractVarNameFromPrimaryVariable,
} from '@/core/utils/expression';
import {
  isAccessExpression,
  isElementNode,
  isExpressionAVariableNode,
} from '@/core/utils/validate';
import {
  CompileError, CompileErrorCode,
} from '@/core/types';
import type {
  GlobalModule,
} from '../types';
import {
  nodeRefereeOfLeftExpression,
} from '../utils';
import RecordsBinder from './bind';
import RecordsInterpreter from './interpret';

export const recordsModule: GlobalModule = {
  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Records)) return Report.create(PASS_THROUGH);

    // Case 1: Nested records inside a table element
    const tableNode = node.parent;
    if (tableNode && isElementNode(tableNode, ElementKind.Table)) {
      return Report.create(new RecordsMetadata(node));
    }

    // Case 2: Standalone records - `records tablename(cols) { ... }`
    const nameNode = (node as ElementDeclarationNode).name;
    if (nameNode instanceof CallExpressionNode && nameNode.callee) {
      return Report.create(new RecordsMetadata(node));
    }

    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return Report.create(PASS_THROUGH);

    const recordsNode = node.parentOfKind(ElementDeclarationNode);
    if (!recordsNode?.isKind(ElementKind.Records)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getFiltered(UNHANDLED);
    if (!globalSymbol) return Report.create(undefined);

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

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Records)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new RecordsBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(metadata instanceof RecordsMetadata)) return Report.create(PASS_THROUGH);
    if (!(metadata.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);

    return new RecordsInterpreter(compiler, metadata, filepath).interpret();
  },
};

// nodeReferee utils
function nodeRefereeOfTupleColumn (compiler: Compiler, recordsNode: ElementDeclarationNode, node: SyntaxNode): Report<NodeSymbol | undefined> {
  const tableNode = recordsNode.parent;
  if (tableNode instanceof ElementDeclarationNode && tableNode.isKind(ElementKind.Table)) {
    const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
    if (tableSymbol) {
      return nodeRefereeOfRecordsColumn(compiler, tableSymbol, node);
    }
  }
  return new Report(undefined);
}

function nodeRefereeOfCallColumn (compiler: Compiler, callParent: CallExpressionNode, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (callParent.callee) {
    let tableSymbol: NodeSymbol | undefined;
    if (isExpressionAVariableNode(callParent.callee)) {
      tableSymbol = compiler.nodeReferee(callParent.callee).getFiltered(UNHANDLED);
    } else {
      const fragments = destructureMemberAccessExpression(callParent.callee);
      if (fragments && fragments.length > 0) {
        const lastFragment = fragments[fragments.length - 1];
        tableSymbol = compiler.nodeReferee(lastFragment).getFiltered(UNHANDLED);
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
    const symbol = compiler.lookupMembers(
      globalSymbol,
      [
        SymbolKind.Table,
        SymbolKind.Schema,
      ],
      name,
    );
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (!left) {
    const symbol = compiler.lookupMembers(
      globalSymbol,
      [
        SymbolKind.Table,
        SymbolKind.Schema,
      ],
      name,
    );
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table or schema '${name}' does not exist`, node),
    ]);
  }

  if (left.isKind(SymbolKind.Schema)) {
    const symbol = compiler.lookupMembers(
      left,
      [
        SymbolKind.Table,
        SymbolKind.Schema,
      ],
      name,
    );
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table or schema '${name}' does not exist`, node),
    ]);
  }

  return new Report(undefined);
}

// Records column ref: column name inside (col1, col2) tuple
// Resolves against the parent table's columns
function nodeRefereeOfRecordsColumn (compiler: Compiler, tableSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);

  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  const symbol = compiler.lookupMembers(
    tableSymbol,
    SymbolKind.Column,
    name,
  );
  if (symbol) {
    return Report.create(symbol);
  }

  return new Report(undefined, [
    new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in Table 'public.${tableSymbol.name}'`, node),
  ]);
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
      const symbol = compiler.lookupMembers(left, [
        SymbolKind.Enum,
        SymbolKind.Schema,
      ], name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Enum or schema '${name}' does not exist`, node),
      ]);
    }
    if (left.isKind(SymbolKind.Enum)) {
      const symbol = compiler.lookupMembers(left, SymbolKind.EnumField, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Enum field '${name}' does not exist in Enum 'public.${left.name}'`, node),
      ]);
    }

    return new Report(undefined);
  }

  // Left side of access: look up as Enum or Schema in program scope
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If our parent is also the left side of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist in Schema 'public'`, node),
      ]);
    }
    // Look up as Enum in default (public) schema
    const symbol = compiler.lookupMembers(
      globalSymbol,
      SymbolKind.Enum,
      name,
    );
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Enum '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  return new Report(undefined);
}
