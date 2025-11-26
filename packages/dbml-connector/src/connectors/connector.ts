import { DatabaseSchema } from './types';
import { fetchSchemaJson as fetchPostgresSchemaJson } from './postgres';
import { fetchSchemaJson as fetchMssqlSchemaJson } from './mssql';
import { fetchSchemaJson as fetchMysqlSchemaJson } from './mysql';
import { fetchSchemaJson as fetchSnowflakeSchemaJson } from './snowflake';
import { fetchSchemaJson as fetchBigQuerySchemaJson } from './bigquery';
import { fetchSchemaJson as fetchOracleSchemaJson } from './oracle';

const fetchSchemaJson = async (connection: string, databaseType: string): Promise<DatabaseSchema> => {
  switch (databaseType) {
    case 'postgres':
      return fetchPostgresSchemaJson(connection);
    case 'mssql':
      return fetchMssqlSchemaJson(connection);
    case 'mysql':
      return fetchMysqlSchemaJson(connection);
    case 'snowflake':
      return fetchSnowflakeSchemaJson(connection);
    case 'bigquery':
      return fetchBigQuerySchemaJson(connection);
    case 'oracle':
      return fetchOracleSchemaJson(connection);
    default:
      throw new Error(`Unsupported database type: ${databaseType}`);
  }
};

export {
  fetchSchemaJson,
};
