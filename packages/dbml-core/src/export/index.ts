import ModelExporter, { ExportFlags, ExportFormatOption } from './ModelExporter';
import Parser from '../parse/Parser';

function _export (str: string, format: ExportFormatOption, flags: ExportFlags = {}) {
  const database = (new Parser()).parse(str, 'dbmlv2');
  return ModelExporter.export(database.normalize(), format, flags);
}

export default {
  export: _export,
};
