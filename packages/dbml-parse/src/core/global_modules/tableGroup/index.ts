import {
  isElementNode, isExpressionAVariableNode, isAccessExpression, isElementFieldNode, isInsideElementBody, isInsideSettingList, getBody,
} from '@/core/utils/expression';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PrimaryExpressionNode, VariableNode, ElementDeclarationNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  NodeSymbol, SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  GlobalModule,
} from '../types';
import {
  DEFAULT_SCHEMA_NAME, PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  getNodeMemberSymbols, lookupMember, nodeRefereeOfLeftExpression, shouldInterpretNode,
} from '../utils';
import {
  extractVarNameFromPrimaryVariable,
} from '@/core/utils/expression';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import TableGroupBinder from './bind';
import {
  TableGroupInterpreter,
} from './interpret';

// Public utils that other modules can use
export const tableGroupUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `TableGroup name '${name}' already exists in schema '${schemaLabel}'`, errorNode);
  },
  getFieldDuplicateError (name: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Duplicate TableGroupField '${name}'`, errorNode);
  },
};

export const tableGroupModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.TableGroup,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.TableGroupField,
        declaration: node,
      }, node.filepath));
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (symbol.isKind(SymbolKind.TableGroup)) {
      const node = symbol.declaration;
      if (!(node instanceof ElementDeclarationNode)) return new Report([]);
      const children = getBody(node);

      const members: NodeSymbol[] = [];
      const errors: CompileError[] = [];
      for (const child of children) {
        const res = compiler.nodeSymbol(child);
        if (res.hasValue(UNHANDLED)) continue;
        members.push(res.getValue());
        errors.push(...res.getErrors());
      }
      return new Report(members, errors);
    }
    if (symbol.isKind(SymbolKind.TableGroupField)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return Report.create(PASS_THROUGH);
    if (!isInsideElementBody(node, ElementKind.TableGroup)) return Report.create(PASS_THROUGH);
    // Skip variables inside setting lists
    if (node.parent && isInsideSettingList(node)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();
    if (globalSymbol === UNHANDLED) return Report.create(undefined);

    return nodeRefereeOfTableGroupField(compiler, globalSymbol, node);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.TableGroup)) return Report.create(PASS_THROUGH);
    return Report.create(
      undefined,
      new TableGroupBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.TableGroup)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new TableGroupInterpreter(compiler, node).interpret();
  },
};

// nodeReferee utils
function nodeRefereeOfTableGroupField (compiler: Compiler, globalSymbol: NodeSymbol, node: PrimaryExpressionNode & { expression: VariableNode }): Report<NodeSymbol | undefined> {
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: lookup as Table (by name or alias) in all schemas
  if (!isAccessExpression(node.parentNode)) {
    const schemas = compiler.symbolMembers(globalSymbol);
    if (!schemas.hasValue(UNHANDLED)) {
      for (const schema of schemas.getValue()) {
        if (!(schema instanceof SchemaSymbol)) continue;
        // lookupMember checks aliases only for public schemas; for non-public, also check aliases explicitly
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

  // Right side of access: resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return lookupMember(compiler, left, name, {
        kinds: [SymbolKind.Table, SymbolKind.Schema],
      });
    }
    return new Report(undefined);
  }

  // Left side of access: look up as Schema
  return lookupMember(compiler, globalSymbol, name, {
    kinds: [SymbolKind.Schema],
  });
}
