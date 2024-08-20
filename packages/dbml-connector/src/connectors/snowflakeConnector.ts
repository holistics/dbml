/* eslint-disable camelcase */
import snowflake, { Connection } from 'snowflake-sdk';
import {
  DatabaseSchema,
  // DefaultInfo,
  // DefaultType,
  // Enum,
  // Field,
  // FieldsDictionary,
  // IndexesDictionary,
  // Ref,
  // RefEndpoint,
  // Table,
  // TableConstraintsDictionary,
} from './types';

async function connectToSnowflake(connectionString: string): Promise<Connection | Error> {
  const [account, username, password, database, schema] = connectionString.split(';').map((part) => {
    return part.split('=')[1];
  });

  try {
    // Create a connection object using the connection string
    const connection: Connection = snowflake.createConnection({
      account: account,
      username: username,
      password: password,
      database: database,
      schema: schema,
    });

    // Connect to Snowflake
    await new Promise((resolve, reject) => {
      connection.connect((err, conn) => {
        if (err) {
          reject(err);
        } else {
          resolve(conn);
        }
      });
    });

    // Run a simple SELECT 1 query to verify the connection
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: 'SELECT 1',
        complete: (err, stmt, status) => {
          if (err) {
            reject(err);
          } else {
            resolve(status);
          }
        },
      });
    });

    // Return the connection if everything is successful
    return connection;
  } catch (err) {
    // Return the error if there's a problem
    return err as Error;
  }
}

const fetchSchemaJson = async (connection: string): Promise<DatabaseSchema> => {
  const client = await connectToSnowflake(connection);
  if (client instanceof Error) {
    throw client;
  }

  const tablesAndFieldsRes = generateTablesAndFields(client);
  // const indexesRes = generateIndexes(client);
  // const refsRes = generateRawRefs(client);
  // const enumsRes = generateRawEnums(client);

  const res = await Promise.all([
    tablesAndFieldsRes,
    // indexesRes,
    // refsRes,
    // enumsRes,
  ]);

  client.destroy((err) => {
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
