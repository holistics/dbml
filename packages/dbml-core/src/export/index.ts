import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';
import { DbmlExporterOptions } from './DbmlExporter';
import { JsonExporterOptions } from './JsonExporter';

export type ExportFormat = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';

export type ExportOptions =
  Partial<DbmlExporterOptions> &
  Partial<JsonExporterOptions>;

/**
 * @deprecated Passing a boolean as the third argument is deprecated. Use `ExportOptions` instead.
 */
function _export (
  str: string,
  format: ExportFormat,
  options: boolean,
): string;

function _export (
  str: string,
  format: ExportFormat,
  options?: ExportOptions,
): string;

function _export (
  str: string,
  format: ExportFormat,
  options: ExportOptions | boolean = {
    isNormalized: true,
    includeRecords: true
  },
): string {
  const resolvedFlags = normalizeExportOptions(options);
  const database = (new Parser()).parse(str, 'dbmlv2');
  return ModelExporter.export(database.normalize(), format, resolvedFlags);
}

export function normalizeExportOptions (
  options: ExportOptions | boolean = {},
): Required<ExportOptions> {
  if (typeof options === 'boolean') {
    return {
      isNormalized: options,
      includeRecords: true,
    };
  }

  const {
    isNormalized = true,
    includeRecords = true,
  } = options;

  return {
    isNormalized,
    includeRecords,
  };
}

export default {
  export: _export,
};
