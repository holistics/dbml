import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';

function _export (str: String, format: 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql') {
  const database = Parser.parse(str, 'dbml');
  return ModelExporter.export(database.normalize(), format);
}

export default {
  export: _export,
};
