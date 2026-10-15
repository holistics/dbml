import {
  AutoIncrementColumnConstraintExpr,
  CheckColumnConstraintExpr,
  ColumnConstraintExpr,
  ColumnDefExpr,
  CommentColumnConstraintExpr,
  DataTypeExpr,
  DataTypeExprKind,
  DefaultColumnConstraintExpr,
  Expression,
  GeneratedAsIdentityColumnConstraintExpr,
  NotNullColumnConstraintExpr,
  PrimaryKeyColumnConstraintExpr,
  ReferenceExpr,
  UniqueColumnConstraintExpr,
} from 'sqlingo';
import type { Column, Enum } from '@dbml/parse';
import {
  buildTypeName, classifyValue, getNodeText,
  getTokenPosition, buildZeroToken,
} from '../ast';
import { buildColumnFkData } from './refs';
import type { ColumnFkData } from './refs';

export function buildField (
  columnDef: ColumnDefExpr,
  format: string,
  tableName: string,
): {
  field: Column;
  columnFks: ColumnFkData[];
  inlineEnum: Enum | undefined;
} {
  const columnNameExpression = columnDef.args.this;
  const name =
    columnNameExpression instanceof Expression
      ? getNodeText(columnNameExpression)
      : String(columnNameExpression ?? '');
  const typeExpression = columnDef.args.kind;
  const token = columnNameExpression instanceof Expression ? getTokenPosition(columnNameExpression) : buildZeroToken();

  let typeName: string;
  let typeArgs: string | null = null;
  let inlineEnum: Enum | undefined;

  if (
    typeExpression instanceof DataTypeExpr
    && typeExpression.args.this === DataTypeExprKind.ENUM
    && format === 'mysql'
  ) {
    const enumName = `${tableName}_${name}_enum`;
    const rawExpressions = typeExpression.args.expressions ?? [];
    const argsArr = rawExpressions.map((expression) =>
      expression instanceof Expression ? expression.sql() : String(expression),
    );
    typeArgs = argsArr.join(',');
    const values = rawExpressions.map((e) => ({
      name: e instanceof Expression ? e.name : String(e),
      token: e instanceof Expression ? getTokenPosition(e) : buildZeroToken(),
    }));
    typeName = enumName;
    inlineEnum = {
      name: enumName,
      schemaName: null,
      token,
      values,
    };
  } else if (typeExpression instanceof DataTypeExpr) {
    typeName = buildTypeName(typeExpression);
  } else {
    typeName = typeof typeExpression === 'string' ? typeExpression : 'varchar';
  }

  const isSerial =
    typeExpression instanceof DataTypeExpr
    && (typeExpression.args.this === DataTypeExprKind.SERIAL
      || typeExpression.args.this === DataTypeExprKind.BIGSERIAL
      || typeExpression.args.this === DataTypeExprKind.SMALLSERIAL);

  const field: Column = {
    name,
    type: {
      type_name: typeName,
      schemaName: null,
      args: typeArgs,
    },
    token,
    inline_refs: [],
    inline_deps: [],
    checks: [],
    ...(isSerial && { increment: true }),
  };
  const columnFks: ColumnFkData[] = [];

  for (const constraintWrapper of columnDef.constraints) {
    if (!(constraintWrapper instanceof ColumnConstraintExpr)) continue;
    const kind = constraintWrapper.args.kind;
    if (!kind || !(kind instanceof Expression)) continue;

    if (kind instanceof PrimaryKeyColumnConstraintExpr) {
      field.pk = true;
    } else if (kind instanceof NotNullColumnConstraintExpr) {
      field.not_null = !kind.args.allowNull;
    } else if (kind instanceof UniqueColumnConstraintExpr) {
      field.unique = true;
    } else if (
      kind instanceof AutoIncrementColumnConstraintExpr
      || kind instanceof GeneratedAsIdentityColumnConstraintExpr
    ) {
      field.increment = true;
    } else if (kind instanceof DefaultColumnConstraintExpr) {
      const inner = kind.args.this;
      if (inner instanceof Expression) field.dbdefault = classifyValue(inner);
    } else if (kind instanceof CommentColumnConstraintExpr) {
      const inner = kind.args.this;
      if (inner instanceof Expression) field.note = { value: getNodeText(inner), token: getTokenPosition(inner) };
    } else if (kind instanceof CheckColumnConstraintExpr) {
      const inner = kind.args.this;
      if (inner instanceof Expression)
        field.checks.push({ expression: inner.sql(), token: getTokenPosition(inner) });
    } else if (kind instanceof ReferenceExpr) {
      const ref = buildColumnFkData(kind, name);
      if (ref) columnFks.push(ref);
    }
  }

  return { field, columnFks, inlineEnum };
}
