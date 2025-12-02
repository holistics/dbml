import { Connection } from 'oracledb';
import { CheckConstraint, CheckConstraintDictionary, Index, IndexesDictionary, TableConstraintsDictionary } from '../types';
import { EXECUTE_OPTIONS, LIST_SEPARATOR } from './utils';

export async function generateConstraints (client: Connection): Promise<{
  indexes: IndexesDictionary;
  tableConstraints: TableConstraintsDictionary;
  checks: CheckConstraintDictionary;
}> {
  const query = `
    WITH all_constraints AS (
      SELECT
        c.CONSTRAINT_NAME,
        c.TABLE_NAME,
        c.CONSTRAINT_TYPE,
        c.SEARCH_CONDITION_VC AS CHECK_EXPRESSION
      FROM USER_CONSTRAINTS c
      WHERE c.CONSTRAINT_TYPE IN ('P', 'U', 'C') -- P stands for primary key, U stands for unique and C stands for check
        AND (c.CONSTRAINT_TYPE != 'C' OR UPPER(c.SEARCH_CONDITION_VC) NOT LIKE '%IS NOT NULL')
    ),
    constraint_columns AS (
      SELECT
        cc.CONSTRAINT_NAME,
        LISTAGG(cc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY cc.POSITION) AS COLUMNS,
        COUNT(cc.COLUMN_NAME) AS COLUMN_COUNT
      FROM USER_CONS_COLUMNS cc
      GROUP BY cc.CONSTRAINT_NAME
    )
    SELECT
      ac.CONSTRAINT_NAME AS "constraint_name",
      ac.TABLE_NAME AS "table_name",
      cc.COLUMNS AS "columns",
      cc.COLUMN_COUNT AS "column_count",
      ac.CHECK_EXPRESSION AS "check_expression",
      ac.CONSTRAINT_TYPE AS "constraint_type"
    FROM all_constraints ac
    LEFT JOIN constraint_columns cc
      ON ac.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
  `;

  const indexes: IndexesDictionary = {};
  const tableConstraints: TableConstraintsDictionary = {};
  const checks: CheckConstraintDictionary = {};

  const res = await client.execute(query, [], EXECUTE_OPTIONS);
  res.rows?.forEach((row) => {
    const { constraint_name, table_name, columns: columnsStr, column_count, check_expression, constraint_type } = row as Record<string, unknown>;
    const tableName = table_name as string;
    const constraintName = (constraint_name as string) || '';
    const columns = ((columnsStr as string) || '').split(LIST_SEPARATOR);
    const columnCount = (column_count as number) || 1;
    const constraintType = constraint_type as 'P' | 'U' | 'C';
    const checkExpression = (check_expression || null) as string | null;

    // Table-level check constraints
    if (constraintType === 'C' && checkExpression && columnCount > 1) {
      if (!checks[tableName]) checks[tableName] = [];
      const check: CheckConstraint = {
        name: constraintName,
        expression: checkExpression,
      };
      checks[tableName].push(check);
      return;
    }
    // Column-level check constraints
    if (constraintType === 'C' && checkExpression && columnCount === 1 && columns.length === 1) {
      if (!tableConstraints[tableName]) tableConstraints[tableName] = {};
      const column = columns[0];
      if (!tableConstraints[tableName][column]) tableConstraints[tableName][column] = { checks: [] };
      tableConstraints[tableName][column].checks.push({
        name: constraintName,
        expression: checkExpression,
      });
    }
    // Column-level unique or primary indexes
    if (['P', 'U'].includes(constraintType) && columnCount === 1 && columns.length === 1) {
      if (!tableConstraints[tableName]) tableConstraints[tableName] = {};
      const column = columns[0];
      if (!tableConstraints[tableName][column]) tableConstraints[tableName][column] = { checks: [] };
      tableConstraints[tableName][column].pk ||= constraintType === 'P';
      tableConstraints[tableName][column].unique ||= constraintType === 'U';
    }
    // Table-level unique or primary indexes
    if (['P', 'U'].includes(constraintType) && columnCount > 1) {
      if (!tableConstraints[tableName]) tableConstraints[tableName] = {};
      if (!indexes[tableName]) indexes[tableName] = [];
      const index: Index = {
        name: constraintName,
        type: '',
        unique: true,
        pk: constraintType === 'P',
        columns: columns.map((c) => ({
          type: 'column',
          value: c,
        })),
      };
      indexes[tableName].push(index);
    }
  });

  return {
    indexes,
    tableConstraints,
    checks,
  };
}
