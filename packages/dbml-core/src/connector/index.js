import Parser from '../parse/Parser';
import ModelExporter from '../export/ModelExporter';

function _fetch (connection, format) {
  const database = (new Parser()).fetch(connection, format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export default {
  fetch: _fetch,
};
