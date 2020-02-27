import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';

function _export (str, format) {
  const database = Parser.parse(str, 'dbml');
  return ModelExporter.export(database.normalize(), format);
}

export default {
  export: _export,
};
