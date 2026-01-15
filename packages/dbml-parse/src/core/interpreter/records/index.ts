import {
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  SyntaxNode,
} from '@/core/parser/nodes';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  RecordValue,
  InterpreterDatabase,
  Table,
  TableRecord,
} from '@/core/interpreter/types';
import { ColumnSchema, RecordsBatch } from './types';
import {
  collectRows,
  processTableSchema,
  resolveTableAndColumnsOfRecords,
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

export class RecordsInterpreter {
  private env: InterpreterDatabase;

  constructor (env: InterpreterDatabase) {
    this.env = env;
  }

  // Interpret all records elements, grouped by table
  interpret (elements: ElementDeclarationNode[]): CompileError[] {
    const errors: CompileError[] = [];
    const batchByTable = new Map<Table, RecordsBatch>();

    for (const element of elements) {
      const result = resolveTableAndColumnsOfRecords(element, this.env);
      if (!result) continue;

      const { table, tableSymbol, columnSymbols } = result;
      if (!batchByTable.has(table)) {
        batchByTable.set(table, processTableSchema(table, tableSymbol, columnSymbols, this.env));
      }
      const batch = batchByTable.get(table)!;
      batch.rows.push(...collectRows(element));
    }

    // Interpret each batch and collect results for validation
    const recordMap = new Map<Table, { batch: RecordsBatch; record: TableRecord }>();

    for (const [table, batch] of batchByTable) {
      const { errors: batchErrors, record } = this.interpretBatch(batch);
      errors.push(...batchErrors);
      if (record) {
        recordMap.set(table, { batch, record });
      }
    }

    // Validate constraints after all records are interpreted
    errors.push(...this.validateConstraints(recordMap));

    return errors;
  }

  // Validate all constraints (pk, unique, fk)
  private validateConstraints (
    recordMap: Map<Table, { batch: RecordsBatch; record: TableRecord }>,
  ): CompileError[] {
    const errors: CompileError[] = [];

    // Validate PK and Unique for each table
    for (const { batch, record } of recordMap.values()) {
      errors.push(...validatePrimaryKey(record, batch.constraints.pk, batch.rows, batch.columns));
      errors.push(...validateUnique(record, batch.constraints.unique, batch.rows, batch.columns));
    }

    // Validate FK constraints
    errors.push(...validateForeignKeys(recordMap, this.env));

    return errors;
  }

  // Interpret a batch of records for a single table
  private interpretBatch (batch: RecordsBatch): { errors: CompileError[]; record: TableRecord | null } {
    const errors: CompileError[] = [];
    const record: TableRecord = {
      schemaName: batch.schema || undefined,
      tableName: batch.table,
      columns: batch.columns.map((c) => c.name),
      values: [],
    };

    for (const row of batch.rows) {
      const result = this.interpretRow(row, batch.columns);
      errors.push(...result.errors);
      if (result.values) {
        record.values.push(result.values);
      }
    }

    if (record.values.length > 0) {
      this.env.records.push(record);
      return { errors, record };
    }

    return { errors, record: null };
  }

  // Extract row values from a FunctionApplicationNode
  // Records rows can be parsed in two ways:
  // 1. row.args contains values directly (e.g., from inline syntax)
  // 2. row.callee is a CommaExpressionNode with values (e.g., `1, "Alice"` parsed as callee)
  private extractRowValues (row: FunctionApplicationNode): SyntaxNode[] {
    // If args has values, use them
    if (row.args.length > 0) {
      return row.args;
    }

    // If callee is a comma expression, extract values from it
    if (row.callee instanceof CommaExpressionNode) {
      return row.callee.elementList;
    }

    // If callee is a single value (no comma), return it as single-element array
    if (row.callee) {
      return [row.callee];
    }

    return [];
  }

  // Interpret a single data row
  private interpretRow (
    row: FunctionApplicationNode,
    columns: ColumnSchema[],
  ): { errors: CompileError[]; values: RecordValue[] | null } {
    const errors: CompileError[] = [];
    const values: RecordValue[] = [];

    const args = this.extractRowValues(row);
    if (args.length !== columns.length) {
      errors.push(new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Expected ${columns.length} values but got ${args.length}`,
        row,
      ));
      return { errors, values: null };
    }

    for (let i = 0; i < columns.length; i++) {
      const arg = args[i];
      const column = columns[i];
      const result = this.interpretValue(arg, column);
      if (Array.isArray(result)) {
        errors.push(...result);
      } else {
        values.push(result);
      }
    }

    return { errors, values };
  }

  // Interpret a single value based on column type
  private interpretValue (
    node: SyntaxNode,
    column: ColumnSchema,
  ): RecordValue | CompileError[] {
    const { type, increment, isEnum, notNull, dbdefault } = column;
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
      const defaultValue = dbdefault && dbdefault.value.toString().toLowerCase() !== 'null' ? this.interpretDefaultValue(dbdefault.value, column, valueType, node) : null;
      if (notNull && defaultValue === null && !increment) {
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
          `Invalid datetime value for column '${column.name}', expected ISO 8601 format`,
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

  // Interpret a primitive value (boolean, number, string) - used for dbdefault
  // We left the value to be `null` to stay true to the original data sample & left it to DBMS
  private interpretDefaultValue (
    value: boolean | number | string,
    column: ColumnSchema,
    valueType: string,
    node: SyntaxNode,
  ): RecordValue | CompileError[] {
    const { type, isEnum } = column;

    // Enum type
    if (isEnum) {
      const enumValue = tryExtractEnum(value);
      if (enumValue === null) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid enum value for column '${column.name}'`,
          node,
        )];
      }
      return { value: null, type: valueType };
    }

    // Numeric type
    if (isNumericType(type)) {
      const numValue = tryExtractNumeric(value);
      if (numValue === null) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid numeric value for column '${column.name}'`,
          node,
        )];
      }
      return { value: null, type: valueType };
    }

    // Boolean type
    if (isBooleanType(type)) {
      const boolValue = tryExtractBoolean(value);
      if (boolValue === null) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid boolean value for column '${column.name}'`,
          node,
        )];
      }
      return { value: null, type: valueType };
    }

    // Datetime type
    if (isDateTimeType(type)) {
      const dtValue = tryExtractDateTime(value);
      if (dtValue === null) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid datetime value for column '${column.name}', expected ISO 8601 format`,
          node,
        )];
      }
      return { value: null, type: valueType };
    }

    // String type
    if (isStringType(type)) {
      const strValue = tryExtractString(value);
      if (strValue === null) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid string value for column '${column.name}'`,
          node,
        )];
      }
      return { value: null, type: 'string' };
    }

    // Fallback
    return { value: null, type: valueType };
  }
}
