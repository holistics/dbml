import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';

function _export (str, format) {
  const database = (new Parser()).parse(str, 'dbmlv2');
  return ModelExporter.export(database.normalize(), format);
}

export default {
  export: _export,
};
