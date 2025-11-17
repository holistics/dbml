/**
 * Fast-check Arbitraries for SQL Constructs
 *
 * This module provides fast-check arbitraries for generating valid SQL
 * statements across different SQL dialects (MySQL, PostgreSQL, MSSQL, Snowflake).
 */

import * as fc from 'fast-check';

/**
 * SQL Identifier (table names, column names, etc.)
 */
export const sqlIdentifier = (): fc.Arbitrary<string> => {
  return fc.oneof(
    // Simple identifiers
    fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,30}$/),
    // Quoted identifiers (for special characters)
    fc.stringMatching(/^[a-zA-Z0-9_\- ]{1,30}$/).map((s) => `"${s}"`),
  );
};

/**
 * Schema name (optional schema qualifier)
 */
export const schemaName = (): fc.Arbitrary<string | null> => {
  return fc.option(sqlIdentifier(), { nil: null });
};

/**
 * Qualified table name (schema.table or just table)
 */
export const qualifiedTableName = (): fc.Arbitrary<string> => {
  return fc.tuple(schemaName(), sqlIdentifier()).map(([schema, table]) => {
    return schema ? `${schema}.${table}` : table;
  });
};

/**
 * SQL Data Types
 */
export const sqlDataType = (dialect: 'mysql' | 'postgres' | 'mssql' | 'snowflake' = 'postgres'): fc.Arbitrary<string> => {
  const commonTypes = [
    'INT',
    'INTEGER',
    'BIGINT',
    'SMALLINT',
    'VARCHAR(255)',
    'TEXT',
    'BOOLEAN',
    'DATE',
    'TIMESTAMP',
    'DECIMAL(10,2)',
    'FLOAT',
    'DOUBLE',
  ];

  const dialectTypes: Record<string, string[]> = {
    mysql: [...commonTypes, 'TINYINT', 'MEDIUMINT', 'DATETIME', 'ENUM(\'a\',\'b\')', 'JSON'],
    postgres: [...commonTypes, 'SERIAL', 'BIGSERIAL', 'UUID', 'JSONB', 'TIMESTAMPTZ', 'BYTEA'],
    mssql: [...commonTypes, 'NVARCHAR(255)', 'UNIQUEIDENTIFIER', 'DATETIME2', 'MONEY', 'BIT'],
    snowflake: [...commonTypes, 'NUMBER(38,0)', 'VARCHAR', 'VARIANT', 'ARRAY', 'OBJECT'],
  };

  return fc.constantFrom(...dialectTypes[dialect]);
};

/**
 * Column Constraints
 */
export interface ColumnConstraints {
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  autoIncrement?: boolean;
  defaultValue?: string;
  check?: string;
}

export const columnConstraints = (dialect: 'mysql' | 'postgres' | 'mssql' | 'snowflake' = 'postgres'): fc.Arbitrary<ColumnConstraints> => {
  return fc.record({
    primaryKey: fc.boolean(),
    notNull: fc.boolean(),
    unique: fc.boolean(),
    autoIncrement: fc.boolean(),
    defaultValue: fc.option(
      fc.oneof(
        fc.constantFrom('NULL', '0', '1', 'true', 'false', 'CURRENT_TIMESTAMP', '\'default\''),
        fc.integer().map((n) => n.toString()),
      ),
      { nil: undefined },
    ),
    check: fc.option(
      fc.constantFrom(
        'value > 0',
        'length(value) > 0',
        'value IN (1, 2, 3)',
        'value IS NOT NULL',
      ),
      { nil: undefined },
    ),
  });
};

/**
 * Column Definition
 */
export interface ColumnDefinition {
  name: string;
  type: string;
  constraints: ColumnConstraints;
}

export const columnDefinition = (dialect: 'mysql' | 'postgres' | 'mssql' | 'snowflake' = 'postgres'): fc.Arbitrary<ColumnDefinition> => {
  return fc.record({
    name: sqlIdentifier(),
    type: sqlDataType(dialect),
    constraints: columnConstraints(dialect),
  });
};

/**
 * Generate SQL for column constraints
 */
export function formatColumnConstraints (constraints: ColumnConstraints, dialect: string): string {
  const parts: string[] = [];

  if (constraints.primaryKey) parts.push('PRIMARY KEY');
  if (constraints.notNull) parts.push('NOT NULL');
  if (constraints.unique) parts.push('UNIQUE');

  if (constraints.autoIncrement) {
    if (dialect === 'mysql') parts.push('AUTO_INCREMENT');
    else if (dialect === 'postgres') {
      // In Postgres, use SERIAL type instead
    } else if (dialect === 'mssql') parts.push('IDENTITY(1,1)');
    else if (dialect === 'snowflake') parts.push('AUTOINCREMENT');
  }

  if (constraints.defaultValue !== undefined) {
    parts.push(`DEFAULT ${constraints.defaultValue}`);
  }

  if (constraints.check) {
    parts.push(`CHECK (${constraints.check})`);
  }

  return parts.join(' ');
}

/**
 * Format column definition as SQL
 */
export function formatColumnDefinition (col: ColumnDefinition, dialect: string): string {
  const constraintStr = formatColumnConstraints(col.constraints, dialect);
  return `${col.name} ${col.type}${constraintStr ? ' ' + constraintStr : ''}`;
}

/**
 * CREATE TABLE Statement
 */
export interface CreateTableStatement {
  tableName: string;
  columns: ColumnDefinition[];
  tableConstraints?: string[];
}

export const createTableStatement = (dialect: 'mysql' | 'postgres' | 'mssql' | 'snowflake' = 'postgres'): fc.Arbitrary<CreateTableStatement> => {
  return fc.record({
    tableName: qualifiedTableName(),
    columns: fc.array(columnDefinition(dialect), { minLength: 1, maxLength: 10 }),
    tableConstraints: fc.option(
      fc.array(
        fc.oneof(
          fc.tuple(sqlIdentifier(), fc.array(sqlIdentifier(), { minLength: 1, maxLength: 3 }))
            .map(([name, cols]) => `CONSTRAINT ${name} UNIQUE (${cols.join(', ')})`),
          fc.tuple(sqlIdentifier())
            .map(([col]) => `CHECK (${col} > 0)`),
        ),
        { maxLength: 3 },
      ),
      { nil: undefined },
    ),
  });
};

/**
 * Format CREATE TABLE statement as SQL
 */
export function formatCreateTable (stmt: CreateTableStatement, dialect: string): string {
  const columnDefs = stmt.columns.map((col) => formatColumnDefinition(col, dialect));
  const allConstraints = [...columnDefs];

  if (stmt.tableConstraints && stmt.tableConstraints.length > 0) {
    allConstraints.push(...stmt.tableConstraints);
  }

  return `CREATE TABLE ${stmt.tableName} (\n  ${allConstraints.join(',\n  ')}\n);`;
}

/**
 * CREATE INDEX Statement
 */
export interface CreateIndexStatement {
  indexName: string;
  tableName: string;
  columns: string[];
  unique?: boolean;
}

export const createIndexStatement = (): fc.Arbitrary<CreateIndexStatement> => {
  return fc.record({
    indexName: sqlIdentifier(),
    tableName: qualifiedTableName(),
    columns: fc.array(sqlIdentifier(), { minLength: 1, maxLength: 5 }),
    unique: fc.boolean(),
  });
};

/**
 * Format CREATE INDEX statement as SQL
 */
export function formatCreateIndex (stmt: CreateIndexStatement): string {
  const uniqueStr = stmt.unique ? 'UNIQUE ' : '';
  return `CREATE ${uniqueStr}INDEX ${stmt.indexName} ON ${stmt.tableName} (${stmt.columns.join(', ')});`;
}

/**
 * Foreign Key Reference
 */
export interface ForeignKeyReference {
  constraintName: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export const foreignKeyReference = (): fc.Arbitrary<ForeignKeyReference> => {
  return fc.record({
    constraintName: sqlIdentifier(),
    fromTable: qualifiedTableName(),
    fromColumns: fc.array(sqlIdentifier(), { minLength: 1, maxLength: 3 }),
    toTable: qualifiedTableName(),
    toColumns: fc.array(sqlIdentifier(), { minLength: 1, maxLength: 3 }),
    onDelete: fc.option(fc.constantFrom('CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'), { nil: undefined }),
    onUpdate: fc.option(fc.constantFrom('CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'), { nil: undefined }),
  });
};

/**
 * Format ALTER TABLE ADD FOREIGN KEY statement
 */
export function formatForeignKey (fk: ForeignKeyReference): string {
  let sql = `ALTER TABLE ${fk.fromTable} ADD CONSTRAINT ${fk.constraintName} `;
  sql += `FOREIGN KEY (${fk.fromColumns.join(', ')}) `;
  sql += `REFERENCES ${fk.toTable} (${fk.toColumns.join(', ')})`;

  if (fk.onDelete) sql += ` ON DELETE ${fk.onDelete}`;
  if (fk.onUpdate) sql += ` ON UPDATE ${fk.onUpdate}`;

  return sql + ';';
}

/**
 * CREATE ENUM (PostgreSQL-specific)
 */
export interface CreateEnumStatement {
  enumName: string;
  values: string[];
}

export const createEnumStatement = (): fc.Arbitrary<CreateEnumStatement> => {
  return fc.record({
    enumName: sqlIdentifier(),
    values: fc.array(
      fc.stringMatching(/^[a-zA-Z0-9_]{1,20}$/),
      { minLength: 1, maxLength: 10 },
    ),
  });
};

/**
 * Format CREATE TYPE (enum) statement
 */
export function formatCreateEnum (stmt: CreateEnumStatement): string {
  const valueList = stmt.values.map((v) => `'${v}'`).join(', ');
  return `CREATE TYPE ${stmt.enumName} AS ENUM (${valueList});`;
}

/**
 * Complete SQL Schema (multiple statements)
 */
export interface SqlSchema {
  enums?: CreateEnumStatement[];
  tables: CreateTableStatement[];
  indexes?: CreateIndexStatement[];
  foreignKeys?: ForeignKeyReference[];
}

export const sqlSchema = (dialect: 'mysql' | 'postgres' | 'mssql' | 'snowflake' = 'postgres'): fc.Arbitrary<SqlSchema> => {
  return fc.record({
    enums: dialect === 'postgres'
      ? fc.option(fc.array(createEnumStatement(), { maxLength: 5 }), { nil: undefined })
      : fc.constant(undefined),
    tables: fc.array(createTableStatement(dialect), { minLength: 1, maxLength: 5 }),
    indexes: fc.option(fc.array(createIndexStatement(), { maxLength: 5 }), { nil: undefined }),
    foreignKeys: fc.option(fc.array(foreignKeyReference(), { maxLength: 5 }), { nil: undefined }),
  });
};

/**
 * Format complete SQL schema
 */
export function formatSqlSchema (schema: SqlSchema, dialect: string): string {
  const parts: string[] = [];

  // Enums first (PostgreSQL)
  if (schema.enums && schema.enums.length > 0) {
    parts.push(...schema.enums.map(formatCreateEnum));
  }

  // Tables
  parts.push(...schema.tables.map((t) => formatCreateTable(t, dialect)));

  // Indexes
  if (schema.indexes && schema.indexes.length > 0) {
    parts.push(...schema.indexes.map(formatCreateIndex));
  }

  // Foreign keys
  if (schema.foreignKeys && schema.foreignKeys.length > 0) {
    parts.push(...schema.foreignKeys.map(formatForeignKey));
  }

  return parts.join('\n\n');
}

/**
 * Malformed SQL (for fuzzing tests)
 */
export const malformedSql = (): fc.Arbitrary<string> => {
  return fc.oneof(
    // Random strings
    fc.string({ minLength: 0, maxLength: 1000 }),
    // SQL keywords in wrong order
    fc.constantFrom(
      'TABLE CREATE users',
      'SELECT FROM',
      'INSERT INTO',
      'CREATE TABLE',
      'DROP',
    ),
    // Incomplete statements
    fc.constantFrom(
      'CREATE TABLE users (',
      'ALTER TABLE',
      'CREATE INDEX ON',
      'FOREIGN KEY (',
    ),
    // Invalid characters
    fc.stringMatching(/^[!@#$%^&*(){}[\]|\\;:'"<>?,./~`]{1,100}$/),
    // Mixed valid and invalid
    fc.tuple(createTableStatement(), fc.string()).map(([stmt, noise]) =>
      `${formatCreateTable(stmt, 'postgres')} ${noise}`,
    ),
  );
};
