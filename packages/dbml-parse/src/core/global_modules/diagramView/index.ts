import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode,
  PrimaryExpressionNode, VariableNode,
  WildcardNode,
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
  extractVarNameFromPrimaryVariable, getBody, isAccessExpression, isElementFieldNode, isElementNode, isExpressionAVariableNode, isInsideSettingList, isTerminalAccessFragment,
} from '@/core/utils/expression';
import type {
  GlobalModule,
} from '../types';
import {
  lookupInDefaultSchema, lookupMember, nodeRefereeOfLeftExpression, shouldInterpretNode,
} from '../utils';
import DiagramViewBinder from './bind';
import {
  DiagramViewInterpreter,
} from './interpret';
import {
  CompileError, CompileErrorCode,
} from '@/core/types';
import {
  addDoubleQuoteIfNeeded,
} from '@/compiler/index';

// Public utils that other modules can use
export const diagramViewUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `DiagramView '${name}' already exists in schema '${schemaLabel}'`, errorNode);
  },
  getFieldDuplicateError (name: string, elementKind: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate ${elementKind} ${name}`, errorNode);
  },
};

export const diagramViewModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.DiagramView)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramView,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.DiagramView) && node instanceof WildcardNode) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramViewTopLevelWildcard,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.DiagramViewNotes)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramViewNote,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.DiagramViewTables)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramViewTable,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.DiagramViewTableGroups)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramViewTableGroup,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.DiagramViewSchemas)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramViewSchema,
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

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.DiagramView)) return Report.create(PASS_THROUGH);
    if (!symbol.declaration) return Report.create([]);
    const declaration = symbol.declaration;
    if (!isElementNode(declaration, ElementKind.DiagramView)) return Report.create([]);

    const errors: CompileError[] = [];
    const members: NodeSymbol[] = [];
    for (const node of getBody(declaration)) {
      if (node instanceof FunctionApplicationNode) {
        const symbol = compiler.nodeSymbol(node).getFiltered(UNHANDLED);
        if (symbol) members.push(symbol);
      } else if (node instanceof ElementDeclarationNode) {
        members.push(...getBody(node).flatMap((n) => compiler.nodeSymbol(n).getFiltered(UNHANDLED) ?? []));
      }
    }

    // Duplicate checking
    const seen = new Map<string, SyntaxNode>();
    for (const member of members) {
      if (!member.isKind(
        SymbolKind.DiagramViewSchema,
        SymbolKind.DiagramViewTableGroup,
        SymbolKind.DiagramViewTable,
        SymbolKind.DiagramViewNote,
      ) || !member.declaration) continue; // Ignore non-diagramview-field members

      const name = (compiler.nodeFullname(member.declaration).getFiltered(UNHANDLED) || []).map(addDoubleQuoteIfNeeded).join('.');
      const key = `${member.kind}:${name}`;

      if (name !== undefined) {
        const errorNode = member.declaration;

        const firstNode = seen.get(key);
        if (firstNode) {
          errors.push(diagramViewUtils.getFieldDuplicateError(name, member.kind, firstNode));
          errors.push(diagramViewUtils.getFieldDuplicateError(name, member.kind, errorNode));
        } else {
          seen.set(key, errorNode);
        }
      }
    }

    return Report.create(
      members,
      errors,
    );
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
function getContainingDiagramViewSubBlock (node: SyntaxNode): ElementDeclarationNode | undefined {
  const parentField = node.parentOfKind(FunctionApplicationNode);
  if (!parentField) return undefined;

  const subBlockBody = parentField.parentNode;
  if (!(subBlockBody instanceof BlockExpressionNode)) return undefined;

  const subBlock = subBlockBody.parentNode;
  if (!(subBlock instanceof ElementDeclarationNode)) return undefined;
  if (!subBlock.isKind(
    ElementKind.DiagramViewTables,
    ElementKind.DiagramViewNotes,
    ElementKind.DiagramViewTableGroups,
    ElementKind.DiagramViewSchemas,
  )) return undefined;

  const dvBody = subBlock.parentNode;
  if (!(dvBody instanceof BlockExpressionNode)) return undefined;

  const diagramView = dvBody.parentNode;
  if (!(diagramView instanceof ElementDeclarationNode) || !diagramView.isKind(ElementKind.DiagramView)) return undefined;

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
  // resolve via the left sibling's schema symbol.
  // If this access expression is itself nested inside another (e.g. `public` in `auth.public.users`),
  // the fragment is intermediate and must resolve to Schema; otherwise it is terminal and must be Table.
  if (isAccessExpression(node.parentNode)) {
    const left = nodeRefereeOfLeftExpression(compiler, node);
    if (left) {
      if (left.isKind(SymbolKind.Schema)) {
        const isTerminal = isTerminalAccessFragment(node);
        return lookupMember(compiler, left, name, {
          kinds: isTerminal
            ? [
                SymbolKind.Table,
              ]
            : [
                SymbolKind.Schema,
              ],
          errorNode: node,
        });
      }
      return new Report(undefined);
    }
    // Left side of access: always a Schema
    return lookupMember(compiler, globalSymbol, name, {
      kinds: [
        SymbolKind.Schema,
      ],
      errorNode: node,
    });
  }

  // Standalone reference
  const members = compiler.symbolMembers(globalSymbol).getFiltered(UNHANDLED) || [];
  for (const member of members) {
    const memberName = compiler.symbolName(member);
    if (member.isKind(SymbolKind.Table) && name === memberName) return Report.create(member);
  }

  return lookupMember(compiler, globalSymbol, name, {
    kinds: [
      SymbolKind.Table,
    ],
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
    kinds: [
      kind,
    ],
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
    kinds: [
      SymbolKind.Schema,
    ],
    errorNode: node,
  });
}
