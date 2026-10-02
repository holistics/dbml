import {
  BooleanExpr,
  ColumnExpr,
  DataTypeExpr,
  DataTypeExprKind,
  DotExpr,
  Expression,
  IdentifierExpr,
  LiteralExpr,
  NullExpr,
  ParenExpr,
  SchemaExpr,
  TableExpr,
} from 'sqlingo';
import type { Index, TokenPosition } from '@dbml/parse';
import type { QualifiedName } from './types';

type ValueType = 'string' | 'number' | 'boolean' | 'expression';

export function getTokenPosition (expression: Expression): TokenPosition {
  const line = typeof expression.meta.line === 'number' ? expression.meta.line : 1;
  const column = typeof expression.meta.col === 'number' ? expression.meta.col : 1;
  const start = typeof expression.meta.start === 'number' ? expression.meta.start : 0;
  const end = typeof expression.meta.end === 'number' ? expression.meta.end : start;
  return { start: { offset: start, line, column }, end: { offset: end, line, column } };
}

export function buildZeroToken (): TokenPosition {
  const ZERO_POSITION = { offset: 0, line: 1, column: 1 };
  return { start: ZERO_POSITION, end: ZERO_POSITION };
}

/** Filters a mixed args array down to Expression instances only. */
export function filterExpressions (arr: unknown[]): Expression[] {
  return arr.filter((e): e is Expression => e instanceof Expression);
}

/**
 * Returns the column expressions from a SchemaExpr's expressions list,
 * e.g. the column list in REFERENCES other(col1, col2).
 */
export function extractSchemaColumns (inner: Expression): Expression[] {
  return inner instanceof SchemaExpr ? filterExpressions(inner.args.expressions ?? []) : [];
}

export function getIdentifierName (expression: Expression): string {
  if (expression instanceof IdentifierExpr) {
    const inner = expression.args.this;
    if (typeof inner === 'string') return inner;
    if (inner instanceof Expression) return getIdentifierName(inner);
  }
  return expression.name || expression.sql();
}

export function getNodeText (
  node: Expression | string | number | boolean | undefined,
): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean')
    return String(node);
  return node.name || node.sql();
}

export function extractQualifiedNames (expression: Expression): string[] {
  const parts: string[] = [];
  if (expression instanceof DotExpr) {
    if (expression.args.this instanceof Expression)
      parts.push(...extractQualifiedNames(expression.args.this));
    if (expression.args.expression instanceof Expression)
      parts.push(...extractQualifiedNames(expression.args.expression));
  } else {
    parts.push(getIdentifierName(expression));
  }

  return parts;
}

export function parseTableParts (expression: Expression | undefined): QualifiedName {
  if (!expression) return { name: '' };
  if (expression instanceof TableExpr) {
    const nameNode = expression.args.this;
    const name =
      nameNode instanceof Expression
        ? getIdentifierName(nameNode)
        : typeof nameNode === 'string'
          ? nameNode
          : '';
    const db =
      expression.args.db instanceof Expression
        ? getIdentifierName(expression.args.db)
        : undefined;
    const cat =
      expression.args.catalog instanceof Expression
        ? getIdentifierName(expression.args.catalog)
        : undefined;
    const schema = cat && db ? `${cat}.${db}` : db || cat;
    return schema ? { schema, name } : { name };
  }
  if (expression instanceof DotExpr) {
    const parts = extractQualifiedNames(expression);
    return parts.length > 1
      ? {
          schema: parts.slice(0, -1).join('.'),
          name: parts[parts.length - 1],
        }
      : {
          name: parts[0],
        };
  }
  return { name: getIdentifierName(expression) };
}

export function buildTypeName (dtype: DataTypeExpr): string {
  const kind = dtype.args.this;
  const expressions = dtype.args.expressions ?? [];

  if (
    kind === DataTypeExprKind.ARRAY
    && expressions.length > 0
    && expressions[0] instanceof DataTypeExpr
  ) {
    return buildTypeName(expressions[0]) + '[]';
  }

  let base: string;
  if (kind === DataTypeExprKind.USERDEFINED) {
    const udtName = dtype.args.kind;
    base =
      udtName instanceof Expression
        ? getIdentifierName(udtName)
        : typeof udtName === 'string'
          ? udtName
          : 'varchar';
  } else if (kind instanceof Expression) {
    base = getIdentifierName(kind);
  } else if (typeof kind === 'string') {
    base = kind;
  } else {
    base = 'varchar';
  }

  if (expressions.length) {
    const args = expressions.map((expression) =>
      expression instanceof Expression ? getNodeText(expression) : String(expression),
    );
    return `${base}(${args.join(',')})`;
  }
  return base;
}

export function buildIndexColumn (inner: Expression): Index['columns'][number] {
  const isExpression = !(
    inner instanceof ColumnExpr
    || inner instanceof DotExpr
    || inner instanceof IdentifierExpr
  );
  return {
    type: isExpression ? 'expression' : 'column',
    value: isExpression ? inner.sql() : getNodeText(inner),
    token: getTokenPosition(inner),
  };
}

export function classifyValue (expression: Expression): {
  value: string | number;
  type: ValueType;
} {
  let inner = expression;
  while (inner instanceof ParenExpr && inner.args.this instanceof Expression) {
    inner = inner.args.this;
  }
  if (inner instanceof NullExpr) return {
    value: 'null',
    type: 'boolean',
  };
  if (inner instanceof BooleanExpr)
    return {
      value: inner.name.toLowerCase(),
      type: 'boolean',
    };
  if (inner instanceof LiteralExpr) {
    const value = inner.name;
    if (inner.args.isString) {
      return { value: value.replace(/''/g, "'"), type: 'string' };
    }
    return { value: Number(value), type: 'number' };
  }
  return { value: inner.sql(), type: 'expression' };
}
