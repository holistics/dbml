import {
  BlockExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/parser/nodes';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/errors';
import Report from '@/core/report';
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
  isNumericType,
  isIntegerType,
  isFloatType,
  isBooleanType,
  isStringType,
  isDateTimeType,
  getRecordValueType,
  validatePrimaryKey,
  validateUnique,
  validateForeignKeys,
} from './utils';
import { destructureCallExpression, destructureComplexVariable, extractQuotedStringToken, extractVariableFromExpression } from '@/core/analyzer/utils';
import { last } from 'lodash-es';
import { mergeTableAndPartials } from '../utils';

export class RecordsInterpreter {
  private env: InterpreterDatabase;

  constructor (env: InterpreterDatabase) {
    this.env = env;
  }

  interpret (elements: ElementDeclarationNode[]): Report<void> {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];

    for (const element of elements) {
      const { table, mergedColumns } = getTableAndColumnsOfRecords(element, this.env);
      for (const row of (element.body as BlockExpressionNode).body) {
        const rowNode = row as FunctionApplicationNode;
        const result = extractDataFromRow(rowNode, mergedColumns, this.env);
        errors.push(...result.getErrors());
        warnings.push(...result.getWarnings());
        const rowData = result.getValue();
        if (!rowData.row) continue;
        if (!this.env.records.has(table)) {
          this.env.records.set(table, []);
        }
        const tableRecords = this.env.records.get(table);
        tableRecords!.push({
          values: rowData.row,
          node: rowNode,
          columnNodes: rowData.columnNodes,
        });
      }
    }

    const constraintResult = this.validateConstraints();
    warnings.push(...constraintResult);

    return new Report(undefined, errors, warnings);
  }

  private validateConstraints (): CompileWarning[] {
    const warnings: CompileWarning[] = [];

    // Validate PK constraints
    warnings.push(...validatePrimaryKey(this.env).map((e) => e.toWarning()));

    // Validate unique constraints
    warnings.push(...validateUnique(this.env).map((e) => e.toWarning()));

    // Validate FK constraints
    warnings.push(...validateForeignKeys(this.env).map((e) => e.toWarning()));

    return warnings;
  }
}

function getTableAndColumnsOfRecords (records: ElementDeclarationNode, env: InterpreterDatabase): { table: Table; mergedTable: Table; mergedColumns: Column[] } {
  const nameNode = records.name;
  const parent = records.parent;
  if (parent instanceof ElementDeclarationNode) {
    const table = env.tables.get(parent)!;
    const mergedTable = mergeTableAndPartials(table, env);
    if (!nameNode) return {
      table,
      mergedTable,
      mergedColumns: mergedTable.fields,
    };
    const mergedColumns = (nameNode as TupleExpressionNode).elementList.map((e) => mergedTable.fields.find((f) => f.name === extractVariableFromExpression(e).unwrap())!);
    return {
      table,
      mergedTable,
      mergedColumns,
    };
  }
  const fragments = destructureCallExpression(nameNode!).unwrap();
  const tableNode = last(fragments.variables)!.referee!.declaration as ElementDeclarationNode;
  const table = env.tables.get(tableNode)!;
  const mergedTable = mergeTableAndPartials(table, env);
  const mergedColumns = fragments.args.map((e) => mergedTable.fields.find((f) => f.name === extractVariableFromExpression(e).unwrap())!);
  return {
    table,
    mergedTable,
    mergedColumns,
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

type RowData = { row: Record<string, RecordValue> | null; columnNodes: Record<string, SyntaxNode> };

function extractDataFromRow (
  row: FunctionApplicationNode,
  mergedColumns: Column[],
  env: InterpreterDatabase,
): Report<RowData> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];
  const rowObj: Record<string, RecordValue> = {};
  const columnNodes: Record<string, SyntaxNode> = {};

  const args = extractRowValues(row);
  if (args.length !== mergedColumns.length) {
    errors.push(new CompileError(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      `Expected ${mergedColumns.length} values but got ${args.length}`,
      row,
    ));
    return new Report({ row: null, columnNodes: {} }, errors, warnings);
  }

  for (let i = 0; i < mergedColumns.length; i++) {
    const arg = args[i];
    const column = mergedColumns[i];
    columnNodes[column.name] = arg;
    const result = extractValue(arg, column, env);
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
    const value = result.getValue();
    if (value !== null) {
      rowObj[column.name] = value;
    }
  }

  return new Report({ row: rowObj, columnNodes }, errors, warnings);
}

function getNodeSourceText (node: SyntaxNode, source: string): string {
  if (node instanceof FunctionExpressionNode) {
    return node.value?.value || '';
  }
  // Extract the source text using node start and end positions
  if (!isNaN(node.start) && !isNaN(node.end)) {
    return source.slice(node.start, node.end);
  }
  return '';
}

function extractValue (
  node: SyntaxNode,
  column: Column,
  env: InterpreterDatabase,
): Report<RecordValue | null> {
  // FIXME: Make this more precise
  const type = column.type.type_name.split('(')[0];
  const { increment, not_null: notNull, dbdefault } = column;
  const isEnum = column.type.isEnum || false;
  const valueType = getRecordValueType(type, isEnum);

  if (node instanceof FunctionExpressionNode) {
    return new Report({
      value: node.value?.value || '',
      type: 'expression',
    }, [], []);
  }

  // NULL literal
  if (isNullish(node) || (isEmptyStringLiteral(node) && !isStringType(type))) {
    const hasDefaultValue = dbdefault && dbdefault.value.toString().toLowerCase() !== 'null';
    if (notNull && !hasDefaultValue && !increment) {
      return new Report({ value: null, type: valueType }, [], [new CompileWarning(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `NULL not allowed for non-nullable column '${column.name}' without default and increment`,
        node,
      )]);
    }
    return new Report({ value: null, type: valueType }, [], []);
  }

  // Enum type
  if (isEnum) {
    const enumMembers = ([...env.enums.values()].find((e) => e.schemaName === column.type.schemaName && e.name === column.type.type_name)?.values || []).map((field) => field.name);
    let enumValue = extractQuotedStringToken(node).unwrap_or(undefined);
    if (enumValue === undefined) {
      enumValue = destructureComplexVariable(node).unwrap_or([]).pop();
    }
    if (!(enumMembers as (string | undefined)[]).includes(enumValue)) {
      return new Report({ value: enumValue, type: valueType }, [], [new CompileWarning(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid enum value for column '${column.name}'`,
        node,
      )]);
    }

    return new Report({ value: enumValue, type: valueType }, [], []);
  }

  // Numeric type
  if (isNumericType(type)) {
    const numValue = tryExtractNumeric(node);
    if (numValue === null) {
      return new Report(
        { value: getNodeSourceText(node, env.source), type: 'expression' },
        [],
        [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid numeric value for column '${column.name}'`,
          node,
        )],
      );
    }

    // Integer type: validate no decimal point
    if (isIntegerType(type) && !Number.isInteger(numValue)) {
      return new Report({ value: Math.floor(numValue), type: valueType }, [], [new CompileWarning(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid integer value ${numValue} for column '${column.name}': expected integer, got decimal`,
        node,
      )]);
    }

    // Decimal/numeric type: validate precision and scale
    if (isFloatType(type) && column.type.numericParams) {
      const { precision, scale } = column.type.numericParams;
      const numStr = numValue.toString();
      const parts = numStr.split('.');
      const integerPart = parts[0].replace(/^-/, ''); // Remove sign
      const decimalPart = parts[1] || '';

      const totalDigits = integerPart.length + decimalPart.length;
      const decimalDigits = decimalPart.length;

      if (totalDigits > precision) {
        return new Report({ value: numValue, type: valueType }, [], [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Numeric value ${numValue} for column '${column.name}' exceeds precision: expected at most ${precision} total digits, got ${totalDigits}`,
          node,
        )]);
      }

      if (decimalDigits > scale) {
        return new Report({ value: numValue, type: valueType }, [], [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Numeric value ${numValue} for column '${column.name}' exceeds scale: expected at most ${scale} decimal digits, got ${decimalDigits}`,
          node,
        )]);
      }
    }

    return new Report({ value: numValue, type: valueType }, [], []);
  }

  // Boolean type
  if (isBooleanType(type)) {
    const boolValue = tryExtractBoolean(node);
    if (boolValue === null) {
      return new Report(
        { value: getNodeSourceText(node, env.source), type: 'expression' },
        [],
        [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid boolean value for column '${column.name}'`,
          node,
        )],
      );
    }
    return new Report({ value: boolValue, type: valueType }, [], []);
  }

  // Datetime type
  if (isDateTimeType(type)) {
    const dtValue = tryExtractDateTime(node);
    if (dtValue === null) {
      return new Report(
        { value: getNodeSourceText(node, env.source), type: 'expression' },
        [],
        [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid datetime value for column '${column.name}', expected valid datetime format (e.g., 'YYYY-MM-DD', 'HH:MM:SS', 'YYYY-MM-DD HH:MM:SS', 'MM/DD/YYYY', 'D MMM YYYY', or 'MMM D, YYYY')`,
          node,
        )],
      );
    }
    return new Report({ value: dtValue, type: valueType }, [], []);
  }

  // String type
  if (isStringType(type)) {
    const strValue = tryExtractString(node);
    if (strValue === null) {
      return new Report(
        { value: getNodeSourceText(node, env.source), type: 'expression' },
        [],
        [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid string value for column '${column.name}'`,
          node,
        )],
      );
    }

    // Validate string length (using UTF-8 byte length like SQL engines)
    if (column.type.lengthParam) {
      const { length } = column.type.lengthParam;
      // Calculate byte length in UTF-8 encoding (matching SQL behavior)
      const actualByteLength = new TextEncoder().encode(strValue).length;

      if (actualByteLength > length) {
        return new Report({ value: strValue, type: valueType }, [], [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `String value for column '${column.name}' exceeds maximum length: expected at most ${length} bytes (UTF-8), got ${actualByteLength} bytes`,
          node,
        )]);
      }
    }

    return new Report({ value: strValue, type: 'string' }, [], []);
  }

  // Fallback - try to extract as string
  const strValue = tryExtractString(node);
  return new Report({ value: strValue, type: valueType }, [], []);
}
