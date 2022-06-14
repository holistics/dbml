import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';

function _export (str, format) {
  const database = Parser.parse(str, 'dbml');
  return ModelExporter.export(database.normalize(), format);
}

function _exportV2 (str, format, options = {}) {
  const database = Parser.parse(str, 'dbml');
  return ModelExporter.exportV2(database.normalize(), format, options);
}

export default {
  export: _export,
  exportV2: _exportV2,
};
