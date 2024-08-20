/* eslint-disable camelcase */
import snowflake, { Connection } from 'snowflake-sdk';
import {
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  // Enum,
  Field,
  FieldsDictionary,
  // IndexesDictionary,
  // Ref,
  // RefEndpoint,
  Table,
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


// Helper function to connect
function connect(connection: Connection): Promise<void> {
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

// Helper function to execute query
function executeQuery(connection: Connection, sqlText: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    console.log('Executing query...');
    connection.execute({
      sqlText: sqlText,
      complete: (err, stmt, rows) => {
        if (err) {
          reject(err);
        } else {
          if (rows) {
            resolve(rows);
          }
        }
      }
    });
  });
}

const connectToSnowflake = async (connectionString: string): Promise<Connection> => {
  snowflake.configure({
    logLevel: "INFO",
    logFilePath: "./log_file.log",
    additionalLogToConsole: true,
  });
  const config = parseConnectionString(connectionString);

  // "SERVER=myaccount.snowflakecomputing.com;UID=myusername;PWD=mypassword;DATABASE=mydatabase;WAREHOUSE=mywarehouse;ROLE=myrole";
  const connection = snowflake.createConnection({
    account: config.SERVER,
    username: config.UID,
    password: config.PWD,
    database: config.DATABASE,
    warehouse: config.WAREHOUSE,
    schema: config.SCHEMA,
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

const getFieldType = (data_type: string, udt_name: string, character_maximum_length: number, numeric_precision: number, numeric_scale: number): string => {
  // if (data_type === 'ARRAY') {
  //   return `${udt_name.slice(1, udt_name.length)}[]`;
  // }
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
  // const {
  //   column_name,
  //   data_type,
  //   character_maximum_length,
  //   numeric_precision,
  //   numeric_scale,
  //   udt_schema,
  //   udt_name,
  //   identity_increment,
  //   is_nullable,
  //   column_default,
  //   default_type,
  //   column_comment,
  // } = row;
  const {
    COLUMN_NAME: column_name,
    DATA_TYPE: data_type,
    CHARACTER_MAXIMUM_LENGTH: character_maximum_length,
    NUMERIC_PRECISION: numeric_precision,
    NUMERIC_SCALE: numeric_scale,
    UDT_SCHEMA: udt_schema,
    UDT_NAME: udt_name,
    IDENTITY_INCREMENT: identity_increment,
    IS_NULLABLE: is_nullable,
    COLUMN_DEFAULT: column_default,
    DEFAULT_TYPE: default_type,
    COLUMN_COMMENT: column_comment,
  } = row;

  // const dbdefault = column_default && default_type !== 'increment' ? getDbdefault(data_type, column_default, default_type) : null;

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
    dbdefault: null,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment || default_type === 'increment',
    note: column_comment ? { value: column_comment } : { value: '' },
  };
};

const generateTablesAndFields = async (conn: Connection): Promise<{
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
        WHEN LOWER(c.column_default) LIKE 'auto_increment%' THEN 'increment'
        WHEN c.column_default LIKE '''%' THEN 'string'
        WHEN LOWER(c.column_default) = 'true' OR LOWER(c.column_default) = 'false' THEN 'boolean'
        WHEN c.column_default REGEXP '^-?[0-9]+(\.[0-9]+)?$' THEN 'number'
        ELSE 'expression'
      END AS default_type,
      t.comment AS table_comment,
      c.comment AS column_comment
    FROM
      information_schema.columns c
      JOIN information_schema.tables t
        ON c.table_name = t.table_name
        AND c.table_schema = t.table_schema
    WHERE
      t.table_type = 'BASE TABLE'
      AND t.table_schema NOT IN ('INFORMATION_SCHEMA')
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

const fetchSchemaJson = async (connection: string, schema = 'DBML_TEST'): Promise<DatabaseSchema> => {
  const conn = await connectToSnowflake(connection);
  if (conn instanceof Error) {
    throw conn;
  }

  const tablesAndFieldsRes = generateTablesAndFields(conn);
  // const indexesRes = generateIndexes(conn);
  // const refsRes = generateRawRefs(conn);
  // const enumsRes = generateRawEnums(conn);

  const res = await Promise.all([
    tablesAndFieldsRes,
    // indexesRes,
    // refsRes,
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
  // const refs = res[2];
  // const enums = res[3];

  console.log('Tables:', tables);

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
