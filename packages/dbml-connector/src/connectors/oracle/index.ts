import { getConnection, Connection } from 'oracledb';
import { DatabaseSchema } from '../types';
import { generateTablesAndFields } from './tables';
import { generateRawRefs } from './refs';
import { generateConstraints } from './constraints';
import { generateIndexes } from './indexes';
import { processEasyConnectString } from './utils';

const getValidatedClient = async (username: string, password: string, dbidentifier: string): Promise<Connection> => {
  const client = await getConnection({
    username,
    password,
    connectionString: dbidentifier,
  });
  try {
    await client.execute('SELECT 1 FROM DUAL');

    return client;
  } catch (error) {
    await client.close();
    if (error instanceof Error) {
      throw new Error(`OracleSQL connection error: ${error.message}`);
    }

    throw error;
  }
};

// Expect an Easy Connect string format: username/password@[//]host[:port][/database]
// `username` and `password` are mandatory
// `port` and `database` (and the parts enclosed in `[]`) are optional
// Explanation of the format: https://www.orafaq.com/wiki/EZCONNECT
async function fetchSchemaJson (connection: string): Promise<DatabaseSchema> {
  const { username, password, dbidentifier } = processEasyConnectString(connection);

  const client = await getValidatedClient(username, password, dbidentifier);

  const tablesAndFieldsRes = generateTablesAndFields(client);
  const constraintsRes = generateConstraints(client);
  const refsRes = generateRawRefs(client);
  const indexesRes = generateIndexes(client);

  const res = await Promise.all([
    tablesAndFieldsRes,
    constraintsRes,
    refsRes,
    indexesRes,
  ]);

  const { tables, fields } = res[0];
  const { indexes: uniqueIndexes, tableConstraints, checks } = res[1];
  const refs = res[2];
  const indexes = res[3];
  Object.keys(uniqueIndexes).forEach((key) => {
    if (!indexes[key]) indexes[key] = uniqueIndexes[key];
    else indexes[key].push(...uniqueIndexes[key]);
  });

  await client.close();

  return {
    tables,
    fields,
    refs,
    // As of oracle 19c, there's no native ENUM data type
    // ENUM is introduced in oracle 23ai
    enums: [],
    indexes,
    tableConstraints,
    checks,
  };
};

export {
  fetchSchemaJson,
};
