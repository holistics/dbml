import Parser from '../parse/Parser';
import ModelExporter from '../export/ModelExporter';

async function _fetch (connection, format) {
  const database = await (new Parser()).fetch(connection, format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export default {
  fetch: _fetch,
};
