import {
  AddConstraintExpr,
  AlterColumnExpr,
  AlterExpr,
  ColumnDefExpr,
  ColumnExpr,
  CommentExpr,
  CommentExprKind,
  ConstraintExpr,
  CreateExpr,
  DataTypeExpr,
  DataTypeExprKind,
  DropExpr,
  Expression,
  ForeignKeyExpr,
  InsertExpr,
  PrimaryKeyExpr,
  PropertiesExpr,
  SchemaCommentPropertyExpr,
  SchemaExpr,
  ValuesExpr,
} from 'sqlingo';
import type {
  Column, Enum, Ref, Table, TableRecord,
} from '@dbml/parse';
import {
  classifyValue, getNodeText, parseTableParts, extractQualifiedNames, filterExpressions,
  getTokenPosition, buildZeroToken,
} from '../ast';
import { dispatchConstraint } from './constraints';
import { buildField } from './fields';
import { buildFkRef } from './refs';
import type { QualifiedName, TableCtx } from '../types';

export function processCreateTable (statement: CreateExpr, format: string): {
  table: Table;
  refs: Ref[];
  enums: Enum[];
} | undefined {
  const schemaNode = statement.args.this;
  if (!(schemaNode instanceof SchemaExpr)) return undefined;

  const tableNameExpression = schemaNode.args.this;
  if (!(tableNameExpression instanceof Expression)) return undefined;
  const qualified = parseTableParts(tableNameExpression);
  const token = getTokenPosition(tableNameExpression);
  const expressions = filterExpressions(schemaNode.args.expressions ?? []);

  const context: TableCtx = {
    schema: qualified.schema,
    name: qualified.name,
    fields: [],
    pkColumns: new Set(),
    refs: [],
    indexes: [],
    checks: [],
  };
  const enums: Enum[] = [];

  for (const expression of expressions) {
    if (expression instanceof ColumnDefExpr) {
      const { field, columnFks, inlineEnum } = buildField(expression, format, qualified.name);
      context.fields.push(field);
      if (inlineEnum) enums.push(inlineEnum);
      for (const columnFk of columnFks) {
        const refToken = buildZeroToken();
        context.refs.push({
          schemaName: null,
          name: null,
          onDelete: columnFk.onDelete,
          onUpdate: columnFk.onUpdate,
          token: refToken,
          endpoints: [
            {
              tableName: qualified.name,
              schemaName: qualified.schema ?? null,
              fieldNames: columnFk.fieldNames,
              relation: '0..*',
              token: refToken,
            },
            {
              tableName: columnFk.targetTable,
              schemaName: columnFk.targetSchema ?? null,
              fieldNames: columnFk.targetColumns,
              relation: '0..1',
              token: refToken,
            },
          ],
        });
      }
    } else if (expression instanceof ConstraintExpr) {
      const constraintNameExpression = expression.args.this;
      const constraintName =
        constraintNameExpression instanceof Expression ? getNodeText(constraintNameExpression) : undefined;
      for (const part of filterExpressions(expression.args.expressions ?? [])) {
        dispatchConstraint(part, context, constraintName);
      }
    } else {
      dispatchConstraint(expression, context, undefined);
    }
  }

  for (const field of context.fields) {
    if (context.pkColumns.has(field.name)) field.pk = true;
  }

  const properties = statement.args.properties;
  const commentProperty = properties instanceof PropertiesExpr
    ? (properties.args.expressions ?? []).findLast((e): e is SchemaCommentPropertyExpr => e instanceof SchemaCommentPropertyExpr)
    : undefined;
  const note = commentProperty?.args.this instanceof Expression
    ? { value: commentProperty.args.this.name ?? '', token: getTokenPosition(commentProperty.args.this) }
    : undefined;

  return {
    table: {
      name: qualified.name,
      schemaName: qualified.schema ?? null,
      alias: null,
      fields: context.fields,
      indexes: context.indexes,
      checks: context.checks,
      partials: [],
      token,
      ...(note ? { note } : {}),
    },
    refs: context.refs,
    enums,
  };
}

export function processAlterTable (
  statement: AlterExpr,
  tables: Table[],
  refs: Ref[],
  format: string,
): void {
  const tableNameExpression = statement.args.this;
  if (!(tableNameExpression instanceof Expression)) return;

  const qualified = parseTableParts(tableNameExpression);
  const target = tables.find(
    (table) =>
      table.name === qualified.name
      && table.schemaName === (qualified.schema ?? null),
  );

  for (const action of statement.args.actions ?? []) {
    if (!(action instanceof Expression)) continue;

    if (action instanceof ColumnDefExpr) {
      if (target) {
        const { field } = buildField(action, format, qualified.name);
        target.fields.push(field);
      }
    } else if (action instanceof DropExpr) {
      const dropKind = action.args.kind;
      if (target && typeof dropKind === 'string' && dropKind.toUpperCase() === 'COLUMN') {
        const colName =
          action.args.this instanceof Expression ? getNodeText(action.args.this) : '';
        target.fields = target.fields.filter((f: Column) => f.name !== colName);
      }
    } else if (action instanceof AddConstraintExpr) {
      for (const expression of filterExpressions(action.args.expressions ?? [])) {
        processAddedConstraint(expression, qualified, target, refs);
      }
    } else if (action instanceof AlterColumnExpr && target) {
      const colName =
        action.args.this instanceof Expression ? getNodeText(action.args.this) : '';
      const defaultExpression = action.args.default;
      if (colName && defaultExpression instanceof Expression) {
        const field = target.fields.find((field: Column) => field.name === colName);
        if (field) field.dbdefault = classifyValue(defaultExpression);
      }
    }
  }
}

function processAddedConstraint (
  expression: Expression,
  qualified: QualifiedName,
  target: Table | undefined,
  refs: Ref[],
): void {
  let constraintName: string | undefined;
  let inner = expression;

  if (expression instanceof ConstraintExpr) {
    const constraintNameExpression = expression.args.this;
    constraintName =
      constraintNameExpression instanceof Expression ? getNodeText(constraintNameExpression) : undefined;
    const parts = filterExpressions(expression.args.expressions ?? []);
    if (!parts.length) return;
    inner = parts[0];
  }

  if (inner instanceof ForeignKeyExpr) {
    const ref = buildFkRef(inner, qualified.name, qualified.schema, constraintName);
    if (ref) refs.push(ref);
  } else if (inner instanceof PrimaryKeyExpr && target) {
    const columns = filterExpressions(inner.args.expressions ?? []).map(getNodeText);
    if (columns.length === 1) {
      const field = target.fields.find((f: Column) => f.name === columns[0]);
      if (field) { field.pk = true; field.not_null = true; }
    } else if (columns.length > 1) {
      const token = getTokenPosition(inner);
      target.indexes.push({
        token,
        name: constraintName,
        pk: true,
        columns: columns.map((value) => ({ type: 'column', value, token })),
      });
    }
  } else if (target) {
    const alterContext: TableCtx = {
      schema: qualified.schema,
      name: qualified.name,
      fields: target.fields,
      pkColumns: new Set(),
      refs,
      indexes: target.indexes,
      checks: target.checks,
    };
    dispatchConstraint(inner, alterContext, constraintName);
  }
}

export function processInsert (
  statement: InsertExpr,
  tableByKey: Map<string, Table>,
): TableRecord | undefined {
  const schemaNode = statement.args.this;

  let qualified: QualifiedName;
  let columns: string[];

  if (schemaNode instanceof SchemaExpr) {
    const tableNameExpression = schemaNode.args.this;
    if (!(tableNameExpression instanceof Expression)) return undefined;
    qualified = parseTableParts(tableNameExpression);
    columns = filterExpressions(schemaNode.args.expressions ?? []).map(getNodeText);
  } else if (schemaNode instanceof Expression) {
    qualified = parseTableParts(schemaNode);
    columns = [];
  } else {
    return undefined;
  }

  if (!columns.length) {
    const key = qualified.schema ? `${qualified.schema}.${qualified.name}` : qualified.name;
    const table = tableByKey.get(key);
    if (table) columns = table.fields.map((f: Column) => f.name);
  }
  if (!columns.length) return undefined;

  const valuesExpression = statement.args.expression;
  if (!(valuesExpression instanceof ValuesExpr)) return undefined;

  const rows = filterExpressions(valuesExpression.args.expressions ?? []).map((row) => {
    return filterExpressions(row.args.expressions ?? []).map((cell) => {
      const { value, type } = classifyValue(cell);
      return { value, type, token: getTokenPosition(cell) };
    });
  });

  return {
    tableName: qualified.name,
    schemaName: qualified.schema ?? null,
    columns,
    values: rows,
    token: buildZeroToken(),
  };
}

export function processComment (
  statement: CommentExpr,
  tableByKey: Map<string, Table>,
): void {
  const kind = statement.args.kind;
  const thisExpression = statement.args.this;
  const textExpression = statement.args.expression;
  if (!(thisExpression instanceof Expression) || !(textExpression instanceof Expression)) return;

  const commentText = textExpression.name;

  if (kind === CommentExprKind.TABLE) {
    const qualified = parseTableParts(thisExpression);
    const key = qualified.schema ? `${qualified.schema}.${qualified.name}` : qualified.name;
    const table = tableByKey.get(key);
    if (table) table.note = { value: commentText, token: getTokenPosition(textExpression) };
  } else if (kind === CommentExprKind.COLUMN) {
    let colName: string | undefined;
    let tableName: string | undefined;
    let schemaName: string | undefined;

    if (thisExpression instanceof ColumnExpr) {
      colName = getNodeText(thisExpression.args.this);
      const tableExpression = thisExpression.args.table;
      if (tableExpression instanceof Expression) {
        const parts = parseTableParts(tableExpression);
        tableName = parts.name;
        schemaName = parts.schema;
      }
    } else {
      const parts = extractQualifiedNames(thisExpression);
      if (parts.length >= 2) {
        colName = parts[parts.length - 1];
        tableName = parts[parts.length - 2];
        schemaName = parts.length > 2 ? parts.slice(0, -2).join('.') : undefined;
      }
    }

    if (colName && tableName) {
      const key = schemaName ? `${schemaName}.${tableName}` : tableName;
      const table = tableByKey.get(key);
      if (table) {
        const field = table.fields.find((f: Column) => f.name === colName);
        if (field) field.note = { value: commentText, token: getTokenPosition(textExpression) };
      }
    }
  }
}

export function processCreateType (statement: CreateExpr): Enum | undefined {
  const tableExpression = statement.args.this;
  if (!(tableExpression instanceof Expression)) return undefined;
  const qualified = parseTableParts(tableExpression);

  const dataType = statement.args.expression;
  if (!(dataType instanceof DataTypeExpr)) return undefined;
  if (dataType.args.this !== DataTypeExprKind.ENUM) return undefined;

  const token = getTokenPosition(tableExpression);
  const values = (dataType.args.expressions ?? [])
    .filter((e) => e instanceof Expression && e.name)
    .map((e) => ({
      name: (e as Expression).name,
      token: getTokenPosition(e as Expression),
    }));

  return {
    name: qualified.name,
    schemaName: qualified.schema ?? null,
    token,
    values,
  };
}
