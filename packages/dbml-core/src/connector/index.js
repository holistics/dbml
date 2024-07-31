import DatabaseConnector from '../parse/DatabaseConnector';
import ModelExporter from '../export/ModelExporter';

async function fetchSchema (connection, format) {
  const database = await (new DatabaseConnector(connection)).fetchSchema(format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export default {
  fetchSchema,
};
