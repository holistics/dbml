import { SyntaxToken } from '../../../lexer/tokens';
import { ElementBinder } from '../types';
import {
  BlockExpressionNode, CallExpressionNode, CommaExpressionNode, ElementDeclarationNode, FunctionApplicationNode, PrimaryExpressionNode, ProgramNode, SyntaxNode, VariableNode,
} from '../../../parser/nodes';
import { CompileError, CompileErrorCode } from '../../../errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import SymbolFactory from '../../symbol/factory';
import {
  destructureCallExpression,
  destructureMemberAccessExpression,
  extractVarNameFromPrimaryVariable,
  getElementKind,
} from '../../utils';
import { createColumnSymbolIndex, SymbolKind } from '../../symbol/symbolIndex';
import { ElementKind } from '../../types';
import { isTupleOfVariables } from '../../validator/utils';
import { isExpressionAVariableNode } from '../../../parser/utils';
import { None, Option, Some } from '../../../option';

export default class RecordsBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  bind (): CompileError[] {
    const errors: CompileError[] = [];

    if (this.declarationNode.name) {
      errors.push(...this.bindRecordsName(this.declarationNode.name));
    }

    if (this.declarationNode.body instanceof BlockExpressionNode) {
      errors.push(...this.bindBody(this.declarationNode.body));
    }

    return errors;
  }

  private bindRecordsName (nameNode: SyntaxNode): CompileError[] {
    const parent = this.declarationNode.parent;
    const isTopLevel = parent instanceof ProgramNode;

    return isTopLevel
      ? this.bindTopLevelName(nameNode)
      : this.bindInsideTableName(nameNode);
  }

  // At top-level - bind table and column references:
  //   records users(id, name) { }           // binds: Table[users], Column[id], Column[name]
  //   records myschema.users(id, name) { }  // binds: Schema[myschema], Table[users], Column[id], Column[name]
  private bindTopLevelName (nameNode: SyntaxNode): CompileError[] {
    const fragments = destructureCallExpression(nameNode).unwrap_or(undefined);
    if (!fragments) {
      return [];
    }

    const tableBindee = fragments.variables.pop();
    const schemaBindees = fragments.variables;

    if (!tableBindee) {
      return [];
    }

    const tableErrors = lookupAndBindInScope(this.ast, [
      ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
      { node: tableBindee, kind: SymbolKind.Table },
    ]);

    if (tableErrors.length > 0) {
      return tableErrors;
    }

    const tableSymbol = tableBindee.referee;
    if (!tableSymbol?.symbolTable) {
      return [];
    }

    const errors: CompileError[] = [];
    for (const columnBindee of fragments.args) {
      const columnName = extractVarNameFromPrimaryVariable(columnBindee).unwrap_or('<unnamed>');
      const columnIndex = createColumnSymbolIndex(columnName);
      const columnSymbol = tableSymbol.symbolTable.get(columnIndex);

      if (!columnSymbol) {
        errors.push(new CompileError(
          CompileErrorCode.BINDING_ERROR,
          `Column '${columnName}' does not exist in table`,
          columnBindee,
        ));
        continue;
      }

      columnBindee.referee = columnSymbol;
      columnSymbol.references.push(columnBindee);
    }

    return errors;
  }

  // Inside a table - bind column references to parent table:
  //   table users { records (id, name) { } }  // binds: Column[id], Column[name] from parent table
  //   table users { records { } }             // no columns to bind
  private bindInsideTableName (nameNode: SyntaxNode): CompileError[] {
    const parent = this.declarationNode.parent;
    if (!(parent instanceof ElementDeclarationNode)) {
      return [];
    }

    const elementKind = getElementKind(parent).unwrap_or(undefined);
    if (elementKind !== ElementKind.Table) {
      return [];
    }

    const tableSymbolTable = parent.symbol?.symbolTable;
    if (!tableSymbolTable) {
      return [];
    }

    if (!isTupleOfVariables(nameNode)) {
      return [];
    }

    const errors: CompileError[] = [];
    for (const columnBindee of nameNode.elementList) {
      const columnName = extractVarNameFromPrimaryVariable(columnBindee).unwrap_or('<unnamed>');
      const columnIndex = createColumnSymbolIndex(columnName);
      const columnSymbol = tableSymbolTable.get(columnIndex);

      if (!columnSymbol) {
        errors.push(new CompileError(
          CompileErrorCode.BINDING_ERROR,
          `Column '${columnName}' does not exist in table`,
          columnBindee,
        ));
        continue;
      }

      columnBindee.referee = columnSymbol;
      columnSymbol.references.push(columnBindee);
    }

    return errors;
  }

  // Bind enum field references in data rows.
  // Example data rows with enum references:
  //   1, status.active, 'hello'       // binds: Enum[status], EnumField[active]
  //   myschema.status.pending, 42     // binds: Schema[myschema], Enum[status], EnumField[pending]
  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.bindDataRow(body);
    }

    const functions = body.body.filter((e) => e instanceof FunctionApplicationNode);
    const subs = body.body.filter((e) => e instanceof ElementDeclarationNode);

    return [
      ...this.bindDataRows(functions as FunctionApplicationNode[]),
      ...this.bindSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private bindDataRows (rows: FunctionApplicationNode[]): CompileError[] {
    return rows.flatMap((row) => this.bindDataRow(row));
  }

  // Bind a single data row. Structure:
  //   row.callee = CommaExpressionNode (e.g., 1, status.active, 'hello') or single value
  //   row.args = [] (empty)
  private bindDataRow (row: FunctionApplicationNode): CompileError[] {
    if (!row.callee) {
      return [];
    }

    const values = row.callee instanceof CommaExpressionNode
      ? row.callee.elementList
      : [row.callee];

    const bindees = values.flatMap(scanNonListNodeForBinding);

    return bindees.flatMap((bindee) => {
      const enumFieldBindee = bindee.variables.pop();
      const enumBindee = bindee.variables.pop();

      if (!enumFieldBindee || !enumBindee) {
        return [];
      }

      const schemaBindees = bindee.variables;

      return lookupAndBindInScope(this.ast, [
        ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
        { node: enumBindee, kind: SymbolKind.Enum },
        { node: enumFieldBindee, kind: SymbolKind.EnumField },
      ]);
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(sub as ElementDeclarationNode & { type: SyntaxToken }, this.ast, this.symbolFactory);

      return binder.bind();
    });
  }
}
