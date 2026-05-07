import type Compiler from '@/compiler/index';
import {
  addDoubleQuoteIfNeeded,
} from '@/compiler/queries/utils';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  ElementDeclarationNode,
  PrimaryExpressionNode,
  VariableNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, SchemaSymbol, SymbolKind, TableGroupFieldSymbol, TableGroupSymbol,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  extractVarNameFromPrimaryVariable,
  getBody,
} from '@/core/utils/expression';
import type {
  GlobalModule,
} from '../types';
import {
  nodeRefereeOfLeftExpression, shouldInterpretNode,
} from '../utils';
import TableGroupBinder from './bind';
import {
  TableGroupInterpreter,
} from './interpret';
import {
  isAccessExpression,
  isElementFieldNode, isElementNode,
  isExpressionAVariableNode,
  isInsideElementBody,
  isInsideSettingList,
} from '@/core/utils/validate';
import type {
  Filepath,
} from '@/core/types';

// Public utils that other modules can use
export const tableGroupUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `TableGroup '${name}' already exists in schema '${schemaLabel}'`, errorNode);
  },
  getFieldDuplicateError (name: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Duplicate TableGroupField '${name}'`, errorNode);
  },
};

export const tableGroupModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    const fullname = compiler.nodeFullname(node).getFiltered(UNHANDLED);
    const name = fullname?.at(-1);
    if (isElementNode(node, ElementKind.TableGroup)) {
      return new Report(compiler.symbolFactory.create(TableGroupSymbol, {
        declaration: node,
        name,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report(compiler.symbolFactory.create(TableGroupFieldSymbol, {
        declaration: node,
        name: fullname?.map(addDoubleQuoteIfNeeded).join('.'),
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
        const symbol = res.getFiltered(UNHANDLED);
        if (!symbol) continue;
        members.push(symbol);
        errors.push(...res.getErrors());
      }
      // Duplicate checking
      const seen = new Map<string, SyntaxNode>();
      for (const member of members) {
        if (!member.isKind(SymbolKind.TableGroupField) || !member.declaration) continue;
        const key = `${member.kind}:${member.name}`;

        if (member.name !== undefined) {
          const errorNode = (
            member.declaration instanceof ElementDeclarationNode && member.declaration.name
          )
            ? member.declaration.name
            : member.declaration;

          const firstNode = seen.get(key);
          if (firstNode) {
            errors.push(tableGroupUtils.getFieldDuplicateError(member.name, firstNode));
            errors.push(tableGroupUtils.getFieldDuplicateError(member.name, errorNode));
          } else {
            seen.set(key, errorNode);
          }
        }
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

    const declaration = node as ElementDeclarationNode & { type: SyntaxToken };
    const errors = new TableGroupBinder(compiler, declaration).bind();
    const symbol = compiler.nodeSymbol(node).getFiltered(UNHANDLED);
    if (symbol) errors.push(...compiler.symbolMembers(symbol).getErrors());
    return Report.create(undefined, errors);
  },

  interpretSymbol (compiler: Compiler, symbol: NodeSymbol, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    const node = symbol.declaration;
    if (!isElementNode(node, ElementKind.TableGroup) || !(symbol instanceof TableGroupSymbol)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new TableGroupInterpreter(compiler, symbol, filepath).interpret();
  },
};

// nodeReferee utils
function nodeRefereeOfTableGroupField (compiler: Compiler, globalSymbol: NodeSymbol, node: PrimaryExpressionNode & { expression: VariableNode }): Report<NodeSymbol | undefined> {
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: lookup as Table (by name or alias) in public schema only
  if (!isAccessExpression(node.parentNode)) {
    const schemasList = compiler.symbolMembers(globalSymbol).getFiltered(UNHANDLED);
    if (schemasList) {
      const publicSchema = schemasList.find((s): s is SchemaSymbol => s instanceof SchemaSymbol && s.isPublicSchema());
      if (publicSchema) {
        const result = compiler.lookupMembers(publicSchema, SymbolKind.Table, name);
        if (result) return Report.create(result);
      }
    }
    const sym = compiler.lookupMembers(globalSymbol, SymbolKind.Table, name);
    if (sym) return Report.create(sym);
    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  // Right side of access: resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      const sym = compiler.lookupMembers(left, [
        SymbolKind.Table,
        SymbolKind.Schema,
      ], name);
      if (sym) return Report.create(sym);
      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Table or schema '${name}' does not exist`, node),
      ]);
    }
    return new Report(undefined);
  }

  // Left side of access: look up as Schema
  const sym = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
  if (sym) return Report.create(sym);
  return new Report(undefined, [
    new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist`, node),
  ]);
}
