import type Compiler from '@/compiler/index';
import {
  KEYWORDS_OF_DEFAULT_SETTING,
} from '@/constants';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  ElementKind, SettingName,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  ElementDeclarationNode,
  InfixExpressionNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  ColumnSymbol,
  NodeSymbol,
  SymbolKind,
  TablePartialSymbol,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  extractVarNameFromPrimaryVariable,
  getBody,
} from '@/core/utils/expression';
import {
  isAccessExpression,
  isElementFieldNode,
  isElementNode,
  isExpressionAVariableNode,
  isInsideElementBody,
  isInsideSettingValue,
  isWithinNthArgOfField,
} from '@/core/utils/validate';
import {
  tableUtils,
} from '../table';
import type {
  GlobalModule,
} from '../types';
import {
  nodeRefereeOfLeftExpression,
} from '../utils';
import TablePartialBinder from './bind';
import {
  TablePartialInterpreter,
} from './interpret';

// Public utils that other modules can use
export const tablePartialUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `TablePartial '${name}' already exists in schema '${schemaLabel}'`, errorNode);
  },
};

export const tablePartialModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    const name = compiler.nodeFullname(node).getFiltered(UNHANDLED)?.at(-1);
    if (isElementNode(node, ElementKind.TablePartial)) {
      return new Report(compiler.symbolFactory.create(TablePartialSymbol, {
        declaration: node,
        name,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.TablePartial)) {
      return new Report(compiler.symbolFactory.create(ColumnSymbol, {
        declaration: node,
        name,
      }, node.filepath));
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
        const symbol = res.getFiltered(UNHANDLED);
        if (!symbol) continue;
        members.push(symbol);
        errors.push(...res.getErrors());
      }
      const seen = new Map<string, SyntaxNode>();

      // Duplicate checking
      for (const member of members) {
        if (!member.isKind(SymbolKind.Column) || !member.declaration) continue; // Ignore non-column members

        const name = member.name;
        if (name !== undefined) {
          const errorNode = (member.declaration instanceof ElementDeclarationNode && member.declaration.name) ? member.declaration.name : member.declaration;
          const firstNode = seen.get(name);
          if (firstNode) {
            errors.push(tableUtils.getColumnDuplicateError(name, firstNode));
            errors.push(tableUtils.getColumnDuplicateError(name, errorNode));
          } else {
            seen.set(name, errorNode);
          }
        }
      }

      return new Report(members, errors);
    }
    if (symbol.isKind(SymbolKind.Column) && isElementNode(symbol.declaration?.parent, ElementKind.TablePartial)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node) && !isAccessExpression(node)) return Report.create(PASS_THROUGH);
    if (!isInsideElementBody(node, ElementKind.TablePartial)) return Report.create(PASS_THROUGH);

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
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

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.TablePartial)) return Report.create(PASS_THROUGH);

    const declaration = node as ElementDeclarationNode & { type: SyntaxToken };
    const errors = new TablePartialBinder(compiler, declaration).bind();
    const symbol = compiler.nodeSymbol(node).getFiltered(UNHANDLED);
    if (symbol) errors.push(...compiler.symbolMembers(symbol).getErrors());
    return Report.create(undefined, errors);
  },

  interpretSymbol (compiler: Compiler, symbol: NodeSymbol, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(symbol instanceof TablePartialSymbol)) return Report.create(PASS_THROUGH);
    if (!(symbol.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);

    return new TablePartialInterpreter(compiler, symbol, filepath).interpret();
  },
};

// nodeReferee utils
function nodeRefereeOfEnumType (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: try as enum in default schema, ignore if not found (could be a raw type like varchar)
  if (!isAccessExpression(node.parentNode)) {
    return Report.create(compiler.lookupMembers(globalSymbol, SymbolKind.Enum, name));
  }

  // Right side of access - resolve via left sibling
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

    return new Report(undefined);
  }

  // Left side of access - look up as Schema in program scope
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  return new Report(undefined);
}

// Inline ref: table.column or schema.table.column
// Always report errors, never ignore not found
function nodeRefereeOfInlineRef (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone variable in inline ref - look up in the enclosing table
  if (!isAccessExpression(node.parentNode)) {
    const enclosingTablePartial = node.parent;
    if (enclosingTablePartial instanceof ElementDeclarationNode && enclosingTablePartial.isKind(ElementKind.TablePartial)) {
      const tableSymbol = compiler.nodeSymbol(enclosingTablePartial).getFiltered(UNHANDLED);
      if (tableSymbol) {
        const symbol = compiler.lookupMembers(tableSymbol, SymbolKind.Column, name);
        if (symbol) {
          return Report.create(symbol);
        }

        return new Report(undefined, [
          new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in TablePartial '${tableSymbol.name}'`, node),
        ]);
      }
    }
    const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Column, name);
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist`, node),
    ]);
  }

  // Right side of access expression - resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      const symbol = compiler.lookupMembers(left, [
        SymbolKind.Table,
        SymbolKind.Schema,
      ], name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Table or schema '${name}' does not exist`, node),
      ]);
    }
    if (left.isKind(SymbolKind.Table)) {
      const symbol = compiler.lookupMembers(left, SymbolKind.Column, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in Table 'public.${left.name}'`, node),
      ]);
    }

    return new Report(undefined);
  }

  // Left side of access expression - look up as Table or Schema in program scope
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If our parent is also a left side of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist in Schema 'public'`, node),
      ]);
    }
    // First try by table name, then by alias
    const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Table, name);
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  return new Report(undefined);
}

// Default value: enum.field or schema.enum.field
function nodeRefereeOfEnumDefault (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: ignore default keywords (true/false/null), everything else is an enum lookup
  if (!isAccessExpression(node.parentNode)) {
    if (KEYWORDS_OF_DEFAULT_SETTING.includes(name.toLowerCase())) {
      return new Report(undefined);
    }
    return Report.create(compiler.lookupMembers(globalSymbol, SymbolKind.Enum, name));
  }

  // Right side of access - resolve via left sibling
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

  // Left side of access - look up as Enum in program scope (report errors since it's clearly an enum access)
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If parent is also left of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist in Schema 'public'`, node),
      ]);
    }
    const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Enum, name);
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Enum '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  return new Report(undefined);
}
