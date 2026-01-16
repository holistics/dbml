import {
  BlockExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/parser/nodes';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  RecordValue,
  InterpreterDatabase,
  Table,
  Column,
} from '@/core/interpreter/types';
import {
  isNullish,
  isEmptyStringLiteral,
  tryExtractNumeric,
  tryExtractBoolean,
  tryExtractString,
  tryExtractDateTime,
  tryExtractEnum,
  isNumericType,
  isBooleanType,
  isStringType,
  isDateTimeType,
  getRecordValueType,
  validatePrimaryKey,
  validateUnique,
  validateForeignKeys,
} from './utils';
import { destructureCallExpression, extractVariableFromExpression } from '@/core/analyzer/utils';
import { last } from 'lodash-es';

export class RecordsInterpreter {
  private env: InterpreterDatabase;

  constructor (env: InterpreterDatabase) {
    this.env = env;
  }

  interpret (elements: ElementDeclarationNode[]): CompileError[] {
    const errors: CompileError[] = [];

    for (const element of elements) {
      const { table, columns } = getTableAndColumnsOfRecords(element, this.env);
      for (const row of (element.body as BlockExpressionNode).body) {
        const rowNode = row as FunctionApplicationNode;
        const { errors: rowErrors, row: rowValue, columnNodes } = extractDataFromRow(rowNode, columns);
        errors.push(...rowErrors);
        if (!rowValue) continue;
        if (!this.env.records.has(table)) {
          this.env.records.set(table, []);
        }
        const tableRecords = this.env.records.get(table);
        tableRecords!.push({
          values: rowValue,
          node: rowNode,
          columnNodes,
        });
      }
    }

    errors.push(...this.validateConstraints());

    return errors;
  }

  private validateConstraints (): CompileError[] {
    const errors: CompileError[] = [];

    // Validate PK constraints
    errors.push(...validatePrimaryKey(this.env));

    // Validate unique constraints
    errors.push(...validateUnique(this.env));

    // Validate FK constraints
    errors.push(...validateForeignKeys(this.env));

    return errors;
  }
}

function getTableAndColumnsOfRecords (records: ElementDeclarationNode, env: InterpreterDatabase): { table: Table; columns: Column[] } {
  const nameNode = records.name;
  const parent = records.parent;
  if (parent instanceof ElementDeclarationNode) {
    const table = env.tables.get(parent)!;
    if (!nameNode) return {
      table,
      columns: table.fields,
    };
    const columns = (nameNode as TupleExpressionNode).elementList.map((e) => table.fields.find((f) => f.name === extractVariableFromExpression(e).unwrap())!);
    return {
      table,
      columns,
    };
  }
  const fragments = destructureCallExpression(nameNode!).unwrap();
  const table = env.tables.get(last(fragments.variables)!.referee!.declaration as ElementDeclarationNode)!;
  const columns = fragments.args.map((e) => table.fields.find((f) => f.name === extractVariableFromExpression(e).unwrap())!);
  return {
    table,
    columns,
  };
}

function extractRowValues (row: FunctionApplicationNode): SyntaxNode[] {
  if (row.args.length > 0) {
    return [];
  }

  if (row.callee instanceof CommaExpressionNode) {
    return row.callee.elementList;
  }

  if (row.callee) {
    return [row.callee];
  }

  return [];
}

function extractDataFromRow (
  row: FunctionApplicationNode,
  columns: Column[],
): { errors: CompileError[]; row: Record<string, RecordValue> | null; columnNodes: Record<string, SyntaxNode> } {
  const errors: CompileError[] = [];
  const rowObj: Record<string, RecordValue> = {};
  const columnNodes: Record<string, SyntaxNode> = {};

  const args = extractRowValues(row);
  if (args.length !== columns.length) {
    errors.push(new CompileError(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      `Expected ${columns.length} values but got ${args.length}`,
      row,
    ));
    return { errors, row: null, columnNodes: {} };
  }

  for (let i = 0; i < columns.length; i++) {
    const arg = args[i];
    const column = columns[i];
    columnNodes[column.name] = arg;
    const result = extractValue(arg, column);
    if (Array.isArray(result)) {
      errors.push(...result);
    } else {
      rowObj[column.name] = { ...result, node: arg };
    }
  }

  return { errors, row: rowObj, columnNodes };
}

function extractValue (
  node: SyntaxNode,
  column: Column,
): RecordValue | CompileError[] {
  // FIXME: Make this more precise
  const type = column.type.type_name.split('(')[0];
  const { increment, not_null: notNull, dbdefault } = column;
  const isEnum = column.type.isEnum || false;
  const valueType = getRecordValueType(type, isEnum);

  // Function expression - keep original type, mark as expression
  if (node instanceof FunctionExpressionNode) {
    return {
      value: node.value?.value || '',
      type: valueType,
      is_expression: true,
    };
  }

  // NULL literal
  if (isNullish(node) || (isEmptyStringLiteral(node) && !isStringType(type))) {
    const hasDefaultValue = dbdefault && dbdefault.value.toString().toLowerCase() !== 'null';
    if (notNull && !hasDefaultValue && !increment) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `NULL not allowed for NOT NULL column '${column.name}' without default and increment`,
        node,
      )];
    }
    return { value: null, type: valueType };
  }

  // Enum type
  if (isEnum) {
    const enumValue = tryExtractEnum(node);
    if (enumValue === null) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid enum value for column '${column.name}'`,
        node,
      )];
    }
    return { value: enumValue, type: valueType };
  }

  // Numeric type
  if (isNumericType(type)) {
    const numValue = tryExtractNumeric(node);
    if (numValue === null) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid numeric value for column '${column.name}'`,
        node,
      )];
    }
    return { value: numValue, type: valueType };
  }

  // Boolean type
  if (isBooleanType(type)) {
    const boolValue = tryExtractBoolean(node);
    if (boolValue === null) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid boolean value for column '${column.name}'`,
        node,
      )];
    }
    return { value: boolValue, type: valueType };
  }

  // Datetime type
  if (isDateTimeType(type)) {
    const dtValue = tryExtractDateTime(node);
    if (dtValue === null) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid datetime value for column '${column.name}', expected ISO 8601 format (e.g., YYYY-MM-DD, HH:MM:SS, or YYYY-MM-DDTHH:MM:SS)`,
        node,
      )];
    }
    return { value: dtValue, type: valueType };
  }

  // String type
  if (isStringType(type)) {
    const strValue = tryExtractString(node);
    if (strValue === null) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid string value for column '${column.name}'`,
        node,
      )];
    }
    return { value: strValue, type: 'string' };
  }

  // Fallback - try to extract as string
  const strValue = tryExtractString(node);
  return { value: strValue, type: valueType };
}
