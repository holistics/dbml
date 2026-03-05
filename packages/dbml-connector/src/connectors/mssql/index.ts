/* TDD 72
 * - In MSSQL, there's no notion of ENUM.
 * - MSSQL connector used to extract ENUMS from CHECK constraints, for example: `CHECK ([col]=value1 OR [col]=value2)` would be translated to an enum with 2 values, `value1` and `value2`.
 * - Since DBML 4.0.0, we have supported CHECK constraints, so we no longer extract ENUMS out from CHECK constraints but rather keep them as CHECK constraints.
 * */
import sql from 'mssql';
import { buildSchemaQuery, parseConnectionString } from '../../utils/parseSchema';
import {
  CheckConstraintDictionary,
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  Field,
  FieldsDictionary,
  IndexesDictionary,
  Ref,
  RefEndpoint,
  Table,
  TableConstraintsDictionary,
} from '../types';

// https://learn.microsoft.com/en-us/sql/t-sql/data-types/date-and-time-types?view=sql-server-ver15
const MSSQL_DATE_TYPES = [
  'date',
  'datetime',
  'datetime2',
  'smalldatetime',
  'datetimeoffset',
  'time',
];

const getValidatedClient = async (connection: string): Promise<sql.ConnectionPool> => {
  const pool = await sql.connect(connection);
  try {
    // Establish a connection pool
    // Validate if the connection is successful by making a simple query
    await pool.request().query('SELECT 1');

    // If successful, return the pool
    return pool;
  } catch (err) {
    // Ensure to close any open pool in case of failure
    if (pool.connected) {
      await pool.close();
    }
    if (err instanceof Error) {
      throw new Error(`SQL connection error: ${err.message}`);
    }

    throw err; // Rethrow error if you want the calling code to handle it
  }
};

const convertQueryBoolean = (val: string | null): boolean => val === 'YES';

const getFieldType = (data_type: string, character_maximum_length: number, numeric_precision: number, numeric_scale: number): string => {
  if (MSSQL_DATE_TYPES.includes(data_type)) {
    return data_type;
  }

  // timestamp is a synonym of rowversion and we cannot specify the precision for it
  // https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql?view=sql-server-ver15
  if (data_type === 'timestamp') {
    return data_type;
  }

  // process numeric-based type
  if (data_type === 'bit') {
    return data_type;
  }
  // if precision != 0 => numeric-based column
  if (numeric_precision) {
    return numeric_scale
      ? `${data_type}(${numeric_precision},${numeric_scale})`
      : `${data_type}(${numeric_precision})`;
  }

  // process string-based type
  // ntext, text & image
  if (['ntext', 'text', 'image'].includes(data_type)) {
    return data_type;
  }

  // Column data type is varchar(max), nvarchar(max), varbinary(max), or xml
  if (character_maximum_length < 0) {
    return data_type === 'xml' ? data_type : `${data_type}(MAX)`;
  }

  // character_maximum_length is the lenght in bytes
  // nchar and nvarchar store Unicode characters, each character needs 2 bytes
  // so we have to divide it by 2 to get the correct maximum lenght in character.
  // ref: https://learn.microsoft.com/en-us/sql/t-sql/data-types/nchar-and-nvarchar-transact-sql?view=sql-server-ver15
  if (character_maximum_length > 0) {
    const maximum_length_in_character = (data_type === 'nchar' || data_type === 'nvarchar')
      ? character_maximum_length / 2
      : character_maximum_length;

    return `${data_type}(${maximum_length_in_character})`;
  }

  return data_type;
};

const getDbdefault = (data_type: string, column_default: string, default_type: DefaultType): DefaultInfo => {
  // The regex below is used to extract the value from the default value
  // \( and \) are used to escape parentheses
  // [^()]+ is used to match any character except parentheses
  // Example: (1) => 1, ('hello') => hello, getdate()-(1) => getdate()-1
  const value = column_default.slice(1, -1).replace(/\(([^()]+)\)/g, '$1');

  return {
    type: default_type,
    value: default_type === 'string' ? value.slice(1, -1) : value, // Remove the quotes for string values
  };
};

const generateField = (row: Record<string, any>): Field => {
  const {
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    identity_increment,
    is_nullable,
    column_default,
    default_type,
    column_comment,
  } = row;

  const dbdefault = column_default && default_type !== 'increment' ? getDbdefault(data_type, column_default, default_type) : null;

  const fieldType = {
    type_name: getFieldType(data_type, character_maximum_length, numeric_precision, numeric_scale),
    schemaName: null,
  };

  return {
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment,
    note: column_comment ? { value: column_comment } : { value: '' },
  };
};

const generateTablesFields = async (client: sql.ConnectionPool, schemas: string[]): Promise<{
  tables: Table[];
  fields: FieldsDictionary;
}> => {
  const fields: FieldsDictionary = {};
  const tablesAndFieldsSql = `
    WITH tables_and_fields AS (
      SELECT
        t.object_id AS table_id,
        s.name AS table_schema,
        t.name AS table_name,
        t.create_date as table_create_date,
        c.name AS column_name,
        c.column_id as column_id,
        ty.name AS data_type,
        c.max_length AS character_maximum_length,
        c.precision AS numeric_precision,
        c.scale AS numeric_scale,
        c.is_identity AS identity_increment,
        CASE
          WHEN c.is_nullable = 1 THEN 'YES'
          ELSE 'NO'
        END AS is_nullable,
        CASE
          WHEN c.default_object_id = 0 THEN NULL
          ELSE OBJECT_DEFINITION(c.default_object_id)
        END AS column_default,
        -- Fetching table comments
        p.value AS table_comment,
        ep.value AS column_comment
      FROM
        sys.tables t
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.columns c ON t.object_id = c.object_id
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        LEFT JOIN sys.extended_properties p ON p.major_id = t.object_id
          AND p.name like '%description%'
          AND p.minor_id = 0 -- Ensure minor_id is 0 for table comments
        LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id
          AND ep.minor_id = c.column_id
          AND ep.name like '%description%'
      WHERE
        t.type = 'U' -- User-defined tables
    )
    SELECT
      table_schema,
      table_name,
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      identity_increment,
      is_nullable,
      column_default,
      table_comment,
      column_comment,
      CASE
        WHEN column_default LIKE '((%))' THEN 'number'
        WHEN column_default LIKE '(''%'')' THEN 'string'
        ELSE 'expression'
      END AS default_type
    FROM
      tables_and_fields
    WHERE
      1 = 1
      ${buildSchemaQuery('table_schema', schemas)}
    ORDER BY
      table_schema,
      table_create_date,
      table_id,
      column_id;
  `;

  const tablesAndFieldsResult = await client.query(tablesAndFieldsSql);
  const tables = tablesAndFieldsResult.recordset.reduce((acc, row) => {
    const {
      table_schema,
      table_name,
      table_comment,
    } = row;
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

const generateRefs = async (client: sql.ConnectionPool, schemas: string[]): Promise<Ref[]> => {
  const refs: Ref[] = [];

  const refsListSql = `
    SELECT
      s.name AS table_schema,
      t.name AS table_name,
      fk.name AS fk_constraint_name,
      STUFF((
        SELECT ',' + c1.name
        FROM sys.foreign_key_columns AS fkc
        JOIN sys.columns AS c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
        WHERE fkc.constraint_object_id = fk.object_id
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS column_names,
      s2.name AS foreign_table_schema,
      t2.name AS foreign_table_name,
      STUFF((
        SELECT ',' + c2.name
        FROM sys.foreign_key_columns AS fkc
        JOIN sys.columns AS c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
        WHERE fkc.constraint_object_id = fk.object_id
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS foreign_column_names,
      fk.type_desc AS constraint_type,
      fk.delete_referential_action_desc AS on_delete,
      fk.update_referential_action_desc AS on_update
    FROM sys.foreign_keys AS fk
    JOIN sys.tables AS t ON fk.parent_object_id = t.object_id
    JOIN sys.schemas AS s ON t.schema_id = s.schema_id
    JOIN sys.tables AS t2 ON fk.referenced_object_id = t2.object_id
    JOIN sys.schemas AS s2 ON t2.schema_id = s2.schema_id
    WHERE s.name NOT IN ('sys', 'information_schema')
      ${buildSchemaQuery('s.name', schemas)}
    ORDER BY
      s.name,
      t.name;
  `;

  const refsQueryResult = await client.query(refsListSql);

  const endpointsEqual = (ep1: RefEndpoint[], ep2: RefEndpoint[]): boolean => {
    if (ep1.length !== ep2.length) return false;
    return ep1.every(
      (endpoint, index) => endpoint.tableName === ep2[index].tableName
        && endpoint.schemaName === ep2[index].schemaName
        && endpoint.fieldNames.length === ep2[index].fieldNames.length
        && endpoint.fieldNames.every((field, fieldIndex) => field === ep2[index].fieldNames[fieldIndex]),
    );
  };

  refsQueryResult.recordset.forEach((refRow) => {
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

    const newRef = {
      name: fk_constraint_name,
      endpoints: [ep1, ep2],
      onDelete: on_delete === 'NO_ACTION' ? null : on_delete,
      onUpdate: on_update === 'NO_ACTION' ? null : on_update,
    };

    const isDuplicate = refs.some((ref) => endpointsEqual(ref.endpoints, newRef.endpoints));

    if (!isDuplicate) {
      refs.push(newRef);
    }
  });

  return refs;
};

const generateIndexesAndConstraints = async (client: sql.ConnectionPool, schemas: string[]) => {
  const indexListSql = `
    WITH user_tables AS (
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME
      FROM
        INFORMATION_SCHEMA.TABLES
      WHERE
        TABLE_TYPE = 'BASE TABLE'  -- Ensure we are only getting base tables
        AND TABLE_NAME NOT LIKE 'dt%'
        AND TABLE_NAME NOT LIKE 'syscs%'
        AND TABLE_NAME NOT LIKE 'sysss%'
        AND TABLE_NAME NOT LIKE 'sysrs%'
        AND TABLE_NAME NOT LIKE 'sysxlgc%'
    ),
    index_info AS (
      SELECT
        SCHEMA_NAME(t.schema_id) AS table_schema,  -- Add schema information
        OBJECT_NAME(i.object_id) AS table_name,
        i.name AS index_name,
        i.is_unique,
        CASE
          WHEN i.type = 1 THEN 1
          ELSE 0
        END AS is_primary,
        i.type_desc AS index_type,
        STUFF((
          SELECT
            ', ' + c.name
          FROM
            sys.index_columns ic
            JOIN sys.columns c ON ic.column_id = c.column_id AND ic.object_id = c.object_id
          WHERE
            ic.index_id = i.index_id
            AND ic.object_id = i.object_id
            AND OBJECT_NAME(ic.object_id) IN (SELECT TABLE_NAME FROM user_tables)  -- Filter for user tables
          ORDER BY
            ic.key_ordinal
          FOR XML PATH('')
        ), 1, 2, '') AS columns,
        CASE
          WHEN i.type = 1 THEN 'PRIMARY KEY'
          WHEN i.is_unique = 1 THEN 'UNIQUE'
          ELSE NULL
        END AS constraint_type
      FROM
        sys.indexes i
        JOIN sys.tables t ON i.object_id = t.object_id
      WHERE
        t.is_ms_shipped = 0
        AND i.type <> 0
    )
    SELECT
      ut.TABLE_SCHEMA AS table_schema,
      ut.TABLE_NAME AS table_name,
      ii.index_name,
      ii.is_unique,
      ii.is_primary,
      ii.index_type,
      ii.columns,
      ii.constraint_type
    FROM
      user_tables ut
    LEFT JOIN
      index_info ii ON ut.TABLE_NAME = ii.table_name
      AND ut.TABLE_SCHEMA = ii.table_schema
    WHERE
      ii.columns IS NOT NULL
      ${buildSchemaQuery('ut.TABLE_SCHEMA', schemas)}
    ORDER BY
      ut.TABLE_NAME,
      ii.constraint_type,
      ii.index_name;
  `;
  const indexListResult = await client.query(indexListSql);
  const { outOfLineIndexes, inlineIndexes } = indexListResult.recordset.reduce((acc, row) => {
    const { constraint_type, columns } = row;

    if (columns === 'null' || columns.trim() === '') return acc;
    if (constraint_type === 'PRIMARY KEY' || constraint_type === 'UNIQUE') {
      acc.inlineIndexes.push(row);
    } else {
      acc.outOfLineIndexes.push(row);
    }
    return acc;
  }, { inlineIndexes: [], outOfLineIndexes: [] });

  const indexes = outOfLineIndexes.reduce((acc: IndexesDictionary, indexRow: Record<string, any>) => {
    const {
      table_schema,
      table_name,
      index_name,
      index_type,
      columns,
      expressions,
      is_unique,
      is_primary,
    } = indexRow;
    const indexColumns = columns.split(',').map((column: string) => {
      return {
        type: 'column',
        value: column.trim(),
      };
    });

    const indexExpressions = expressions
      ? expressions.split(',').map((expression: string) => {
          return {
            type: 'expression',
            value: expression,
          };
        })
      : [];

    const index = {
      name: index_name,
      type: index_type,
      columns: [
        ...indexColumns,
        ...indexExpressions,
      ],
      pk: !!is_primary,
      unique: !is_primary && !!is_unique,
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
      columns,
      constraint_type,
    } = row;
    const key = `${table_schema}.${table_name}`;
    if (!tableConstraints[key]) tableConstraints[key] = {};

    const columnNames = columns.split(',').map((column: string) => column.trim());
    columnNames.forEach((columnName: string) => {
      if (!tableConstraints[key][columnName]) tableConstraints[key][columnName] = { checks: [] };
      if (constraint_type === 'PRIMARY KEY') {
        tableConstraints[key][columnName].pk = true;
      }
      if (constraint_type === 'UNIQUE' && !tableConstraints[key][columnName].pk) {
        tableConstraints[key][columnName].unique = true;
      }
    });
  });

  const checkListSql = `
    SELECT
      OBJECT_SCHEMA_NAME(cc.parent_object_id) AS table_schema,
      OBJECT_NAME(cc.parent_object_id) AS table_name,
      c.name AS column_name,
      cc.name AS check_name,
      cc.definition AS check_expression
    FROM
      sys.check_constraints cc
    LEFT JOIN
      sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
    WHERE 1 = 1
      ${buildSchemaQuery('OBJECT_SCHEMA_NAME(cc.parent_object_id)', schemas)}
  `;

  const checkListResult = await client.query(checkListSql);
  const checks: CheckConstraintDictionary = {};
  checkListResult.recordset.forEach((row) => {
    const {
      table_schema,
      table_name,
      column_name,
      check_name,
      check_expression,
    } = row;
    const key = `${table_schema}.${table_name}`;
    if (!check_expression) return;
    if (column_name) {
      if (!tableConstraints[key]) tableConstraints[key] = {};
      if (!tableConstraints[key][column_name]) tableConstraints[key][column_name] = { checks: [] };
      // The check definition has the form: `(expr)`
      // The expression starts at 1 and ends at -1
      tableConstraints[key][column_name].checks.push({ name: check_name, expression: check_expression.slice(1, -1) });
      return;
    }
    if (!checks[key]) checks[key] = [];
    // The check definition has the form: `(expr)`
    // The expression starts at 1 and ends at -1
    checks[key].push({ name: check_name, expression: check_expression.slice(1, -1) });
  });

  return {
    indexes,
    tableConstraints,
    checks,
  };
};

const fetchSchemaJson = async (connection: string): Promise<DatabaseSchema> => {
  const { connectionString, schemas } = parseConnectionString(connection, 'odbc');
  const client = await getValidatedClient(connectionString);

  try {
    const tablesRes = generateTablesFields(client, schemas);
    const indexesAndConstraintsRes = generateIndexesAndConstraints(client, schemas);
    const refsRes = generateRefs(client, schemas);

    const res = await Promise.all([
      tablesRes,
      indexesAndConstraintsRes,
      refsRes,
    ]);

    const { tables, fields } = res[0];
    const { indexes, tableConstraints, checks } = res[1];
    const refs = res[2];

    return {
      tables,
      fields,
      // MSSQL doesn't support the notion of enums
      enums: [],
      refs,
      indexes,
      tableConstraints,
      checks,
    };
  } finally {
    await client.close();
  }
};

export {
  fetchSchemaJson,
};
