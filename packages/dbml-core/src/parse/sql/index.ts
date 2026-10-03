import {
  parseNewlineDelimited,
  Dialect,
  AlterExpr,
  CommandExpr,
  CommentExpr,
  ConditionalInsertExpr,
  CreateExpr,
  CreateExprKind,
  EqExpr,
  ExecuteExpr,
  Expression,
  IndexExpr,
  InsertExpr,
  MultitableInsertsExpr,
  ParameterExpr,
} from 'sqlingo';
import { parse as splitSql } from './preprocessor/statement.js';
import { MySQL } from 'sqlingo/mysql';
import { Postgres } from 'sqlingo/postgres';
import { TSQL } from 'sqlingo/mssql';
import { Snowflake } from 'sqlingo/snowflake';
import { Oracle } from 'sqlingo/oracle';
import { buildZeroToken, parseTableParts } from './ast';
import { buildIndex } from './builders/indexes';
import {
  processAlterTable,
  processComment,
  processCreateTable,
  processCreateType,
  processInsert,
} from './builders/statements';
import type {
  Database, Enum, Ref, Table, TableRecord,
} from '@dbml/parse';

function buildEmptyDatabase (): Database {
  return {
    schemas: [],
    tables: [],
    notes: [],
    refs: [],
    deps: [],
    enums: [],
    tableGroups: [],
    aliases: [],
    project: {},
    tablePartials: [],
    records: [],
    externals: { tables: [], enums: [], tableGroups: [], tablePartials: [], notes: [] },
    diagramViews: [],
  };
}

Dialect.register(MySQL, Postgres, TSQL, Snowflake, Oracle);

const DIALECT_NAMES: Record<string, string> = {
  mysql: 'mysql',
  postgres: 'postgres',
  mssql: 'tsql',
  snowflake: 'snowflake',
  oracle: 'oracle',
};

/**
 * MySQL client DELIMITER command changes the statement terminator used by the
 * mysql CLI before sending SQL to the server.
 * The server itself never sees DELIMITER - it is a client-only directive.
 * We emulate it here so that stored-procedure / trigger bodies with embedded semicolons are still split
 * correctly when the caller uses a non-standard delimiter.
 *
 * Algorithm: scan line-by-line; when we see "DELIMITER <token>", update the current delimiter and emit nothing for that line.  Otherwise accumulate lines until the current delimiter appears at the end of a line (ignoring whitespace), then emit the accumulated text as one statement.
 */
function splitMySQLDelimitedStatements (sql: string): string[] {
  let delimiter = ';';
  const statements: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const text = current.join('\n').trim();
    if (text) statements.push(text);
    current = [];
  };

  for (const line of sql.split('\n')) {
    // DELIMITER directive: whitespace-insensitive, case-insensitive keyword.
    const delimMatch = line.match(/^\s*DELIMITER\s+(\S+)\s*(?:--.*)?$/i);
    if (delimMatch) {
      flush();
      delimiter = delimMatch[1];
      continue;
    }

    current.push(line);

    // Check whether the line ends with the current delimiter (ignoring
    // trailing whitespace and inline comments after the delimiter).
    const trimmed = line.trimEnd();
    if (trimmed.endsWith(delimiter)) {
      // Strip the trailing delimiter before emitting.
      current[current.length - 1] = trimmed.slice(0, trimmed.length - delimiter.length);
      flush();
    }
  }

  flush();
  return statements;
}

/**
 * MSSQL uses EXEC sp_addextendedproperty to attach descriptions to tables and
 * columns.  Parse the named @param = value arguments and apply the note to the
 * matching table or column.
 */
function processMssqlExtendedProperty (
  statement: ExecuteExpr,
  tableByKey: Map<string, Table>,
  getKey: (schema: string | null | undefined, name: string) => string,
): void {
  const params: Record<string, string> = {};
  for (const expr of statement.args.expressions ?? []) {
    if (!(expr instanceof EqExpr)) continue;
    const lhs = expr.args.this;
    const rhs = expr.args.expression;
    if (!(lhs instanceof ParameterExpr) || !(rhs instanceof Expression)) continue;
    const paramName = lhs.name.toLowerCase();
    if (paramName) params[paramName] = rhs.name ?? '';
  }

  const { value, level0type, level0name, level1type, level1name, level2type, level2name } = params;
  const name = params['name']?.toLowerCase();
  if (name !== 'table_description' && name !== 'column_description') return;
  if (!level0type?.toLowerCase().includes('schema')) return;
  if (!level1type?.toLowerCase().includes('table')) return;

  const schemaName = level0name?.toLowerCase() === 'dbo' ? null : (level0name ?? null);
  const table = tableByKey.get(getKey(schemaName, level1name ?? ''));
  if (!table) return;

  const token = buildZeroToken();

  if (!level2type) {
    table.note = { value, token };
    return;
  }

  if (level2type.toLowerCase().includes('column')) {
    const field = table.fields.find((f) => f.name === level2name);
    if (field) field.note = { value, token };
  }
}

export function parse (sql: string, format: string): Database {
  const dialectName = DIALECT_NAMES[format];
  if (!dialectName) return buildEmptyDatabase();

  // MySQL uses the client-side DELIMITER command; split statements ourselves.
  const rawStatements = format === 'mysql'
    ? splitMySQLDelimitedStatements(sql)
    : splitSql(sql);

  const parsedStatements: (Expression | undefined)[] = [];
  for (const statement of rawStatements) {
    try {
      parsedStatements.push(...parseNewlineDelimited(statement, { read: dialectName }));
    } catch {
      // skip unparseable statements
    }
  }

  const tables: Table[] = [];
  // Refs from CREATE TABLE / inline FKs, filtered to tables present in the file.
  const inlineRefs: Ref[] = [];
  // Refs from ALTER TABLE ADD CONSTRAINT FOREIGN KEY, always included.
  const alterRefs: Ref[] = [];
  const enums: Enum[] = [];
  const records: TableRecord[] = [];
  const tableByKey = new Map<string, Table>();
  const key = (s: string | null | undefined, n: string) => (s ? `${s}.${n}` : n);

  for (const statement of parsedStatements) {
    if (!statement || statement instanceof CommandExpr) continue;

    if (statement instanceof CreateExpr) {
      if (statement.kind === CreateExprKind.TABLE) {
        const built = processCreateTable(statement, format);
        if (!built || built.table.fields.length === 0) continue;
        tables.push(built.table);
        enums.push(...built.enums);
        tableByKey.set(
          key(built.table.schemaName, built.table.name),
          built.table,
        );
        inlineRefs.push(...built.refs);
      } else if (statement.kind === CreateExprKind.TYPE) {
        const enumDefinition = processCreateType(statement);
        if (enumDefinition) enums.push(enumDefinition);
      } else if (statement.kind === CreateExprKind.INDEX) {
        const indexExpression = statement.args.this;
        if (!(indexExpression instanceof IndexExpr)) continue;
        const tableExpression = indexExpression.args.table;
        if (!(tableExpression instanceof Expression)) continue;
        const qualified = parseTableParts(tableExpression);
        const t = tableByKey.get(key(qualified.schema, qualified.name));
        if (!t) continue;
        const built = buildIndex(indexExpression);
        if (!built) continue;
        if (statement.args.unique) built.unique = true;
        t.indexes.push(built);
      }
      continue;
    }

    if (statement instanceof AlterExpr && statement.args.kind === 'table') {
      processAlterTable(statement, tables, alterRefs, format);
      continue;
    }

    if (statement instanceof InsertExpr) {
      const record = processInsert(statement, tableByKey);
      if (record) records.push(record);
      continue;
    }

    // Oracle INSERT ALL INTO ... SELECT produces MultitableInsertsExpr;
    // each branch is a ConditionalInsertExpr wrapping an InsertExpr.
    if (statement instanceof MultitableInsertsExpr) {
      for (const branch of statement.args.expressions ?? []) {
        if (!(branch instanceof ConditionalInsertExpr)) continue;
        const insertExpr = branch.args.this;
        if (!(insertExpr instanceof InsertExpr)) continue;
        const record = processInsert(insertExpr, tableByKey);
        if (record) records.push(record);
      }
      continue;
    }

    if (statement instanceof CommentExpr) {
      processComment(statement, tableByKey);
      continue;
    }

    if (statement instanceof ExecuteExpr
      && statement.name.toLowerCase() === 'sp_addextendedproperty'
    ) {
      processMssqlExtendedProperty(statement, tableByKey, key);
    }
  }

  // Only include CREATE TABLE / inline FK refs where both tables are known;
  // this avoids dangling refs from column-level FK declarations that reference
  // tables not present in the same file.
  const validInlineRefs = inlineRefs.filter((ref) =>
    ref.endpoints.every((endpoint) => tableByKey.has(key(endpoint.schemaName, endpoint.tableName))),
  );

  return {
    ...buildEmptyDatabase(),
    tables,
    refs: [...validInlineRefs, ...alterRefs],
    enums,
    records,
  };
}
