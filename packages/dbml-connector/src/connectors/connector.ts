import { DatabaseSchema } from './types';
import { fetchSchemaJson as fetchPostgresSchemaJson } from './postgresConnector';
import { fetchSchemaJson as fetchMssqlSchemaJson } from './mssqlConnector';
import { fetchSchemaJson as fetchMysqlSchemaJson } from './mysqlConnector';
import { fetchSchemaJson as fetchBigQuerySchemaJson } from './bigqueryConnector';

const fetchSchemaJson = async (connection: string, format: string): Promise<DatabaseSchema> => {
  switch (format) {
    case 'postgres':
      return fetchPostgresSchemaJson(connection);
    case 'mssql':
      return fetchMssqlSchemaJson(connection);
    case 'mysql':
      return fetchMysqlSchemaJson(connection);
    case 'bigquery':
      return fetchBigQuerySchemaJson(connection);
    default:
      throw new Error(`Unsupported connection format: ${format}`);
  }
};

export {
  fetchSchemaJson,
};
