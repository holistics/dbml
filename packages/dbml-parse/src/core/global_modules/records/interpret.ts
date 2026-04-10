import {
  BlockExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/parser/nodes';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/types/errors';
import Report from '@/core/types/report';
import type {
  RecordValue,
  Table,
  TableRecord,
  Column,
} from '@/core/types/schemaJson';
import {
  isNullish,
  isEmptyStringLiteral,
  tryExtractBoolean,
  tryExtractString,
  tryExtractDateTime,
  extractSignedNumber,
} from './utils/data/values';
import {
  isIntegerType,
  isFloatType,
  isBooleanType,
  isStringType,
  isDateTimeType,
  getRecordValueType,
  isSerialType,
} from './utils/data/sqlTypes';
import { destructureCallExpression, extractQuotedStringToken, extractVariableFromExpression, isExpressionAVariableNode, isElementNode } from '@/core/utils/expression';
import Compiler from '@/compiler/index';
import { ElementKind } from '@/core/types/keywords';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import { PASS_THROUGH, UNHANDLED } from '@/constants';
import { getTokenPosition, lookupMember, lookupInDefaultSchema } from '../utils';
import { validateForeignKeys, validatePrimaryKey, validateUnique } from './utils/constraints';
import { buildMergedTableFromElement, getEnumMembers, parseNumericParams, parseLengthParam } from './utils/interpret';

export default class RecordsInterpreter {
  private compiler: Compiler;
  private node: SyntaxNode;

  constructor (compiler: Compiler, node: SyntaxNode) {
    this.compiler = compiler;
    this.node = node;
  }

  interpret (): Report<TableRecord | undefined> | Report<typeof PASS_THROUGH> {
    if (!isElementNode(this.node, ElementKind.Records)) return Report.create(PASS_THROUGH);

    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];

    const element = this.node as ElementDeclarationNode;
    const { table, mergedColumns } = getTableAndColumnsOfRecords(element, this.compiler);

    if (!table || mergedColumns.length === 0) {
      return new Report<TableRecord | undefined>(undefined, errors);
    }

    const values: RecordValue[][] = [];
    for (const row of (element.body as BlockExpressionNode).body) {
      const rowNode = row as FunctionApplicationNode;
      const result = extractDataFromRow(rowNode, mergedColumns, this.compiler);
      errors.push(...result.getErrors());
      warnings.push(...result.getWarnings());
      const rowData = result.getValue();
      if (!rowData.row) continue;
      values.push(rowData.row);
    }

    const token = getTokenPosition(this.node);
    const tableRecord: TableRecord = {
      schemaName: table.schemaName ?? undefined,
      tableName: table.name,
      columns: mergedColumns.map((c) => c.name),
      values,
      token,
    };

    const constraintResult = this.validateConstraints(tableRecord, table);
    warnings.push(...constraintResult);

    return new Report<TableRecord | undefined>(tableRecord, errors, warnings);
  }

  private validateConstraints (tableRecord: TableRecord, table: Table): CompileWarning[] {
    const warnings: CompileWarning[] = [];

    // Validate PK constraints
    warnings.push(...validatePrimaryKey(tableRecord, table));

    // Validate unique constraints
    warnings.push(...validateUnique(tableRecord, table));

    // FIXME: Validation of FK constraints are performed in the program module

    return warnings;
  }
}

// Returns:
//   - `table`: The original interpreted table object that `records` refer to
//   - `mergedTable`: The interpreted table object merged with its table partials
//   - `mergedColumns`: The columns of the `mergedTable``
function getTableAndColumnsOfRecords (records: ElementDeclarationNode, compiler: Compiler): { table: Table | undefined; mergedColumns: Column[] } {
  const nameNode = records.name;
  const parent = records.parent;
  if (parent instanceof ElementDeclarationNode) {
    const table = buildMergedTableFromElement(parent, compiler);
    if (!table) return { table: undefined, mergedColumns: [] };
    if (!nameNode) return {
      table,
      mergedColumns: table.fields,
    };
    const mergedColumns = (nameNode as TupleExpressionNode).elementList.flatMap((e) => table.fields.find((f) => f.name === extractVariableFromExpression(e)) || []);
    return {
      table,
      mergedColumns,
    };
  }
  const fragments = destructureCallExpression(nameNode!);
  if (!fragments) return { table: undefined, mergedColumns: [] };
  const tableNameFragments = fragments.variables.map((v) => v.expression.variable?.value ?? '');
  const tableName = tableNameFragments.at(-1) ?? '';
  const schemaName = tableNameFragments.length > 1 ? tableNameFragments.slice(0, -1).join('.') : undefined;

  const ast = compiler.parseFile().getValue().ast;
  const programSymbol = compiler.nodeSymbol(ast);
  if (programSymbol.hasValue(UNHANDLED)) return { table: undefined, mergedColumns: [] };

  let tableSymbol: NodeSymbol | undefined;
  if (schemaName) {
    // Schema-qualified: look up the schema first, then the table within it
    const schemaResult = lookupMember(compiler, programSymbol.getValue(), schemaName, { kinds: [SymbolKind.Schema], ignoreNotFound: true });
    if (schemaResult.getValue()) {
      tableSymbol = lookupMember(compiler, schemaResult.getValue()!, tableName, { kinds: [SymbolKind.Table], ignoreNotFound: true }).getValue() ?? undefined;
    }
  }
  if (!tableSymbol) {
    tableSymbol = lookupInDefaultSchema(compiler, programSymbol.getValue(), tableName, { kinds: [SymbolKind.Table], ignoreNotFound: true }).getValue() ?? undefined;
  }

  if (!tableSymbol?.declaration) return { table: undefined, mergedColumns: [] };

  const tableNode = tableSymbol.declaration as ElementDeclarationNode;
  const table = buildMergedTableFromElement(tableNode, compiler);
  if (!table) return { table: undefined, mergedColumns: [] };
  const mergedColumns = fragments.args.map((e) => table.fields.find((f) => f.name === extractVariableFromExpression(e))!);
  return {
    table,
    mergedColumns,
  };
}

type RowData = { row: RecordValue[] | null; columnNodes: Record<string, SyntaxNode> };

function extractDataFromRow (
  row: FunctionApplicationNode,
  mergedColumns: Column[],
  compiler: Compiler,
): Report<RowData> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];
  const columnNodes: Record<string, SyntaxNode> = {};

  const args = row.callee instanceof CommaExpressionNode ? row.callee.elementList : [row.callee!];
  if (args.length !== mergedColumns.length) {
    errors.push(new CompileError(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      `Expected ${mergedColumns.length} values but got ${args.length}`,
      row,
    ));
    return new Report({ row: null, columnNodes: {} }, errors, warnings);
  }

  const rowValues: RecordValue[] = [];
  for (let i = 0; i < mergedColumns.length; i++) {
    const arg = args[i];
    const column = mergedColumns[i];
    columnNodes[column.name] = arg;
    const result = extractValue(arg, column, compiler);
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
    const value = result.getValue();
    rowValues.push(value ?? { value: null, type: 'expression' });
  }

  return new Report({ row: rowValues, columnNodes }, errors, warnings);
}

function getNodeSourceText (node: SyntaxNode): string {
  if (node instanceof FunctionExpressionNode) {
    return node.value?.value || '';
  }
  return '';
}

function extractValue (
  node: SyntaxNode,
  column: Column,
  compiler: Compiler,
): Report<RecordValue | null> {
  // FIXME: Make this more precise
  const type = column.type.type_name.split('(')[0];
  const { increment, not_null: notNull, dbdefault } = column;
  const isEnum = column.type.isEnum || false;
  const valueType = getRecordValueType(type, isEnum);
  const rawString = tryExtractString(node);
  const fallbackValue = rawString !== null ? rawString : getNodeSourceText(node);
  const fallbackType = rawString !== null ? valueType : 'expression';

  if (node instanceof FunctionExpressionNode) {
    return new Report<RecordValue | null>({
      value: node.value?.value || '',
      type: 'expression',
    }, [], []);
  }

  // NULL literal
  if (isNullish(node) || (isEmptyStringLiteral(node) && !isStringType(type))) {
    const hasDefaultValue = dbdefault && dbdefault.value.toString().toLowerCase() !== 'null';
    const isSerial = isSerialType(type);
    if (notNull && !hasDefaultValue && !increment && !isSerial) {
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
    const enumMembers = getEnumMembers(column, compiler);
    let enumValue = extractQuotedStringToken(node);
    if (enumValue === undefined) {
      enumValue = isExpressionAVariableNode(node) ? node.expression.variable.value : undefined;
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
  if (isIntegerType(type) || isFloatType(type) || isSerialType(type)) {
    const numValue = extractSignedNumber(node);
    if (numValue === null) {
      return new Report(
        { value: fallbackValue, type: fallbackType },
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
    const numericParams = isFloatType(type) ? parseNumericParams(column) : undefined;
    if (isFloatType(type) && numericParams) {
      const { precision, scale } = numericParams;
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
        { value: fallbackValue, type: fallbackType },
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
        { value: fallbackValue, type: fallbackType },
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
        { value: fallbackValue, type: fallbackType },
        [],
        [new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid string value for column '${column.name}'`,
          node,
        )],
      );
    }

    // Validate string length (using UTF-8 byte length like SQL engines)
    const lengthParam = parseLengthParam(column);
    if (lengthParam) {
      const { length } = lengthParam;
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
  return new Report({ value: fallbackValue, type: fallbackType }, [], []);
}
