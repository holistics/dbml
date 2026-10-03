import {
  CheckColumnConstraintExpr,
  CheckExpr,
  Expression,
  ForeignKeyExpr,
  IndexColumnConstraintExpr,
  IndexConstraintOptionExpr,
  IndexExpr,
  OrderedExpr,
  PrimaryKeyExpr,
  UniqueColumnConstraintExpr,
} from 'sqlingo';
import {
  filterExpressions, getNodeText, extractSchemaColumns, getTokenPosition, buildZeroToken, buildIndexColumn,
} from '../ast';
import { buildIndex } from './indexes';
import { buildFkRef } from './refs';
import type { TableCtx } from '../types';

export function dispatchConstraint (
  expression: Expression,
  context: TableCtx,
  constraintName?: string,
): void {
  if (expression instanceof PrimaryKeyExpr) {
    const columns = filterExpressions(expression.args.expressions ?? []).map(getNodeText);
    if (columns.length === 1 && !constraintName) {
      context.pkColumns.add(columns[0]);
    } else if (columns.length >= 1) {
      const token = getTokenPosition(expression);
      context.indexes.push({
        token,
        name: constraintName,
        pk: true,
        columns: columns.map((value) => ({ type: 'column', value, token })),
      });
    }
  } else if (expression instanceof ForeignKeyExpr) {
    const ref = buildFkRef(expression, context.name, context.schema, constraintName);
    if (ref) context.refs.push(ref);
  } else if (expression instanceof UniqueColumnConstraintExpr) {
    const inner = expression.args.this;
    const columns = inner instanceof Expression ? extractSchemaColumns(inner) : [];
    if (columns.length) {
      const token = getTokenPosition(expression);
      context.indexes.push({
        token,
        name: constraintName,
        unique: true,
        columns: columns.map((c) => ({ type: 'column', value: getNodeText(c), token: getTokenPosition(c) })),
      });
    }
  } else if (
    expression instanceof CheckColumnConstraintExpr
    || expression instanceof CheckExpr
  ) {
    const inner = expression.args.this;
    if (inner instanceof Expression)
      context.checks.push({ expression: inner.sql(), name: constraintName, token: getTokenPosition(inner) });
  } else if (expression instanceof IndexExpr) {
    const builtIndex = buildIndex(expression);
    if (builtIndex) {
      if (constraintName && !builtIndex.name) builtIndex.name = constraintName;
      context.indexes.push(builtIndex);
    }
  } else if (expression instanceof IndexColumnConstraintExpr) {
    const columns = filterExpressions(expression.args.expressions ?? []);
    const nameExpression = expression.args.this;
    const kind =
      typeof expression.args.kind === 'string'
        ? expression.args.kind.toUpperCase()
        : undefined;
    const token = nameExpression instanceof Expression ? getTokenPosition(nameExpression) : buildZeroToken();

    // Extract index type from USING clause; can appear before or after the column list.
    const preType = typeof expression.args.indexType === 'string' ? expression.args.indexType : undefined;
    const postType = (expression.args.options ?? [])
      .filter((opt): opt is IndexConstraintOptionExpr => opt instanceof IndexConstraintOptionExpr)
      .map((opt) => opt.args.using)
      .find((using) => typeof using === 'string');
    const indexType = (preType || postType)?.toLowerCase() || undefined;

    context.indexes.push({
      token,
      name: nameExpression instanceof Expression ? getNodeText(nameExpression) : constraintName,
      unique: kind === 'UNIQUE' || undefined,
      type: indexType,
      columns: columns.map((c) => {
        const inner = c instanceof OrderedExpr && c.args.this instanceof Expression ? c.args.this : c;
        return buildIndexColumn(inner);
      }),
    });
  }
}
