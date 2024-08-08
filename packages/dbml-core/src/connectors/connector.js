import { fetchSchemaJson as fetchPostgresSchemaJson } from './postgresConnector';
import { fetchSchemaJson as fetchMssqlSchemaJson } from './mssqlConnector';
import { fetchSchemaJson as fetchMysqlSchemaJson } from './mysqlConnector';

const fetchSchemaJson = async (connection, format) => {
  switch (format) {
    case 'postgres':
      return fetchPostgresSchemaJson(connection);
    case 'mssql':
      return fetchMssqlSchemaJson(connection);
    case 'mysql':
      return fetchMysqlSchemaJson(connection);
    default:
      throw new Error(`Unsupported connection format: ${format}`);
  }
};

export {
  fetchSchemaJson,
};
