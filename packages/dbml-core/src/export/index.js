import SchemaExporter from './SchemaExporter';
import Parser from '../parse/Parser';

function _export (str, format) {
  const parser = new Parser();
  const schema = parser.parse(str, 'dbml');
  const exporter = new SchemaExporter(schema);
  return exporter.export(format);
}

export default {
  export: _export,
};
