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
  extractEnumAccess,
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
import { destructureCallExpression, extractVariableFromExpression } from '@/core/analyzer/utils';
import { last } from 'lodash-es';
import { mergeTableAndPartials } from '../utils';

export class RecordsInterpreter {
  private env: InterpreterDatabase;

  constructor (env: InterpreterDatabase) {
    this.env = env;
  }

  interpret (elements: ElementDeclarationNode[]): CompileError[] {
    const errors: CompileError[] = [];

    for (const element of elements) {
      const { table, mergedColumns } = getTableAndColumnsOfRecords(element, this.env);
      for (const row of (element.body as BlockExpressionNode).body) {
        const rowNode = row as FunctionApplicationNode;
        const { errors: rowErrors, row: rowValue, columnNodes } = extractDataFromRow(rowNode, mergedColumns, table.schemaName, this.env);
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

function extractDataFromRow (
  row: FunctionApplicationNode,
  mergedColumns: Column[],
  tableSchemaName: string | null,
  env: InterpreterDatabase,
): { errors: CompileError[]; row: Record<string, RecordValue> | null; columnNodes: Record<string, SyntaxNode> } {
  const errors: CompileError[] = [];
  const rowObj: Record<string, RecordValue> = {};
  const columnNodes: Record<string, SyntaxNode> = {};

  const args = extractRowValues(row);
  if (args.length !== mergedColumns.length) {
    errors.push(new CompileError(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      `Expected ${mergedColumns.length} values but got ${args.length}`,
      row,
    ));
    return { errors, row: null, columnNodes: {} };
  }

  for (let i = 0; i < mergedColumns.length; i++) {
    const arg = args[i];
    const column = mergedColumns[i];
    columnNodes[column.name] = arg;
    const result = extractValue(arg, column, tableSchemaName, env);
    if (Array.isArray(result)) {
      errors.push(...result);
    } else {
      rowObj[column.name] = result;
    }
  }

  return { errors, row: rowObj, columnNodes };
}

function extractValue (
  node: SyntaxNode,
  column: Column,
  tableSchemaName: string | null,
  env: InterpreterDatabase,
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
      type: 'expression',
    };
  }

  // NULL literal
  if (isNullish(node) || (isEmptyStringLiteral(node) && !isStringType(type))) {
    const hasDefaultValue = dbdefault && dbdefault.value.toString().toLowerCase() !== 'null';
    if (notNull && !hasDefaultValue && !increment) {
      // Note: Cannot use notNullMessage helper here because we don't have table/schema context
      // This validation happens during row parsing, before we have full table context
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
    const enumAccess = extractEnumAccess(node);
    if (enumAccess === null) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid enum value for column '${column.name}'`,
        node,
      )];
    }

    const { path, value: enumValue } = enumAccess;

    // Validate enum value against enum definition
    const enumTypeName = type;
    // Parse column type to get schema and enum name
    // Type can be 'status' or 'app.status'
    const typeParts = enumTypeName.split('.');
    const expectedEnumName = typeParts[typeParts.length - 1];
    const expectedSchemaName = typeParts.length > 1 ? typeParts.slice(0, -1).join('.') : tableSchemaName;

    // Validate enum access path matches the enum type
    if (path.length === 0) {
      // String literal - only allowed for enums without schema qualification
      if (expectedSchemaName !== null) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Enum value must be fully qualified: expected ${expectedSchemaName}.${expectedEnumName}.${enumValue}, got string literal ${JSON.stringify(enumValue)}`,
          node,
        )];
      }
    } else {
      // Enum access syntax - validate path
      const actualPath = path.join('.');
      const actualEnumName = path[path.length - 1];
      const actualSchemaName = path.length > 1 ? path.slice(0, -1).join('.') : null;

      const expectedPath = expectedSchemaName ? `${expectedSchemaName}.${expectedEnumName}` : expectedEnumName;

      if (actualPath !== expectedPath) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Enum path mismatch: expected ${expectedPath}.${enumValue}, got ${actualPath}.${enumValue}`,
          node,
        )];
      }
    }

    // Find the enum definition
    let enumDef = Array.from(env.enums.values()).find(
      (e) => e.name === expectedEnumName && e.schemaName === expectedSchemaName,
    );
    // Fallback to null schema if not found
    if (!enumDef && expectedSchemaName === tableSchemaName) {
      enumDef = Array.from(env.enums.values()).find(
        (e) => e.name === expectedEnumName && e.schemaName === null,
      );
    }

    if (enumDef) {
      const validValues = new Set(enumDef.values.map((v) => v.name));
      if (!validValues.has(enumValue)) {
        const validValuesList = Array.from(validValues).join(', ');
        const fullEnumPath = expectedSchemaName ? `${expectedSchemaName}.${expectedEnumName}` : expectedEnumName;
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid enum value ${JSON.stringify(enumValue)} for column '${column.name}' of type '${fullEnumPath}' (valid values: ${validValuesList})`,
          node,
        )];
      }
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

    // Integer type: validate no decimal point
    if (isIntegerType(type) && !Number.isInteger(numValue)) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Invalid integer value ${numValue} for column '${column.name}': expected integer, got decimal`,
        node,
      )];
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
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Numeric value ${numValue} for column '${column.name}' exceeds precision: expected at most ${precision} total digits, got ${totalDigits}`,
          node,
        )];
      }

      if (decimalDigits > scale) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Numeric value ${numValue} for column '${column.name}' exceeds scale: expected at most ${scale} decimal digits, got ${decimalDigits}`,
          node,
        )];
      }
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

    // Validate string length
    if (column.type.lengthParam) {
      const { length } = column.type.lengthParam;
      const actualLength = strValue.length;

      if (actualLength > length) {
        return [new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `String value for column '${column.name}' exceeds maximum length: expected at most ${length} characters, got ${actualLength}`,
          node,
        )];
      }
    }

    return { value: strValue, type: 'string' };
  }

  // Fallback - try to extract as string
  const strValue = tryExtractString(node);
  return { value: strValue, type: valueType };
}
