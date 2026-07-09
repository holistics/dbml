import Compiler from '@/compiler/index';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/types/errors';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import {
  type BlockExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionExpressionNode,
  type FunctionApplicationNode,
  type SyntaxNode,
  type TupleExpressionNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  RecordValue,
  TableRecord,
} from '@/core/types/schemaJson';
import type { Filepath } from '@/core/types/filepath';
import {
  type ColumnSymbol,
  type NodeSymbol,
  type RecordsMetadata,
  SymbolKind,
  TableSymbol,
} from '@/core/types/symbol';
import { destructureCallExpression, extractQuotedStringToken, extractVariableFromExpression } from '@/core/utils/expression';
import { getTokenPosition } from '@/core/utils/interpret';
import {
  getRecordValueType,
  isBooleanType,
  isDateTimeType,
  isFloatType,
  isIntegerType,
  isSerialType,
  isStringType,
} from './utils/data/sqlTypes';
import {
  extractSignedNumber,
  isEmptyStringLiteral,
  isNullish,
  tryExtractBoolean,
  tryExtractDateTime,
  tryExtractString,
} from './utils/data/values';
import { isExpressionAVariableNode } from '@/core/utils/validate';

export default class RecordsInterpreter {
  private compiler: Compiler;
  private element: ElementDeclarationNode;
  private metadata: RecordsMetadata;
  private filepath: Filepath;

  constructor (compiler: Compiler, metadata: RecordsMetadata, filepath: Filepath) {
    this.compiler = compiler;
    this.metadata = metadata;
    this.element = metadata.declaration as ElementDeclarationNode;
    this.filepath = filepath;
  }

  interpret (): Report<TableRecord | undefined> {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];
    const result = getTableAndColumnsOfRecords(this.element, this.compiler, this.filepath);

    if (!result || result.columns.length === 0) {
      return new Report<TableRecord | undefined>(undefined, errors);
    }

    const values: RecordValue[][] = [];
    for (const row of (this.element.body as BlockExpressionNode).body) {
      const rowNode = row as FunctionApplicationNode;
      const rowResult = extractDataFromRow(rowNode, result.columns, this.compiler);
      errors.push(...rowResult.getErrors());
      warnings.push(...rowResult.getWarnings());
      const rowData = rowResult.getValue();
      if (!rowData.row) continue;
      values.push(rowData.row);
    }

    const token = getTokenPosition(this.element);
    const tableRecord: TableRecord = {
      schemaName: result.schemaName,
      tableName: result.tableName,
      columns: result.columns.map((c) => c.name ?? ''),
      values,
      token,
    };

    return new Report<TableRecord | undefined>(tableRecord, errors, warnings);
  }
}

function getTableAndColumnsOfRecords (records: ElementDeclarationNode, compiler: Compiler, filepath: Filepath): {
  schemaName: string | null;
  tableName: string;
  columns: ColumnSymbol[];
} | undefined {
  const nameNode = records.name;
  const parent = records.parent;

  if (parent instanceof ElementDeclarationNode && parent.isKind(ElementKind.Table)) {
    // Case 1: Nested records inside a table element
    const tableSymbol = compiler.nodeSymbol(parent).getFiltered(UNHANDLED);
    if (!(tableSymbol instanceof TableSymbol)) return undefined;

    const allColumns = tableSymbol.mergedColumns(compiler);
    const resolved = tableSymbol.interpretedName(compiler, filepath);
    const schemaName = resolved.schema;
    const tableName = resolved.name;
    if (!nameNode) return {
      schemaName,
      tableName,
      columns: allColumns,
    };

    const columns = (nameNode as TupleExpressionNode).elementList.flatMap(
      (e) => allColumns.find((c) => c.name === extractVariableFromExpression(e)) || [],
    );
    return {
      schemaName,
      tableName,
      columns,
    };
  }

  // Case 2: Standalone records - table_name(col1, col2) { ... }
  const fragments = destructureCallExpression(nameNode!);
  if (!fragments) return undefined;

  const tableNameFragments = fragments.variables.map((v) => v.expression.variable?.value ?? '');
  const tableName = tableNameFragments.at(-1) ?? '';
  const schemaName = tableNameFragments.length > 1 ? tableNameFragments.slice(0, -1).join('.') : undefined;

  const ast = compiler.parseFile(records.filepath).getValue().ast;
  const programSymbolValue = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!programSymbolValue) return undefined;

  let tableSymbol: NodeSymbol | undefined;
  if (schemaName) {
    const schemaResult = compiler.lookupMembers(programSymbolValue, SymbolKind.Schema, schemaName);
    if (schemaResult) {
      tableSymbol = compiler.lookupMembers(schemaResult, SymbolKind.Table, tableName);
    }
  }
  if (!tableSymbol) {
    tableSymbol = compiler.lookupMembers(programSymbolValue, SymbolKind.Table, tableName);
  }

  if (!tableSymbol) return undefined;

  // Resolve through UseSymbol/AliasSymbol to actual TableSymbol
  const resolvedSymbol = tableSymbol.originalSymbol;
  if (!(resolvedSymbol instanceof TableSymbol)) return undefined;

  const allColumns = resolvedSymbol.mergedColumns(compiler);
  const columns = fragments.args.map((e) => allColumns.find((c) => c.name === extractVariableFromExpression(e))!).filter(Boolean);
  const resolved = resolvedSymbol.interpretedName(compiler, filepath);
  return {
    schemaName: resolved.schema,
    tableName: resolved.name,
    columns,
  };
}

type RowData = {
  row: RecordValue[] | null;
  columnNodes: Record<string, SyntaxNode>;
};

function extractDataFromRow (
  row: FunctionApplicationNode,
  columns: ColumnSymbol[],
  compiler: Compiler,
): Report<RowData> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];
  const columnNodes: Record<string, SyntaxNode> = {};

  const args = row.callee instanceof CommaExpressionNode
    ? row.callee.elementList
    : [
        row.callee!,
      ];
  if (args.length !== columns.length) {
    errors.push(new CompileError(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      `Expected ${columns.length} values but got ${args.length}`,
      row,
    ));
    return new Report({
      row: null,
      columnNodes: {},
    }, errors, warnings);
  }

  const rowValues: RecordValue[] = [];
  for (let i = 0; i < columns.length; i++) {
    const arg = args[i];
    const column = columns[i];
    columnNodes[column.name ?? ''] = arg;
    const result = extractValue(arg, column, compiler);
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
    const value = result.getValue();
    rowValues.push(value ?? {
      value: null,
      type: 'expression',
      token: getTokenPosition(arg),
    });
  }

  return new Report({
    row: rowValues,
    columnNodes,
  }, errors, warnings);
}

function getNodeSourceText (node: SyntaxNode): string {
  if (node instanceof FunctionExpressionNode) {
    return node.value?.value || '';
  }
  return '';
}

function extractValue (
  node: SyntaxNode,
  colSymbol: ColumnSymbol,
  compiler: Compiler,
): Report<RecordValue | null> {
  const token = getTokenPosition(node);
  const typeInfo = colSymbol.type(compiler);
  const typeName = (typeInfo?.name ?? '').split('(')[0];
  const isEnum = !!typeInfo?.enumSymbol;
  const increment = colSymbol.increment(compiler);
  const notNull = colSymbol.nullable(compiler) === false;
  const dbdefault = colSymbol.default(compiler);
  const colName = colSymbol.name ?? '';
  const valueType = getRecordValueType(typeName, isEnum);
  const rawString = tryExtractString(node);
  const fallbackValue = rawString !== null ? rawString : getNodeSourceText(node);
  const fallbackType = rawString !== null ? valueType : 'expression';

  if (node instanceof FunctionExpressionNode) {
    return new Report<RecordValue | null>({
      value: node.value?.value || '',
      type: 'expression',
      token,
    }, [], []);
  }

  // NULL literal
  if (isNullish(node) || (isEmptyStringLiteral(node) && !isStringType(typeName))) {
    const hasDefaultValue = dbdefault && dbdefault.value.toString().toLowerCase() !== 'null';
    const isSerial = isSerialType(typeName);
    if (notNull && !hasDefaultValue && !increment && !isSerial) {
      return new Report({
        value: null,
        type: valueType,
        token,
      }, [], [
        new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `NULL not allowed for non-nullable column '${colName}' without default and increment`,
          node,
        ),
      ]);
    }
    return new Report({
      value: null,
      type: valueType,
      token,
    }, [], []);
  }

  // Enum type
  if (isEnum) {
    const enumSymbol = colSymbol.type(compiler)?.enumSymbol;
    const enumMembers = enumSymbol
      ? enumSymbol.members(compiler).filter((f) => f.isKind(SymbolKind.EnumField)).map((f) => f.name).filter(Boolean) as string[]
      : [];
    let enumValue = extractQuotedStringToken(node);
    if (enumValue === undefined) {
      enumValue = isExpressionAVariableNode(node) ? node.expression.variable.value : undefined;
    }
    if (!(enumMembers as (string | undefined)[]).includes(enumValue)) {
      return new Report({
        value: enumValue,
        type: valueType,
        token,
      }, [], [
        new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid enum value for column '${colName}'`,
          node,
        ),
      ]);
    }

    return new Report({
      value: enumValue,
      type: valueType,
      token,
    }, [], []);
  }

  // Numeric type
  if (isIntegerType(typeName) || isFloatType(typeName) || isSerialType(typeName)) {
    const numValue = extractSignedNumber(node);
    if (numValue === null) {
      return new Report(
        {
          value: fallbackValue,
          type: fallbackType,
          token,
        },
        [],
        [
          new CompileWarning(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            `Invalid numeric value for column '${colName}'`,
            node,
          ),
        ],
      );
    }

    // Integer type: validate no decimal point
    if (isIntegerType(typeName) && !Number.isInteger(numValue)) {
      return new Report({
        value: Math.floor(numValue),
        type: valueType,
        token,
      }, [], [
        new CompileWarning(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Invalid integer value ${numValue} for column '${colName}': expected integer, got decimal`,
          node,
        ),
      ]);
    }

    // Decimal/numeric type: validate precision and scale
    const numericParams = isFloatType(typeName) && typeInfo?.args?.length
      ? {
          precision: Number(typeInfo.args[0]),
          scale: typeInfo.args.length >= 2 ? Number(typeInfo.args[1]) : 0,
        }
      : undefined;
    if (isFloatType(typeName) && numericParams) {
      const {
        precision, scale,
      } = numericParams;
      const numStr = numValue.toString();
      const parts = numStr.split('.');
      const integerPart = parts[0].replace(/^-/, ''); // Remove sign
      const decimalPart = parts[1] || '';

      const totalDigits = integerPart.length + decimalPart.length;
      const decimalDigits = decimalPart.length;

      if (totalDigits > precision) {
        return new Report({
          value: numValue,
          type: valueType,
          token,
        }, [], [
          new CompileWarning(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            `Numeric value ${numValue} for column '${colName}' exceeds precision: expected at most ${precision} total digits, got ${totalDigits}`,
            node,
          ),
        ]);
      }

      if (decimalDigits > scale) {
        return new Report({
          value: numValue,
          type: valueType,
          token,
        }, [], [
          new CompileWarning(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            `Numeric value ${numValue} for column '${colName}' exceeds scale: expected at most ${scale} decimal digits, got ${decimalDigits}`,
            node,
          ),
        ]);
      }
    }

    return new Report({
      value: numValue,
      type: valueType,
      token,
    }, [], []);
  }

  // Boolean type
  if (isBooleanType(typeName)) {
    const boolValue = tryExtractBoolean(node);
    if (boolValue === null) {
      return new Report(
        {
          value: fallbackValue,
          type: fallbackType,
          token,
        },
        [],
        [
          new CompileWarning(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            `Invalid boolean value for column '${colName}'`,
            node,
          ),
        ],
      );
    }
    return new Report({
      value: boolValue,
      type: valueType,
      token,
    }, [], []);
  }

  // Datetime type
  if (isDateTimeType(typeName)) {
    const dtValue = tryExtractDateTime(node);
    if (dtValue === null) {
      return new Report(
        {
          value: fallbackValue,
          type: fallbackType,
          token,
        },
        [],
        [
          new CompileWarning(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            `Invalid datetime value for column '${colName}', expected valid datetime format (e.g., 'YYYY-MM-DD', 'HH:MM:SS', 'YYYY-MM-DD HH:MM:SS', 'MM/DD/YYYY', 'D MMM YYYY', or 'MMM D, YYYY')`,
            node,
          ),
        ],
      );
    }
    return new Report({
      value: dtValue,
      type: valueType,
      token,
    }, [], []);
  }

  // String type
  if (isStringType(typeName)) {
    const strValue = tryExtractString(node);
    if (strValue === null) {
      return new Report(
        {
          value: fallbackValue,
          type: fallbackType,
          token,
        },
        [],
        [
          new CompileWarning(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            `Invalid string value for column '${colName}'`,
            node,
          ),
        ],
      );
    }

    // Validate string length (using UTF-8 byte length like SQL engines)
    const maxLength = typeInfo?.args?.length ? Number(typeInfo.args[0]) : undefined;
    if (maxLength && !Number.isNaN(maxLength)) {
      const length = maxLength;
      // Calculate byte length in UTF-8 encoding (matching SQL behavior)
      const actualByteLength = new TextEncoder().encode(strValue).length;

      if (actualByteLength > length) {
        return new Report({
          value: strValue,
          type: valueType,
          token,
        }, [], [
          new CompileWarning(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            `String value for column '${colName}' exceeds maximum length: expected at most ${length} bytes (UTF-8), got ${actualByteLength} bytes`,
            node,
          ),
        ]);
      }
    }

    return new Report({
      value: strValue,
      type: 'string',
      token,
    }, [], []);
  }

  // Fallback - try to extract as string
  return new Report({
    value: fallbackValue,
    type: fallbackType,
    token,
  }, [], []);
}
