import type Compiler from '@/compiler/index';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, PrimaryExpressionNode, VariableNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement, TableGroup,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, SchemaSymbol, SymbolKind, TableGroupFieldSymbol, TableGroupSymbol,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  extractQuotedStringToken, getBody,
} from '@/core/utils/expression';
import {
  getTokenPosition, normalizeNote,
} from '@/core/utils/interpret';
import {
  extractVarNameFromPrimaryVariable,
} from '@/core/utils/expression';
import type {
  GlobalModule,
} from '../types';
import {
  extractColor,
} from '@/core/utils/interpret';
import {
  getSymbolSchemaAndName, nodeRefereeOfLeftExpression,
} from '../utils';
import TableGroupBinder from './bind';
import {
  isAccessExpression,
  isElementFieldNode, isElementNode, isExpressionAVariableNode, isInsideElementBody, isInsideSettingList,
} from '@/core/utils/validate';

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
    const name = compiler.nodeFullname(node).getFiltered(UNHANDLED)?.at(-1);
    if (isElementNode(node, ElementKind.TableGroup)) {
      return new Report(compiler.symbolFactory.create(TableGroupSymbol, {
        declaration: node,
        name,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report(compiler.symbolFactory.create(TableGroupFieldSymbol, {
        declaration: node,
        name,
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

  interpretSymbol (compiler: Compiler, symbol: NodeSymbol, filepath?: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(symbol instanceof TableGroupSymbol)) return Report.create(PASS_THROUGH);

    const {
      name, schema: schemaName,
    } = symbol.interpretedName(compiler, filepath);

    // Resolve table fields from symbol members
    const fieldSymbols = symbol.members(compiler).filter((m) => m.isKind(SymbolKind.TableGroupField));
    const tables = fieldSymbols.flatMap((f) => {
      if (!f.declaration) return [];
      const callee = f.declaration instanceof FunctionApplicationNode ? f.declaration.callee : f.declaration;
      const tableSymbol = compiler.nodeReferee(callee ?? f.declaration).getFiltered(UNHANDLED);
      if (!tableSymbol?.isKind(SymbolKind.Table)) return [];
      const resolved = getSymbolSchemaAndName(compiler, tableSymbol);
      return [
        resolved,
      ];
    });

    // Settings
    const settings = symbol.settings(compiler);
    const color = settings?.color?.length ? extractColor(settings.color.at(0)?.value) : undefined;

    // Note: settings note first, sub-element Note overrides
    let note = symbol.note(compiler);
    if (symbol.declaration) {
      for (const sub of getBody(symbol.declaration as ElementDeclarationNode)) {
        if (sub instanceof ElementDeclarationNode && sub.isKind(ElementKind.Note)) {
          const noteBody = sub.body instanceof BlockExpressionNode
            ? (sub.body.body[0] as FunctionApplicationNode)?.callee
            : (sub.body as FunctionApplicationNode)?.callee;
          const noteContent = noteBody ? extractQuotedStringToken(noteBody) : undefined;
          if (noteContent) {
            note = {
              value: normalizeNote(noteContent),
              token: getTokenPosition(sub),
            };
          }
          break;
        }
      }
    }

    return Report.create({
      name,
      schemaName,
      tables,
      token: symbol.token!,
      color,
      note,
    } as TableGroup);
  },
};

// nodeReferee utils
function nodeRefereeOfTableGroupField (compiler: Compiler, globalSymbol: NodeSymbol, node: PrimaryExpressionNode & { expression: VariableNode }): Report<NodeSymbol | undefined> {
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: lookup as Table (by name or alias) in all schemas
  if (!isAccessExpression(node.parentNode)) {
    const schemasList = compiler.symbolMembers(globalSymbol).getFiltered(UNHANDLED);
    if (schemasList) {
      for (const schema of schemasList) {
        if (!(schema instanceof SchemaSymbol)) continue;
        // lookupMember checks aliases only for public schemas; for non-public, also check aliases explicitly
        const result = compiler.lookupMembers(schema, SymbolKind.Table, name, true, node);
        if (result.getValue()) return result;
        if (!schema.isPublicSchema()) {
          const membersList = compiler.symbolMembers(schema).getFiltered(UNHANDLED);
          if (membersList) {
            const match = membersList.find((m) => {
              if (!m.isKind(SymbolKind.Table) || !m.declaration) return false;
              return compiler.nodeAlias(m.declaration).getFiltered(UNHANDLED) === name;
            });
            if (match) return new Report(match);
          }
        }
      }
    }
    return compiler.lookupMembers(globalSymbol, SymbolKind.Table, name, false, node);
  }

  // Right side of access: resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return compiler.lookupMembers(left, [
        SymbolKind.Table,
        SymbolKind.Schema,
      ], name);
    }
    return new Report(undefined);
  }

  // Left side of access: look up as Schema
  return compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
}
