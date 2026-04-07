import { isElementNode, isExpressionAVariableNode, isAccessExpression, isElementFieldNode, isInsideElementBody, isInsideSettingList, getBody } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import { PrimaryExpressionNode, VariableNode, ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { DEFAULT_SCHEMA_NAME, PASS_THROUGH, type PassThrough, UNHANDLED } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import { getNodeMemberSymbols, lookupMember, nodeRefereeOfLeftExpression } from '../utils';
import { extractVarNameFromPrimaryVariable } from '@/core/utils/expression';
import { CompileError, CompileErrorCode } from '@/core/errors';
import TableGroupBinder from './bind';
import { TableGroupInterpreter } from './interpret';
import { addDoubleQuoteIfNeeded } from '@/compiler/index';

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
      }));
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, { kind: SymbolKind.TableGroupField, declaration: node }));
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
      const seen = new Map<string, SyntaxNode>();

      // Duplicate checking
      for (const member of members) {
        if (!member.isKind(SymbolKind.TableGroupField) || !member.declaration) continue; // Ignore non-field members

        const nameResult = compiler.fullname(member.declaration);
        if (nameResult.hasValue(UNHANDLED)) continue;
        const name = nameResult.getValue()?.map(addDoubleQuoteIfNeeded)?.join('.');
        if (!name) continue; // Field must always have a name!

        const errorNode = (member.declaration instanceof ElementDeclarationNode && member.declaration.name) ? member.declaration.name : member.declaration;
        const firstNode = seen.get(name);
        if (firstNode) {
          errors.push(tableGroupUtils.getFieldDuplicateError(name, firstNode));
          errors.push(tableGroupUtils.getFieldDuplicateError(name, errorNode));
        } else {
          seen.set(name, errorNode);
        }
      }

      return new Report(members, errors);
    }
    if (symbol.isKind(SymbolKind.TableGroupField)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      return getNodeMemberSymbols(compiler, node);
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return Report.create(PASS_THROUGH);
    if (!isInsideElementBody(node, ElementKind.TableGroup)) return Report.create(PASS_THROUGH);
    // Skip variables inside setting lists
    if (node.parent && isInsideSettingList(node)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile().getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();
    if (globalSymbol === UNHANDLED) return Report.create(undefined);

    return nodeRefereeOfTableGroupField(compiler, globalSymbol, node);
  },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.TableGroup)) return Report.create(PASS_THROUGH);
    return Report.create(
      undefined,
      new TableGroupBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.TableGroup)) return Report.create(PASS_THROUGH);
    if (compiler.bind(node).getErrors().length + compiler.validate(node).getErrors().length > 0) return Report.create(undefined);
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
        const result = lookupMember(compiler, schema, name, { kinds: [SymbolKind.Table], ignoreNotFound: true, errorNode: node });
        if (result.getValue()) return result;
      }
    }
    return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Table], ignoreNotFound: false, errorNode: node });
  }

  // Right side of access: resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return lookupMember(compiler, left, name, { kinds: [SymbolKind.Table, SymbolKind.Schema] });
    }
    return new Report(undefined);
  }

  // Left side of access: look up as Schema
  return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Schema] });
}
