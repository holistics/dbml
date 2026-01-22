import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';
import { formatRecordValue } from './utils';

function _export (str, format) {
  const database = (new Parser()).parse(str, 'dbmlv2');
  return ModelExporter.export(database.normalize(), format);
}

export default {
  export: _export,
};

export { formatRecordValue };
