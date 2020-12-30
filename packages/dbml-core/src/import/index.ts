import Parser from '../parse/Parser';
import ModelExporter from '../export/ModelExporter';

function _import (str: String, format: 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql') {
  const database = Parser.parse(str, format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export default {
  import: _import,
};
