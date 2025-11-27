import { Connection } from 'oracledb';
import { CheckConstraint, CheckConstraintDictionary, Index, IndexesDictionary, TableConstraintsDictionary } from '../types';
import { LIST_SEPARATOR } from './utils';

export async function generateConstraints (client: Connection): Promise<{
  indexes: IndexesDictionary;
  tableConstraints: TableConstraintsDictionary;
  checks: CheckConstraintDictionary;
}> {
  const query = `
    WITH all_constraints AS (
        SELECT 
            c.CONSTRAINT_NAME AS constraint_name,
            c.TABLE_NAME AS table_name,
            c.CONSTRAINT_TYPE AS constraint_type,
            c.SEARCH_CONDITION_VC AS constraint_check_expression
        FROM USER_CONSTRAINTS c
        WHERE
          c.CONSTRAINT_TYPE IN ('P', 'U', 'C')
          AND (c.CONSTRAINT_TYPE != 'C' OR UPPER(c.SEARCH_CONDITION_VC) NOT LIKE '%IS NOT NULL%')
    ),
    constraint_columns AS (
        SELECT 
            cc.CONSTRAINT_NAME AS constraint_name,
            LISTAGG(cc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY cc.POSITION) AS columns, -- a complex separator is used to avoid the column name containing the separator itself
            COUNT(cc.COLUMN_NAME) AS column_count
        FROM USER_CONS_COLUMNS cc
        GROUP BY cc.CONSTRAINT_NAME
    )
    SELECT 
        ac.constraint_name,
        ac.table_name,
        cc.columns,
        cc.column_count,
        ac.constraint_check_expression,
        ac.constraint_type
    FROM all_constraints ac
    LEFT JOIN constraint_columns cc 
        ON ac.constraint_name = cc.constraint_name
  `;

  const indexes: IndexesDictionary = {};
  const tableConstraints: TableConstraintsDictionary = {};
  const checks: CheckConstraintDictionary = {};

  const res = await client.execute(query);
  res.rows?.forEach((row) => {
    const { constraint_name, table_name, columns: _columns, column_count, constraint_check_expression, constraint_type } = row as Record<string, unknown>;
    const tableName = table_name as string;
    const constraintName = constraint_name as string || '';
    const columns = (_columns as string || '').split(LIST_SEPARATOR);
    const columnCount = column_count as number || 1;
    const constraintType = constraint_type as 'P' | 'U' | 'C';
    const constraintCheckExpression = (constraint_check_expression || null) as string | null;

    // Table-level check constraints
    if (constraintType === 'C' && constraintCheckExpression && columnCount > 1) {
      if (!checks[tableName]) checks[tableName] = [];
      const check: CheckConstraint = {
        name: constraintName,
        expression: constraintCheckExpression,
      };
      checks[tableName].push(check);
      return;
    }
    // Column-level check constraints
    if (constraintType === 'C' && constraintCheckExpression && columnCount === 1 && columns.length === 1) {
      if (!tableConstraints[tableName]) tableConstraints[tableName] = {};
      const column = columns[0];
      if (!tableConstraints[tableName][column]) tableConstraints[tableName][column] = { checks: [] };
      tableConstraints[tableName][column].checks.push({
        name: constraintName,
        expression: constraintCheckExpression,
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
        unique: true, // primary and unique indexes all imply uniqueness
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
