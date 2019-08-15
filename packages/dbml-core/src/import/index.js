import Parser from '../parse/Parser';
import SchemaExporter from '../export/SchemaExporter';

function _import (str, format) {
  const parser = new Parser();
  const schema = parser.parse(str, format);
  const schemaExporter = new SchemaExporter(schema);
  const dbml = schemaExporter.export('dbml');

  return dbml;
}

export default {
  import: _import,
};
