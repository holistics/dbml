import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { UNHANDLED } from '@/core/types/module';
import {
  BlockExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
  type SyntaxNode,
} from '@/core/types/nodes';
import { getElementNameString } from '@/core/utils/expression';
import {
  ElementKind,
  type NodeSymbol,
} from '../../types';
import {
  destructureCallExpression,
  extractVarNameFromPrimaryVariable,
} from '../../utils/expression';
import { scanNonListNodeForBinding } from '../utils';
import { isTupleOfVariables } from '@/core/utils/validate';

export default class RecordsBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;
  // A mapping from bound column symbols to the referencing primary expressions nodes of column
  // Example: Records (col1, col2) -> Map symbol of `col1` to the `col1` in `Records (col1, col2)``
  private boundColumns: Map<NodeSymbol, SyntaxNode>;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
    this.boundColumns = new Map();
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
    const fragments = destructureCallExpression(nameNode);
    if (!fragments) {
      return [];
    }

    const tableBindee = fragments.variables.pop();
    const schemaBindees = fragments.variables;

    if (!tableBindee) {
      return [];
    }

    const tableErrors = this.compiler.nodeReferee(tableBindee).getErrors();

    if (tableErrors.length > 0) {
      return tableErrors;
    }

    const tableSymbol = this.compiler.nodeReferee(tableBindee).getFiltered(UNHANDLED);
    if (!tableSymbol) {
      return [];
    }

    const tableName = getElementNameString(tableSymbol.declaration) ?? '<invalid name>';

    const errors: CompileError[] = schemaBindees.flatMap((b) => this.compiler.nodeReferee(b).getErrors());
    for (const columnBindee of fragments.args) {
      const columnName = extractVarNameFromPrimaryVariable(columnBindee) ?? '<unnamed>';
      const columnSymbol = this.compiler.nodeReferee(columnBindee).getFiltered(UNHANDLED);

      if (!columnSymbol) {
        errors.push(new CompileError(
          CompileErrorCode.BINDING_ERROR,
          `Column '${columnName}' does not exist in Table '${tableName}'`,
          columnBindee,
        ));
        continue;
      }

      const originalBindee = this.boundColumns.get(columnSymbol);
      if (originalBindee) {
        errors.push(new CompileError(
          CompileErrorCode.DUPLICATE_COLUMN_REFERENCES_IN_RECORDS,
          `Column '${columnName}' is referenced more than once in a Records for Table '${tableName}'`,
          originalBindee,
        ));
        errors.push(new CompileError(
          CompileErrorCode.DUPLICATE_COLUMN_REFERENCES_IN_RECORDS,
          `Column '${columnName}' is referenced more than once in a Records for Table '${tableName}'`,
          columnBindee,
        ));
      }
      this.boundColumns.set(columnSymbol, columnBindee);
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

    if (!parent.isKind(ElementKind.Table)) {
      return [];
    }

    const tableSymbol = this.compiler.nodeSymbol(parent).getFiltered(UNHANDLED);
    if (!tableSymbol) {
      return [];
    }

    if (!isTupleOfVariables(nameNode)) {
      return [];
    }

    const tableName = getElementNameString(parent) ?? '<invalid name>';

    const errors: CompileError[] = [];
    for (const columnBindee of nameNode.elementList) {
      const columnName = extractVarNameFromPrimaryVariable(columnBindee) ?? '<unnamed>';
      const columnSymbol = this.compiler.nodeReferee(columnBindee).getFiltered(UNHANDLED);

      if (!columnSymbol) {
        errors.push(new CompileError(
          CompileErrorCode.BINDING_ERROR,
          `Column '${columnName}' does not exist in Table '${tableName}'`,
          columnBindee,
        ));
        continue;
      }
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
      : [
          row.callee,
        ];

    const bindees = values.flatMap(scanNonListNodeForBinding);

    return bindees.flatMap((bindee) => {
      const enumFieldBindee = bindee.variables.pop();
      const enumBindee = bindee.variables.pop();

      if (!enumFieldBindee || !enumBindee) {
        return [];
      }

      const schemaBindees = bindee.variables;

      return [
        ...schemaBindees.flatMap((b) => this.compiler.nodeReferee(b).getErrors()),
        ...(enumBindee ? this.compiler.nodeReferee(enumBindee).getErrors() : []),
        ...this.compiler.nodeReferee(enumFieldBindee).getErrors(),
      ];
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }

      return this.compiler.bindNode(sub).getErrors();
    });
  }
}
