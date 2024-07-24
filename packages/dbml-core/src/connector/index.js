import DatabaseConnector from '../parse/DatabaseConnector';
import ModelExporter from '../export/ModelExporter';

async function _fetch (connection, format) {
  const database = await (new DatabaseConnector(connection)).fetch(format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export default {
  fetch: _fetch,
};
