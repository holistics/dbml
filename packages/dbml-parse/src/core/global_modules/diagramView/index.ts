import { ElementKind } from '@/core/types/keywords';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode,
  PrimaryExpressionNode, VariableNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import DiagramViewBinder from './bind';
import {
  NodeSymbol, SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import type { GlobalModule } from '../types';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import {
  isAccessExpression, isElementNode, isExpressionAVariableNode, isInsideSettingList,
} from '@/core/utils/expression';
import {
  lookupMember, lookupInDefaultSchema, nodeRefereeOfLeftExpression, shouldInterpretNode,
} from '../utils';
import { extractVarNameFromPrimaryVariable } from '@/core/utils/expression';
import { DiagramViewInterpreter } from './interpret';

export const diagramViewModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.DiagramView)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramView,
        declaration: node,
      }, node.filepath));
    }
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return Report.create(PASS_THROUGH);
    if (node.parent && isInsideSettingList(node)) return Report.create(PASS_THROUGH);

    const subBlock = getContainingDiagramViewSubBlock(node);
    if (!subBlock) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getFiltered(UNHANDLED);
    if (!globalSymbol) return Report.create(undefined);

    if (subBlock.isKind(ElementKind.DiagramViewTables)) {
      return nodeRefereeOfDiagramViewTableRef(compiler, globalSymbol, node as PrimaryExpressionNode & { expression: VariableNode });
    }
    if (subBlock.isKind(ElementKind.DiagramViewNotes)) {
      return nodeRefereeOfDiagramViewSimpleRef(compiler, globalSymbol, node as PrimaryExpressionNode & { expression: VariableNode }, SymbolKind.Note);
    }
    if (subBlock.isKind(ElementKind.DiagramViewTableGroups)) {
      return nodeRefereeOfDiagramViewSimpleRef(compiler, globalSymbol, node as PrimaryExpressionNode & { expression: VariableNode }, SymbolKind.TableGroup);
    }
    if (subBlock.isKind(ElementKind.DiagramViewSchemas)) {
      return nodeRefereeOfDiagramViewSchemaRef(compiler, globalSymbol, node as PrimaryExpressionNode & { expression: VariableNode });
    }
    return Report.create(PASS_THROUGH);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    const decl = node as ElementDeclarationNode & { type: SyntaxToken };
    const errors = new DiagramViewBinder(compiler, decl).bind();
    return Report.create(undefined, errors);
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new DiagramViewInterpreter(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).interpret();
  },
};

/**
 * Returns the sub-block ElementDeclarationNode (Tables / Notes / TableGroups / Schemas)
 * that contains `node`, IFF it lives inside a DiagramView body. Returns null otherwise.
 */
function getContainingDiagramViewSubBlock (node: SyntaxNode): ElementDeclarationNode | null {
  const parentField = node.parentOfKind(FunctionApplicationNode);
  if (!parentField) return null;

  const subBlockBody = parentField.parentNode;
  if (!(subBlockBody instanceof BlockExpressionNode)) return null;

  const subBlock = subBlockBody.parentNode;
  if (!(subBlock instanceof ElementDeclarationNode)) return null;
  if (!subBlock.isKind(ElementKind.DiagramViewTables, ElementKind.DiagramViewNotes, ElementKind.DiagramViewTableGroups, ElementKind.DiagramViewSchemas)) return null;

  const dvBody = subBlock.parentNode;
  if (!(dvBody instanceof BlockExpressionNode)) return null;

  const diagramView = dvBody.parentNode;
  if (!(diagramView instanceof ElementDeclarationNode) || !diagramView.isKind(ElementKind.DiagramView)) return null;

  return subBlock;
}

/**
 * Resolves a table reference (possibly schema-qualified) inside a DiagramView Tables block.
 * Handles aliases (Table users as U { }) and imports.
 */
function nodeRefereeOfDiagramViewTableRef (
  compiler: Compiler,
  globalSymbol: NodeSymbol,
  node: PrimaryExpressionNode & { expression: VariableNode },
): Report<NodeSymbol | undefined> {
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Right side of access expression (e.g. `public` in `public.users`):
  // resolve via the left sibling's schema symbol
  if (isAccessExpression(node.parentNode)) {
    const left = nodeRefereeOfLeftExpression(compiler, node);
    if (left) {
      if (left.isKind(SymbolKind.Schema)) {
        return lookupMember(compiler, left, name, {
          kinds: [SymbolKind.Table, SymbolKind.Schema],
          errorNode: node,
        });
      }
      return new Report(undefined);
    }
    // Left side of access: look up as Schema
    return lookupMember(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Schema],
      errorNode: node,
    });
  }

  // Standalone reference: search all schemas (aliases included)
  const schemas = compiler.symbolMembers(globalSymbol);
  if (!schemas.hasValue(UNHANDLED)) {
    for (const schema of schemas.getValue()) {
      if (!(schema instanceof SchemaSymbol)) continue;
      const result = lookupMember(compiler, schema, name, {
        kinds: [SymbolKind.Table],
        ignoreNotFound: true,
        errorNode: node,
      });
      if (result.getValue()) return result;
      if (!schema.isPublicSchema()) {
        const members = compiler.symbolMembers(schema);
        if (!members.hasValue(UNHANDLED)) {
          const match = members.getValue().find((m) => {
            if (!m.isKind(SymbolKind.Table) || !m.declaration) return false;
            return compiler.nodeAlias(m.declaration).getFiltered(UNHANDLED) === name;
          });
          if (match) return new Report(match);
        }
      }
    }
  }

  return lookupMember(compiler, globalSymbol, name, {
    kinds: [SymbolKind.Table],
    ignoreNotFound: false,
    errorNode: node,
  });
}

/**
 * Resolves a Note or TableGroup reference inside a DiagramView block.
 */
function nodeRefereeOfDiagramViewSimpleRef (
  compiler: Compiler,
  globalSymbol: NodeSymbol,
  node: PrimaryExpressionNode & { expression: VariableNode },
  kind: SymbolKind,
): Report<NodeSymbol | undefined> {
  const name = extractVarNameFromPrimaryVariable(node) ?? '';
  return lookupInDefaultSchema(compiler, globalSymbol, name, {
    kinds: [kind],
    errorNode: node,
  });
}

/**
 * Resolves a Schema reference inside a DiagramView Schemas block.
 */
function nodeRefereeOfDiagramViewSchemaRef (
  compiler: Compiler,
  globalSymbol: NodeSymbol,
  node: PrimaryExpressionNode & { expression: VariableNode },
): Report<NodeSymbol | undefined> {
  const name = extractVarNameFromPrimaryVariable(node) ?? '';
  return lookupMember(compiler, globalSymbol, name, {
    kinds: [SymbolKind.Schema],
    errorNode: node,
  });
}
