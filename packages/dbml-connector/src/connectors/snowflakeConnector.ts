/* eslint-disable camelcase */
//
// Description:
// Snowflake info schema lacks reference direction for relationships.
// Constraints and uniqueness cannot be auto-generated from Snowflake info schema.
// Snowflake does not support ENUMs.
// Snowflake does not support indexes for standard tables.
//

import snowflake, { Connection, LogLevel } from 'snowflake-sdk';
import { parseSchema } from '../utils/parseSchema';
import {
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  Field,
  FieldsDictionary,
  Index,
  IndexesDictionary,
  Table,
  TableConstraintsDictionary,
} from './types';

type ConstraintRow = {
  schemaName: string;
  tableName: string;
  constraintName: string;
  columnNames: string[];
  type: string;
  primary?: boolean;
  unique?: boolean;
};

type GeneratedIndexes = {
  indexes: IndexesDictionary;
  tableConstraints: TableConstraintsDictionary;
};

const parseConnectionString = (connectionString: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const regex = /([^;=]+)=([^;]*)/g;
  let match;

  while ((match = regex.exec(connectionString)) !== null) {
      params[match[1].trim()] = match[2].trim();
  }

  return params;
}


const connect = async (connection: Connection): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('Attempting to connect...');
    connection.connect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

const executeQuery = (connection: Connection, sqlText: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    console.log('Executing query...');
    connection.execute({
      sqlText: sqlText,
      complete: (err, stmt, rows) => {
        if (err) {
          reject(err);
        } else {
          console.log('Query executed successfully.');
          if (rows) {
            resolve(rows);
          }
        }
      }
    });
  });
}

const isLogLevel = (value: string): value is LogLevel => {
  return ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(value as LogLevel)
}

const connectToSnowflake = async (config: Record<string, string>): Promise<Connection> => {
  const logLevel = isLogLevel(config.LOG_LEVEL) ? config.LOG_LEVEL : 'INFO';
  const isDebugMode = config.IS_DEBUG_MODE === 'true';
  snowflake.configure({
    logLevel,
    additionalLogToConsole: isDebugMode,
  });

  // "SERVER=myaccount.snowflakecomputing.com;UID=myusername;PWD=mypassword;DATABASE=mydatabase;WAREHOUSE=mywarehouse;ROLE=myrole";
  const connection = snowflake.createConnection({
    account: config.SERVER,
    username: config.UID,
    password: config.PWD,
    database: config.DATABASE,
    warehouse: config.WAREHOUSE,
    sfRetryMaxLoginRetries: 3,
    timeout: 10000,
  });

  try {
    // Connect to Snowflake
    await connect(connection);

    // Execute the query
    await executeQuery(connection, 'SELECT CURRENT_VERSION();');

    return connection;
  } catch (err) {
    throw err;
  }
}


const convertQueryBoolean = (val: string | null) => val === 'YES';

const getFieldType = (data_type: string, character_maximum_length: number, numeric_precision: number, numeric_scale: number): string => {
  if (character_maximum_length) {
    return `${data_type}(${character_maximum_length})`;
  }
  if (numeric_precision && numeric_scale) {
    return `${data_type}(${numeric_precision},${numeric_scale})`;
  }
  return data_type;
};

const getDbdefault = (column_default: string, default_type: DefaultType): DefaultInfo => {
  if (default_type === 'string') {
    return {
      type: default_type,
      value: column_default.slice(1, -1),
    };
  }
  return {
    type: default_type,
    value: column_default,
  };
};

const generateField = (row: Record<string, any>): Field => {
  const {
    COLUMN_NAME: column_name,
    DATA_TYPE: data_type,
    CHARACTER_MAXIMUM_LENGTH: character_maximum_length,
    NUMERIC_PRECISION: numeric_precision,
    NUMERIC_SCALE: numeric_scale,
    IDENTITY_INCREMENT: identity_increment,
    IS_NULLABLE: is_nullable,
    COLUMN_DEFAULT: column_default,
    DEFAULT_TYPE: default_type,
    COLUMN_COMMENT: column_comment,
  } = row;

  const dbdefault = column_default ? getDbdefault(column_default, default_type) : null;

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

const generateTablesAndFields = async (conn: Connection, schemas: string[]): Promise<{
  tables: Table[],
  fields: FieldsDictionary,
}> => {
  const fields: FieldsDictionary = {};
  const schemaSql = schemas.length > 0 ? `AND c.table_schema IN (${schemas.map((schema) => `'${schema}'`).join(',')})` : '';
  const tablesAndFieldsSql = `
    SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_nullable,
        c.column_default,
        CASE
            WHEN c.column_default IS NULL THEN NULL
            WHEN c.column_default LIKE '''%' THEN 'string'
            WHEN LOWER(c.column_default) = 'true' OR LOWER(c.column_default) = 'false' THEN 'boolean'
            WHEN c.column_default REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN 'number'
            ELSE 'expression'
        END AS default_type,
        t.comment AS table_comment,
        c.comment AS column_comment,
        c.identity_increment
    FROM
        information_schema.columns c
        JOIN information_schema.tables t
            ON c.table_name = t.table_name
            AND c.table_schema = t.table_schema
    WHERE
        t.table_type = 'BASE TABLE'
        AND t.table_schema NOT IN ('INFORMATION_SCHEMA')
        ${schemaSql}
    ORDER BY
        c.table_schema,
        c.table_name,
        c.ordinal_position;
  `;

  const tablesAndFieldsResult = await executeQuery(conn, tablesAndFieldsSql);
  const tables = tablesAndFieldsResult.reduce((acc: Record<string, Table>, row: Record<string, string>) => {
    const { TABLE_SCHEMA: table_schema, TABLE_NAME: table_name, TABLE_COMMENT: table_comment } = row;
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

const createConstraintKeysMap = (keys: Record<string, string>[], schemas: string[], constraintType: 'primary' | 'unique'): Record<string, ConstraintRow> => {
  return keys.reduce((acc: Record<string, ConstraintRow>, row: Record<string, string>) => {
    const { schema_name, table_name, column_name, constraint_name } = row;
    const selectedSchema = schemas.length > 0 ? schemas.includes(schema_name) : true;
    if (!selectedSchema) { return acc; }

    const key = `${schema_name}.${table_name}.${constraint_name}`;

    if (acc[key]) {
      const columnNames = acc[key].columnNames;
      columnNames.push(column_name);
      return acc;
    }

    acc[key] = {
      schemaName: schema_name,
      tableName: table_name,
      constraintName: constraint_name,
      columnNames: [column_name],
      type: '',
    };
    acc[key][constraintType] = true;

    return acc;
  }, {});
};
const generateIndexes = async (conn: Connection, databaseName: string, schemas: string[]) => {


  const getPrimaryKeysSql = `
    SHOW PRIMARY KEYS IN DATABASE ${databaseName};
  `;

  const getUniqueKeysSql = `
    SHOW UNIQUE KEYS IN DATABASE ${databaseName};
  `;

  const primaryKeys = await executeQuery(conn, getPrimaryKeysSql);
  const uniqueKeys = await executeQuery(conn, getUniqueKeysSql);

  const primaryKeysByConstraint: Record<string, ConstraintRow> = createConstraintKeysMap(primaryKeys, schemas, 'primary');
  const uniqueKeysByConstraint: Record<string, ConstraintRow> = createConstraintKeysMap(uniqueKeys, schemas, 'unique');

  const allConstraints: ConstraintRow[] = [Object.values(primaryKeysByConstraint), Object.values(uniqueKeysByConstraint)].flat();
  const { indexes, tableConstraints } = allConstraints.reduce((acc: GeneratedIndexes, row: ConstraintRow): GeneratedIndexes => {
    const { schemaName, tableName, constraintName, columnNames, type, primary, unique } = row;
    const key = `${schemaName}.${tableName}`;

    if (columnNames.length < 2) {
      acc.tableConstraints[key] = {
        [columnNames[0]]: {
          pk: primary,
          unique,
        },
      };
      return acc;
    }

    const index: Index = {
      name: constraintName,
      type,
      unique,
      pk: primary,
      columns: columnNames.map((columnName) => ({
        type: 'column',
        value: columnName,
      })),
    };

    if (acc.indexes[key]) {
      acc.indexes[key].push(index);
    } else {
      acc.indexes[key] = [index];
    }

    return acc;
  }, { indexes: {}, tableConstraints: {}});

  return {
    indexes,
    tableConstraints,
  };
};

const fetchSchemaJson = async (connection: string): Promise<DatabaseSchema> => {
  const config = parseConnectionString(connection);
  const conn = await connectToSnowflake(config);
  if (conn instanceof Error) {
    throw conn;
  }
  // Schemas: schema1,schema2,schema3
  const schemas = config.SCHEMAS ? parseSchema(config.SCHEMAS) : [];
  const databaseName = config.DATABASE;

  const tablesAndFieldsRes = generateTablesAndFields(conn, schemas);
  const indexesRes = generateIndexes(conn, databaseName, schemas);

  const res = await Promise.all([
    tablesAndFieldsRes,
    indexesRes,
  ]);

  conn.destroy((err) => {
    if (err) {
      throw err;
    } else {
      console.log('Connection destroyed successfully.');
    }
  });

  const { tables, fields } = res[0];
  const { indexes, tableConstraints } = res[1];

  return {
    tables,
    fields,
    refs: [],
    enums: [],
    indexes,
    tableConstraints,
  };
};

export {
  fetchSchemaJson,
};
