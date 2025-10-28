/* eslint-disable camelcase */
import { Client } from 'pg';
import { buildSchemaQuery, parseConnectionString } from '../utils/parseSchema';
import {
  CheckConstraintDictionary,
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  Enum,
  Field,
  FieldsDictionary,
  IndexesDictionary,
  Ref,
  RefEndpoint,
  Table,
  TableConstraintsDictionary,
} from './types';

const getValidatedClient = async (connection: string): Promise<Client> => {
  const client = new Client(connection);
  try {
    // Connect to the PostgreSQL server
    await client.connect();

    // Validate if the connection is successful by making a simple query
    await client.query('SELECT 1');

    // If successful, return the client
    return client;
  } catch (err) {
    // Ensure to close the client in case of failure
    await client.end();

    if (err instanceof Error) {
      throw new Error(`PostgreSQL connection error: ${err}`);
    }

    throw err; // Rethrow error if you want the calling code to handle it
  }
};

const convertQueryBoolean = (val: string | null) => val === 'YES';

const getFieldType = (data_type: string, udt_name: string, character_maximum_length: number, numeric_precision: number, numeric_scale: number): string => {
  if (data_type === 'ARRAY') {
    return `${udt_name.slice(1, udt_name.length)}[]`;
  }
  if (character_maximum_length) {
    return `${udt_name}(${character_maximum_length})`;
  }
  if (numeric_precision && numeric_scale) {
    return `${udt_name}(${numeric_precision},${numeric_scale})`;
  }
  return udt_name;
};

const getDbdefault = (data_type: string, column_default: string, default_type: DefaultType): DefaultInfo => {
  if (data_type === 'ARRAY') {
    const values = column_default.slice(6, -1).split(',').map((value) => {
      return value.split('::')[0];
    });
    return {
      type: default_type,
      value: `ARRAY[${values.join(', ')}]`,
    };
  }
  if (default_type === 'string') {
    const defaultValues = column_default.split('::')[0];
    const isJson = data_type === 'json' || data_type === 'jsonb';
    const type = isJson ? 'expression' : 'string';
    return {
      type,
      value: defaultValues.slice(1, -1),
    };
  }
  return {
    type: default_type,
    value: column_default,
  };
};

const generateField = (row: Record<string, any>): Field => {
  const {
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    udt_schema,
    udt_name,
    identity_increment,
    is_nullable,
    column_default,
    default_type,
    column_comment,
  } = row;

  const dbdefault = column_default && default_type !== 'increment' ? getDbdefault(data_type, column_default, default_type) : null;

  const fieldType = data_type === 'USER-DEFINED' ? {
    type_name: udt_name,
    schemaName: udt_schema,
  } : {
    type_name: getFieldType(data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale),
    schemaName: null,
  };

  return {
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment || default_type === 'increment',
    note: column_comment ? { value: column_comment } : { value: '' },
  };
};

const generateTablesAndFields = async (client: Client, schemas: string[]): Promise<{
  tables: Table[],
  fields: FieldsDictionary,
}> => {
  const fields: FieldsDictionary = {};
  const tablesAndFieldsSql = `
    WITH
      comments AS (
        SELECT DISTINCT ON (pc.relname, pn.nspname, pa.attname)
          pc.relname AS table_name,
          pn.nspname AS table_schema,
          pa.attname AS column_name,
          pd.description
        FROM
          pg_description pd
        JOIN
          pg_class pc ON pd.objoid = pc.oid
        JOIN
          pg_namespace pn ON pc.relnamespace = pn.oid
        LEFT JOIN
          pg_attribute pa ON pd.objoid = pa.attrelid AND pd.objsubid = pa.attnum
        WHERE
          pc.relkind = 'r'
          AND pn.nspname NOT IN ('pg_catalog', 'information_schema')
      ),
      table_positions AS (
        SELECT
          pc.oid as table_ordinal_position,
          pc.relname as table_name,
          pn.nspname as table_schema
        FROM pg_class pc
        JOIN pg_namespace pn
        ON pc.relnamespace = pn.oid
        WHERE
          -- r is ordinary table
          -- see https://www.postgresql.org/docs/14/catalog-pg-class.html#:~:text=%3D%20temporary%20table-,relkind,-char
          pc.relkind = 'r'
          AND pn.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          ${buildSchemaQuery('pn.nspname', schemas)}
      )
    SELECT
      t.table_schema,
      t.table_name,
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.udt_schema,
      c.udt_name,
      c.identity_increment,
      c.is_nullable,
      c.column_default,
      c.ordinal_position,
      CASE
        WHEN c.column_default IS NULL THEN NULL
        WHEN c.column_default LIKE 'nextval(%' THEN 'increment'
        WHEN c.column_default LIKE '''%' THEN 'string'
        WHEN c.column_default = 'true' OR c.column_default = 'false' THEN 'boolean'
        WHEN c.column_default ~ '^-?[0-9]+(.[0-9]+)?$' THEN 'number'
        ELSE 'expression'
      END AS default_type,
      (SELECT description FROM comments WHERE table_name = t.table_name AND table_schema = t.table_schema AND column_name IS NULL LIMIT 1) AS table_comment,
      (SELECT description FROM comments WHERE table_name = t.table_name AND table_schema = t.table_schema AND column_name = c.column_name LIMIT 1) AS column_comment
    FROM
      information_schema.columns c
    JOIN
      information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    JOIN
      table_positions tp ON tp.table_name = t.table_name AND tp.table_schema = t.table_schema
    WHERE
      t.table_type = 'BASE TABLE'
      AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
      ${buildSchemaQuery('t.table_schema', schemas)}
    ORDER BY
      t.table_schema,
      tp.table_ordinal_position,
      c.ordinal_position
    ;
  `;

  const tablesAndFieldsResult = await client.query(tablesAndFieldsSql);
  const tables = tablesAndFieldsResult.rows.reduce((acc, row) => {
    const { table_schema, table_name, table_comment } = row;
    const key = `${table_schema}.${table_name}`;

    if (!acc[key]) {
      acc[key] = {
        name: table_name,
        schemaName: table_schema,
        note: table_comment ? { value: table_comment } : { value: '' },
      };
    }

    if (!fields[key]) fields[key] = [];
    const field = generateField(row);
    fields[key].push(field);

    return acc;
  }, {});

  return {
    tables: Object.values(tables),
    fields,
  };
};

const generateRawRefs = async (client: Client, schemas: string[]): Promise<Ref[]> => {
  const refs: Ref[] = [];

  const refsListSql = `
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name as fk_constraint_name,
      STRING_AGG(DISTINCT kcu.column_name, ',') AS column_names,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      STRING_AGG(DISTINCT ccu.column_name, ',') AS foreign_column_names,
      tc.constraint_type,
      rc.delete_rule AS on_delete,
      rc.update_rule AS on_update
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      ${buildSchemaQuery('tc.table_schema', schemas)}
    GROUP BY
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      ccu.table_schema,
      ccu.table_name,
      tc.constraint_type,
      rc.delete_rule,
      rc.update_rule
    ORDER BY
      tc.table_schema,
      tc.table_name;
  `;

  const refsQueryResult = await client.query(refsListSql);
  refsQueryResult.rows.forEach((refRow) => {
    const {
      table_schema,
      fk_constraint_name,
      table_name,
      column_names,
      foreign_table_schema,
      foreign_table_name,
      foreign_column_names,
      on_delete,
      on_update,
    } = refRow;

    const ep1: RefEndpoint = {
      tableName: table_name,
      schemaName: table_schema,
      fieldNames: column_names.split(','),
      relation: '*',
    };

    const ep2: RefEndpoint = {
      tableName: foreign_table_name,
      schemaName: foreign_table_schema,
      fieldNames: foreign_column_names.split(','),
      relation: '1',
    };

    refs.push({
      name: fk_constraint_name,
      endpoints: [ep1, ep2],
      onDelete: on_delete === 'NO ACTION' ? null : on_delete,
      onUpdate: on_update === 'NO ACTION' ? null : on_update,
    });
  });

  return refs;
};

const generateIndexesAndConstraints = async (client: Client, schemas: string[]) => {
  const indexListSql = `
    WITH user_tables AS (
      SELECT
        schemaname AS tableschema,
        tablename
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')  -- Exclude system schemas
        AND tablename NOT LIKE 'pg_%'  -- Exclude PostgreSQL system tables
        AND tablename NOT LIKE 'sql_%'  -- Exclude SQL standard tables
    ),
    index_info AS (
      SELECT
        t.relnamespace::regnamespace::text AS table_schema,
        t.relname AS table_name,
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        am.amname AS index_type,
        array_to_string(array_agg(a.attname ORDER BY x.n), ', ') AS columns,
        pg_get_expr(ix.indexprs, ix.indrelid) AS expressions,
        CASE
          WHEN ix.indisprimary THEN 'PRIMARY KEY'
          WHEN ix.indisunique THEN 'UNIQUE'
          ELSE NULL
        END AS constraint_type
      FROM
        pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_am am ON i.relam = am.oid
        LEFT JOIN generate_subscripts(ix.indkey, 1) AS x(n) ON a.attnum = ix.indkey[x.n]
      WHERE
        t.relkind = 'r'
        AND t.relname NOT LIKE 'pg_%'
        AND t.relname NOT LIKE 'sql_%'
      GROUP BY
        t.relnamespace, t.relname, i.relname, ix.indisunique, ix.indisprimary, am.amname, ix.indexprs, ix.indrelid
    )
    SELECT
      ut.tableschema AS table_schema,
      ut.tablename AS table_name,
      ii.index_name,
      ii.is_unique,
      ii.is_primary,
      ii.index_type,
      ii.columns AS index_columns,
      ii.expressions AS index_expressions,
      ii.constraint_type  -- Retained constraint type here
    FROM
      user_tables ut
    LEFT JOIN
      index_info ii ON ut.tableschema = ii.table_schema AND ut.tablename = ii.table_name
    WHERE ii.columns IS NOT NULL
    ${buildSchemaQuery('ut.tableschema', schemas)}
    ORDER BY
      ut.tablename,
      ii.constraint_type,
      ii.index_name
    ;
  `;
  const indexListResult = await client.query(indexListSql);
  const { outOfLineIndexes, inlineIndexes } = indexListResult.rows.reduce((acc, row) => {
    const { constraint_type, index_columns } = row;

    if (index_columns === 'null' || index_columns.trim() === '') return acc;

    const isSingleColumn = index_columns.split(',').length === 1;
    const isInlineIndex = isSingleColumn && (constraint_type === 'PRIMARY KEY' || constraint_type === 'UNIQUE');
    if (isInlineIndex) {
      acc.inlineIndexes.push(row);
    } else {
      acc.outOfLineIndexes.push(row);
    }
    return acc;
  }, { outOfLineIndexes: [], inlineIndexes: [] });

  const indexes = outOfLineIndexes.reduce((acc: IndexesDictionary, indexRow: Record<string, any>) => {
    const {
      table_schema,
      table_name,
      index_name,
      index_type,
      index_columns,
      index_expressions,
    } = indexRow;
    const indexColumns = index_columns.split(',').map((column: string) => {
      return {
        type: 'column',
        value: column.trim(),
      };
    });

    const indexExpressions = index_expressions ? index_expressions.split(',').map((expression: string) => {
      return {
        type: 'expression',
        value: expression,
      };
    }) : [];

    const index = {
      name: index_name,
      type: index_type,
      columns: [
        ...indexColumns,
        ...indexExpressions,
      ],
    };

    const key = `${table_schema}.${table_name}`;
    if (acc[key]) {
      acc[key].push(index);
    } else {
      acc[key] = [index];
    }

    return acc;
  }, {});

  const tableConstraints: TableConstraintsDictionary = {};

  inlineIndexes.forEach((row: Record<string, any>) => {
    const {
      table_schema,
      table_name,
      index_columns,
      constraint_type,
    } = row;
    const key = `${table_schema}.${table_name}`;
    if (!tableConstraints[key]) tableConstraints[key] = {};

    const columnNames = index_columns.split(',').map((column: string) => column.trim());
    columnNames.forEach((columnName: string) => {
      if (!tableConstraints[key][columnName]) tableConstraints[key][columnName] = { checks: [] };
      if (constraint_type === 'PRIMARY KEY') {
        tableConstraints[key][columnName].pk = true;
      }
      if (constraint_type === 'UNIQUE' && !tableConstraints[key][columnName].pk) {
        tableConstraints[key][columnName].unique = true;
      }
    });
  }, {});

  const checkListSql = `
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      MAX(a.attname) AS column_name,
      con.conname AS check_name,
      pg_get_constraintdef(con.oid) AS check_definition,
      CASE
        WHEN COUNT(*) = 1 THEN TRUE
        ELSE FALSE
      END AS is_column_constraint 
    FROM
      pg_catalog.pg_constraint AS con
    JOIN
      pg_catalog.pg_class AS c
      ON con.conrelid = c.oid
    LEFT JOIN
      pg_catalog.pg_namespace AS n
      ON c.relnamespace = n.oid
    LEFT JOIN
      pg_catalog.pg_attribute AS a
      ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
    WHERE con.contype = 'c' -- 'c' for CHECK constraints
    ${buildSchemaQuery('n.nspname', schemas)}
    GROUP BY
      con.conname,
      n.nspname,
      c.relname,
      con.oid
  `;
  const checkListResult = await client.query(checkListSql);
  const checks: CheckConstraintDictionary = {};
  checkListResult.rows.forEach((row) => {
    const {
      table_schema,
      table_name,
      check_name,
      check_definition,
      column_name,
      is_column_constraint,
    } = row;
    if (typeof table_schema !== 'string' || typeof table_name !== 'string' || typeof check_definition !== 'string') {
      return;
    }
    if (!check_definition.match(/CHECK \(\(.*\)\)/)) {
      return;
    }
    if (is_column_constraint && typeof column_name !== 'string') {
      return;
    }
    const key = `${table_schema}.${table_name}`;
    if (is_column_constraint) {
      if (!tableConstraints[key]) tableConstraints[key] = {};
      if (!tableConstraints[key][column_name]) tableConstraints[key][column_name] = { checks: [] };
      tableConstraints[key][column_name].checks.push({
        name: check_name || undefined,
        // The check definition has the form: `CHECK ((expr))`
        // The expression starts at 8 and ends at -2
        expression: check_definition.slice(8, -2),
      });
      return;
    }
    if (!checks[key]) checks[key] = [];
    checks[key].push({
      name: check_name || undefined,
      // The check definition has the form: `CHECK ((expr))`
      // The expression starts at 8 and ends at -2
      expression: check_definition.slice(8, -2),
    });
  });

  return {
    indexes,
    tableConstraints,
    checks,
  };
};

const generateRawEnums = async (client: Client, schemas: string[]): Promise<Enum[]> => {
  const enumListSql = `
    SELECT DISTINCT
      n.nspname AS schema_name,
      t.typname AS enum_type,
      e.enumlabel AS enum_value,
      e.enumsortorder AS sort_order
    FROM
      pg_enum e
    JOIN
      pg_type t ON e.enumtypid = t.oid
    JOIN
      pg_namespace n ON t.typnamespace = n.oid
    ${buildSchemaQuery('n.nspname', schemas, 'WHERE')}
    ORDER BY
      schema_name,
      enum_type,
      sort_order;
    ;
  `;
  const enumListResult = await client.query(enumListSql);
  const enums = enumListResult.rows.reduce((acc, row) => {
    const { schema_name, enum_type, enum_value } = row;
    const key = `${schema_name}.${enum_type}`;

    if (!acc[key]) {
      acc[key] = {
        name: enum_type,
        schemaName: schema_name,
        values: [],
      };
    }
    acc[key].values.push({
      name: enum_value,
    });
    return acc;
  }, {});

  return Object.values(enums);
};

const fetchSchemaJson = async (connection: string): Promise<DatabaseSchema> => {
  const { connectionString, schemas } = parseConnectionString(connection, 'jdbc');
  const client = await getValidatedClient(connectionString);

  const tablesAndFieldsRes = generateTablesAndFields(client, schemas);
  const indexesRes = generateIndexesAndConstraints(client, schemas);
  const refsRes = generateRawRefs(client, schemas);
  const enumsRes = generateRawEnums(client, schemas);

  const res = await Promise.all([
    tablesAndFieldsRes,
    indexesRes,
    refsRes,
    enumsRes,
  ]);
  client.end();

  const { tables, fields } = res[0];
  const { indexes, tableConstraints, checks } = res[1];
  const refs = res[2];
  const enums = res[3];

  return {
    tables,
    fields,
    refs,
    enums,
    indexes,
    tableConstraints,
    checks,
  };
};

export {
  fetchSchemaJson,
};
