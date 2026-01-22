import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';
import { formatDbmlRecordValue } from './utils';

function _export (str, format) {
  const database = (new Parser()).parse(str, 'dbmlv2');
  return ModelExporter.export(database.normalize(), format);
}

export default {
  export: _export,
};

export { formatDbmlRecordValue };
