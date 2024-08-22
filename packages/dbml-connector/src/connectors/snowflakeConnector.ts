/* eslint-disable camelcase */
//
// Description:
// Snowflake info schema lacks reference direction for relationships.
// Constraints and uniqueness cannot be auto-generated from Snowflake info schema.
// Snowflake does not support ENUMs.
// Snowflake does not support indexes for standard tables.
//
import snowflake, { Connection, LogLevel } from 'snowflake-sdk';
import {
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  Field,
  FieldsDictionary,
  Table,
  // Enum,
  // IndexesDictionary,
  // Ref,
  // RefEndpoint,
  // TableConstraint,
  // TableConstraintsDictionary,
} from './types';

const parseConnectionString = (connectionString: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const regex = /([^;=]+)=([^;]*)/g;
  let match;

  while ((match = regex.exec(connectionString)) !== null) {
      params[match[1].trim()] = match[2].trim();
  }

  return params;
}


const parseYesNo = (val: string): boolean => val === 'YES';

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
    schema: config.SCHEMA,
    sfRetryMaxLoginRetries: 3,
    timeout: 10000,
  });

  try {
    // Connect to Snowflake
    await connect(connection);

    // Execute the query
    await executeQuery(connection, 'SELECT CURRENT_VERSION();');

    return connection;
  } catch (err: any) {
    console.error('Error: ' + err.message);
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
    IS_IDENTITY: is_identity,
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
    pk: parseYesNo(is_identity),
    increment: !!identity_increment,
    note: column_comment ? { value: column_comment } : { value: '' },
  };
};

const generateTablesAndFields = async (conn: Connection, schema: string | null): Promise<{
  tables: Table[],
  fields: FieldsDictionary,
}> => {
  const fields: FieldsDictionary = {};
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
        c.is_identity,
        c.identity_increment
    FROM
        information_schema.columns c
        JOIN information_schema.tables t
            ON c.table_name = t.table_name
            AND c.table_schema = t.table_schema
    WHERE
        t.table_type = 'BASE TABLE'
        AND t.table_schema NOT IN ('INFORMATION_SCHEMA')
        ${schema ? `AND c.table_schema = '${schema}'` : ''}
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

const fetchSchemaJson = async (connection: string): Promise<DatabaseSchema> => {
  const config = parseConnectionString(connection);
  const conn = await connectToSnowflake(config);
  if (conn instanceof Error) {
    throw conn;
  }
  const schema = config.SCHEMA || null;

  const tablesAndFieldsRes = generateTablesAndFields(conn, schema);
  // const indexesRes = generateIndexes(conn);
  // const refsRes = generateRawRefs(conn, schema);
  // const enumsRes = generateRawEnums(conn);

  const res = await Promise.all([
    tablesAndFieldsRes,
    // indexesRes,
    //refsRes,
    // enumsRes,
  ]);

  conn.destroy((err) => {
    if (err) {
      console.error('Error destroying connection:', err);
    } else {
      console.log('Connection destroyed successfully.');
    }
  });

  const { tables, fields } = res[0];
  // const { indexes, tableConstraints } = res[1];
  // const refs = res[1];
  // const enums = res[3];

  return {
    tables,
    fields,
    refs: [],
    enums: [],
    indexes: {},
    tableConstraints: {},
  };
};

export {
  fetchSchemaJson,
};
