import { CompileError } from '@/core/errors';
import { ElementBinder } from '@/core/analyzer/binder/types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode,
  IdentiferStreamNode, ListExpressionNode, ProgramNode,
} from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import { createSchemaSymbolIndex, createTableSymbolIndex, SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import { lookupAndBindInScope, scanNonListNodeForBinding } from '@/core/analyzer/binder/utils';

export default class DiagramViewBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  bind (): CompileError[] {
    return this.bindBody(this.declarationNode.body);
  }

  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [];
    }

    const errors: CompileError[] = [];
    const bodyElements = body.body || [];

    // Process each sub-element (tables, notes, tableGroups, schemas blocks)
    for (const element of bodyElements) {
      if (element instanceof ElementDeclarationNode) {
        const type = element.type?.value.toLowerCase();
        const subBody = element.body as BlockExpressionNode | undefined;

        switch (type) {
          case 'tables': {
            if (element.body instanceof FunctionApplicationNode
              && element.body.callee instanceof ListExpressionNode) {
              // Colon syntax: Tables: [users, posts]
              errors.push(...this.bindTableReferencesFromList(element.body.callee));
            } else {
              // Block syntax: tables { users \n posts }
              errors.push(...this.bindTableReferences(element.body as BlockExpressionNode | undefined));
            }
            break;
          }
          case 'notes':
          case 'sticky_notes':
            errors.push(...this.bindNoteReferences(subBody));
            break;
          case 'tablegroups':
          case 'table_groups':
            errors.push(...this.bindTableGroupReferences(subBody));
            break;
          case 'schemas':
            // Schemas don't need binding for rename purposes
            break;
          default:
            break;
        }
      }
    }

    return errors;
  }

  private bindTableReferences (body?: BlockExpressionNode): CompileError[] {
    if (!body || !body.body) {
      return [];
    }

    for (const element of body.body) {
      if (element instanceof FunctionApplicationNode && element.callee) {
        const bindees = scanNonListNodeForBinding(element.callee);

        for (const bindee of bindees) {
          const tableBindee = bindee.variables.pop();
          if (!tableBindee) {
            continue;
          }
          const schemaBindees = bindee.variables;

          // Bind: schema (if present) + table
          const bindPath: { node: any; kind: SymbolKind }[] = [
            ...schemaBindees.map((b: any) => ({ node: b, kind: SymbolKind.Schema })),
            { node: tableBindee, kind: SymbolKind.Table },
          ];

          try {
            lookupAndBindInScope(this.ast, bindPath);
          } catch (e) {
            // Ignore binding errors - table may not exist
          }
        }
      }
    }

    return [];
  }

  private bindTableReferencesFromList (listNode: ListExpressionNode): CompileError[] {
    if (!this.ast.symbol?.symbolTable) {
      return [];
    }

    for (const item of listNode.elementList) {
      if (item.name instanceof IdentiferStreamNode) {
        // Simple identifier: Tables: [users] — parsed as IdentiferStreamNode
        const identifiers = item.name.identifiers;
        if (identifiers.length === 1) {
          // Simple table name in default schema
          const tableName = identifiers[0].value;
          const tableIndex = createTableSymbolIndex(tableName);
          const tableSymbol = this.ast.symbol.symbolTable.get(tableIndex);
          if (tableSymbol) {
            item.name.referee = tableSymbol;
            tableSymbol.references.push(item.name);
          }
        }
        // Multi-identifier stream not expected here, skip
      } else {
        // Dotted expression: Tables: [core.users] — parsed via expression_bp(0)
        const bindees = scanNonListNodeForBinding(item.name);

        for (const bindee of bindees) {
          const tableBindee = bindee.variables.pop();
          if (!tableBindee) {
            continue;
          }
          const schemaBindees = bindee.variables;

          const bindPath: { node: any; kind: SymbolKind }[] = [
            ...schemaBindees.map((b: any) => ({ node: b, kind: SymbolKind.Schema })),
            { node: tableBindee, kind: SymbolKind.Table },
          ];

          try {
            lookupAndBindInScope(this.ast, bindPath);
          } catch (e) {
            // Ignore binding errors - table may not exist
          }
        }
      }
    }

    return [];
  }

  private bindNoteReferences (body?: BlockExpressionNode): CompileError[] {
    if (!body || !body.body) {
      return [];
    }

    // Notes binding is optional - don't fail if not found
    return [];
  }

  private bindTableGroupReferences (body?: BlockExpressionNode): CompileError[] {
    if (!body || !body.body) {
      return [];
    }

    // TableGroup binding is optional - don't fail if not found
    return [];
  }
}
