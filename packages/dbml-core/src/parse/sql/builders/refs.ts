import {
  Expression,
  ForeignKeyExpr,
  ReferenceExpr,
  SchemaExpr,
} from 'sqlingo';
import type { Ref } from '@dbml/parse';
import {
  filterExpressions, getNodeText, extractSchemaColumns, parseTableParts, getTokenPosition,
} from '../ast';

export interface ColumnFkData {
  fieldNames: string[];
  targetSchema: string | undefined;
  targetTable: string;
  targetColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

export function buildFkRef (
  expression: ForeignKeyExpr,
  srcTable: string,
  srcSchema: string | undefined,
  name?: string,
): Ref | undefined {
  const srcColumns = filterExpressions(expression.args.expressions ?? []).map(getNodeText);
  const ref = expression.args.reference;
  if (!(ref instanceof ReferenceExpr)) return undefined;

  const inner = ref.args.this;
  const tableExpression = inner instanceof SchemaExpr ? inner.args.this : inner;
  const refColumns = inner instanceof Expression ? extractSchemaColumns(inner).map(getNodeText) : [];
  if (!(tableExpression instanceof Expression)) return undefined;

  const target = parseTableParts(tableExpression);
  if (!target.name || !srcColumns.length) return undefined;

  const token = getTokenPosition(expression);

  return {
    schemaName: null,
    name: name ?? null,
    ...extractFkActions(ref),
    token,
    endpoints: [
      {
        tableName: srcTable,
        schemaName: srcSchema ?? null,
        fieldNames: srcColumns,
        relation: '0..*',
        token,
      },
      {
        tableName: target.name,
        schemaName: target.schema ?? null,
        fieldNames: refColumns,
        relation: '0..1',
        token,
      },
    ],
  };
}

/** Builds an inline ref from a column-level REFERENCES constraint. */
export function buildColumnFkData (
  kind: ReferenceExpr,
  columnName: string,
): ColumnFkData | undefined {
  const inner = kind.args.this;
  const tableExpression = inner instanceof SchemaExpr ? inner.args.this : inner;
  const refColumns = inner instanceof Expression ? extractSchemaColumns(inner).map(getNodeText) : [];
  if (!(tableExpression instanceof Expression)) return undefined;

  const target = parseTableParts(tableExpression);
  if (!target.name) return undefined;

  return {
    fieldNames: [columnName],
    targetSchema: target.schema,
    targetTable: target.name,
    targetColumns: refColumns,
    ...extractFkActions(kind),
  };
}

function extractFkActions (ref: ReferenceExpr): {
  onDelete?: string;
  onUpdate?: string;
} {
  const out: {
    onDelete?: string;
    onUpdate?: string;
  } = {};

  for (const option of ref.args.options ?? []) {
    if (typeof option !== 'string') continue;
    const upper = option.toUpperCase();
    if (!upper.startsWith('ON ')) continue;
    const rest = upper.slice(3);
    const spaceIndex = rest.indexOf(' ');
    if (spaceIndex < 0) continue;
    const verb = rest.slice(0, spaceIndex);
    const action = rest.slice(spaceIndex + 1);
    if (verb === 'DELETE') out.onDelete = action;
    else if (verb === 'UPDATE') out.onUpdate = action;
  }
  return out;
}
