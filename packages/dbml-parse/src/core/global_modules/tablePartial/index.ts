import {
  isElementNode,
  isExpressionAVariableNode,
  isAccessExpression,
  isElementFieldNode,
  isInsideElementBody,
  isWithinNthArgOfField,
  isInsideSettingValue,
  extractVarNameFromPrimaryVariable,
  getBody,
} from '@/core/utils/expression';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { InfixExpressionNode, ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, type PassThrough, UNHANDLED } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import { getNodeMemberSymbols, lookupMember, nodeRefereeOfLeftExpression, lookupInDefaultSchema, shouldInterpretNode } from '../utils';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { tableUtils } from '../table';
import TablePartialBinder from './bind';
import { TablePartialInterpreter } from './interpret';

// Public utils that other modules can use
export const tablePartialUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `TablePartial name '${name}' already exists in schema '${schemaLabel}'`, errorNode);
  },
};

export const tablePartialModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TablePartial)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.TablePartial,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.TablePartial)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, { kind: SymbolKind.Column, declaration: node }, node.filepath));
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (symbol.isKind(SymbolKind.TablePartial)) {
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
        if (!member.isKind(SymbolKind.Column) || !member.declaration) continue; // Ignore non-column members

        const nameResult = compiler.fullname(member.declaration);
        if (nameResult.hasValue(UNHANDLED)) continue;
        const name = nameResult.getValue()?.at(-1);
        if (!name) continue; // Column must always have a name!

        const errorNode = (member.declaration instanceof ElementDeclarationNode && member.declaration.name) ? member.declaration.name : member.declaration;
        const firstNode = seen.get(name);
        if (firstNode) {
          errors.push(tableUtils.getColumnDuplicateError(name, firstNode));
          errors.push(tableUtils.getColumnDuplicateError(name, errorNode));
        } else {
          seen.set(name, errorNode);
        }
      }

      return new Report(members, errors);
    }
    if (symbol.isKind(SymbolKind.TablePartialField)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node) && !isAccessExpression(node)) return Report.create(PASS_THROUGH);
    if (!isInsideElementBody(node, ElementKind.TablePartial)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parse(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();
    if (globalSymbol === UNHANDLED) return Report.create(undefined);

    // Case 1: Column's enum type
    if (isWithinNthArgOfField(node, 1)) {
      return nodeRefereeOfEnumType(compiler, globalSymbol, node);
    }

    // Case 2: Column's inline ref
    if (isInsideSettingValue(node, SettingName.Ref)) {
      return nodeRefereeOfInlineRef(compiler, globalSymbol, node);
    }

    // Case 3: Column's default value being an enum value
    return nodeRefereeOfEnumDefault(compiler, globalSymbol, node);
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TablePartial)) {
      return getNodeMemberSymbols(compiler, node);
    }
    if (isElementFieldNode(node, ElementKind.TablePartial)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.TablePartial)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new TablePartialBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind());
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.TablePartial)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new TablePartialInterpreter(compiler, node).interpret();
  },
};

// nodeReferee utils
function nodeRefereeOfEnumType (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: try as enum in default schema, ignore if not found (could be a raw type like varchar)
  if (!isAccessExpression(node.parentNode)) {
    return lookupInDefaultSchema(compiler, globalSymbol, name, { kinds: [SymbolKind.Enum], ignoreNotFound: true });
  }

  // In access expression: must resolve, report errors
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (!left) return new Report(undefined);

  if (left.isKind(SymbolKind.Schema)) {
    return lookupMember(compiler, left, name, { kinds: [SymbolKind.Enum, SymbolKind.Schema] });
  }

  return new Report(undefined);
}

// Inline ref: column or schema.table.column
// Standalone variables are ignored (could be partial-local column references)
function nodeRefereeOfInlineRef (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  if (!isAccessExpression(node.parentNode)) {
    // Standalone column ref: look up in the enclosing TablePartial
    const enclosingPartial = node.parent;
    if (enclosingPartial instanceof ElementDeclarationNode && enclosingPartial.isKind(ElementKind.TablePartial)) {
      const partialSymbol = compiler.nodeSymbol(enclosingPartial);
      if (!partialSymbol.hasValue(UNHANDLED)) {
        return lookupMember(compiler, partialSymbol.getValue(), name, { kinds: [SymbolKind.Column], ignoreNotFound: false, errorNode: node });
      }
    }
    return lookupMember(compiler, globalSymbol, name, { kinds: [SymbolKind.Column], ignoreNotFound: true, errorNode: node });
  }

  // Right side of access: resolve using the left sibling's referee
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return lookupMember(compiler, left, name, { kinds: [SymbolKind.Table, SymbolKind.Schema] });
    }
    if (left.isKind(SymbolKind.Table)) {
      return lookupMember(compiler, left, name, { kinds: [SymbolKind.Column] });
    }
    return new Report(undefined);
  }

  // Left side of access: look up as Table or Schema in default schema
  return lookupInDefaultSchema(compiler, globalSymbol, name, { kinds: [SymbolKind.Table, SymbolKind.Schema], ignoreNotFound: false, errorNode: node });
}

// Default value: enum.field or schema.enum.field
function nodeRefereeOfEnumDefault (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: ignore (could be a literal like null/true/false)
  if (!isAccessExpression(node.parentNode)) {
    return new Report(undefined);
  }

  // In access expression: must resolve, report errors
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (!left) return new Report(undefined);

  if (left.isKind(SymbolKind.Schema)) {
    return lookupMember(compiler, left, name, { kinds: [SymbolKind.Enum, SymbolKind.Schema] });
  }
  if (left.isKind(SymbolKind.Enum)) {
    return lookupMember(compiler, left, name, { kinds: [SymbolKind.EnumField] });
  }

  return new Report(undefined);
}
